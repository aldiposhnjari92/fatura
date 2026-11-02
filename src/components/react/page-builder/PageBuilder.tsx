import * as React from 'react';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
  ROOT,
  childrenOf,
  cloneBlock,
  createBlock,
  findBlock,
  insertAt,
  knownBlocks,
  locate,
  moveBlock,
  removeBlock,
  replaceBlock,
  sameContainer,
  slugify,
} from '@/lib/page-builder';
import BlockInspector from './BlockInspector';
import BuilderCanvas from './BuilderCanvas';
import CollectionsDialog from './CollectionsDialog';
import Navigator from './Navigator';
import PageSettings from './PageSettings';
import PagesBar from './PagesBar';
import PanelFooter from './PanelFooter';
import WidgetPalette from './WidgetPalette';
import { BLOCK_LABEL } from './builder-config';
import { CopyPageDialog, DeletePageDialog, NewPageDialog, PreviewDialog, SaveTemplateDialog } from './PageDialogs';
import type {
  Block,
  BlockType,
  CollectionField,
  Container,
  CustomCollection,
  CustomPage,
  FieldType,
} from '@/models/page-builder';
import type {
  BlockContext,
  BuilderPanel,
  DragPayload,
  DropTarget,
  InspectorTab,
  PageBuilderProps,
  PreviewDevice,
} from '@/models/page-builder-ui';

/*
  The admin's page builder for one customer, laid out the way Elementor is.

  Left: one panel that changes with what you are doing — the element grid,
  the selected element's settings (Përmbajtja / Stili / Të avancuara), the
  page's settings, or the Navigator tree. Its footer holds the tools Elementor
  keeps there: page settings, navigator, undo/redo, device preview and save.

  Right: the page itself (BuilderCanvas).

  This file owns the state — the draft, the selection, undo history, drag and
  drop, saving — and the parts beside it only draw it.

  Edits stay local until "Ruaj" — a page is one row written in one update, so
  the customer never sees a half-built layout, and drafts stay invisible to
  them until published.
*/

const EMPTY_VALUES = {};

/** How long consecutive edits fold into one undo step — a word, not a letter. */
const COALESCE_MS = 600;
const HISTORY_LIMIT = 60;

const INSPECTOR_TABS = [
  { value: 'content', label: 'Përmbajtja' },
  { value: 'style', label: 'Stili' },
  { value: 'advanced', label: 'Të avancuara' },
] as const;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export default function PageBuilder({ owner, pages: initialPages, collections: initialCollections }: PageBuilderProps) {
  const [pages, setPages] = React.useState<CustomPage[]>(() =>
    initialPages.map((p) => ({ ...p, blocks: knownBlocks(p.blocks) }))
  );
  const [collections, setCollections] = React.useState(initialCollections);
  const [selectedPageId, setSelectedPageId] = React.useState<string | null>(initialPages[0]?.id ?? null);
  const [draft, setDraft] = React.useState<CustomPage | null>(() =>
    initialPages[0] ? { ...initialPages[0], blocks: knownBlocks(initialPages[0].blocks) } : null
  );
  const [dirty, setDirty] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [panel, setPanel] = React.useState<BuilderPanel>('widgets');
  const [tab, setTab] = React.useState<InspectorTab>('content');
  const [device, setDevice] = React.useState<PreviewDevice>('desktop');
  const [search, setSearch] = React.useState('');
  const [insertTarget, setInsertTarget] = React.useState<DropTarget | null>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [collectionsOpen, setCollectionsOpen] = React.useState(false);
  const [confirmDeletePage, setConfirmDeletePage] = React.useState(false);
  const [newPageOpen, setNewPageOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = React.useState(false);
  const [copyOpen, setCopyOpen] = React.useState(false);
  const [history, setHistory] = React.useState<{ past: Block[][]; future: Block[][] }>({
    past: [],
    future: [],
  });
  const lastPush = React.useRef<{ at: number; key: string }>({ at: 0, key: '' });
  const drag = React.useRef<DragPayload | null>(null);

  // Unsaved work is the one thing this screen must not lose silently.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const blocks = draft?.blocks ?? [];
  const selected = selectedId ? (findBlock(blocks, selectedId) ?? null) : null;
  const collectionsById = React.useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);
  const navGroups = React.useMemo(
    () => [...new Set(pages.map((p) => p.nav_group?.trim()).filter((g): g is string => !!g))],
    [pages]
  );

  // The canvas renders real blocks with no data and every write switched off.
  const canvasContext = React.useMemo<BlockContext>(
    () => ({
      preview: true,
      blocks,
      collection: (id) => (id ? collectionsById.get(id) : undefined),
      rows: () => [],
      onSaved: () => {},
      onDeleted: () => {},
      formValues: () => EMPTY_VALUES,
      setFormValue: () => {},
      resetForm: () => {},
    }),
    [collectionsById, blocks]
  );

  // ---- State changes -------------------------------------------------------

  function edit(patch: Partial<CustomPage>) {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
    setDirty(true);
  }

  /**
   * Every block change goes through here, so undo sees all of them. Edits to
   * the same block in quick succession — typing — fold into one step.
   */
  function setBlocks(next: Block[], key = 'structure') {
    if (!draft) return;
    const now = Date.now();
    const coalesce = key !== 'structure' && key === lastPush.current.key && now - lastPush.current.at < COALESCE_MS;
    lastPush.current = { at: now, key };
    if (!coalesce) {
      setHistory((h) => ({ past: [...h.past, draft.blocks].slice(-HISTORY_LIMIT), future: [] }));
    }
    edit({ blocks: next });
  }

  function undo() {
    if (!draft || history.past.length === 0) return;
    const prev = history.past[history.past.length - 1];
    setHistory({ past: history.past.slice(0, -1), future: [draft.blocks, ...history.future] });
    lastPush.current = { at: 0, key: '' };
    edit({ blocks: prev });
    if (selectedId && !findBlock(prev, selectedId)) select(null);
  }

  function redo() {
    if (!draft || history.future.length === 0) return;
    const [next, ...rest] = history.future;
    setHistory({ past: [...history.past, draft.blocks], future: rest });
    lastPush.current = { at: 0, key: '' };
    edit({ blocks: next });
    if (selectedId && !findBlock(next, selectedId)) select(null);
  }

  function select(id: string | null) {
    setSelectedId(id);
    if (id) {
      setPanel('edit');
      setInsertTarget(null);
    } else if (panel === 'edit') {
      setPanel('widgets');
    }
  }

  function confirmDiscard() {
    return !dirty || window.confirm('Ke ndryshime të paruajtura. T’i hedhësh poshtë?');
  }

  function loadPage(page: CustomPage | null) {
    setSelectedPageId(page?.id ?? null);
    setDraft(page ? { ...page } : null);
    setSelectedId(null);
    setPanel('widgets');
    setInsertTarget(null);
    setHistory({ past: [], future: [] });
    setDirty(false);
  }

  function openPage(id: string) {
    if (id === selectedPageId || !confirmDiscard()) return;
    loadPage(pages.find((p) => p.id === id) ?? null);
  }

  // ---- Blocks --------------------------------------------------------------

  function addBlock(type: BlockType, target: DropTarget | null = insertTarget, fieldKind?: FieldType) {
    // A data block starts on the only collection when there is just one.
    const block = createBlock(type, collections.length === 1 ? collections[0].id : null, fieldKind);
    const where = target ?? { container: ROOT, index: blocks.length };
    setBlocks(insertAt(blocks, where.container, where.index, block));
    setSelectedId(block.id);
    setPanel('edit');
    setTab('content');
    setInsertTarget(null);
  }

  /** Adds a field to a collection, for a form element that has none to connect to yet. */
  async function addCollectionField(collectionId: string, field: CollectionField): Promise<boolean> {
    const collection = collections.find((c) => c.id === collectionId);
    if (!collection) return false;
    const { data, error } = await supabase
      .from('custom_collections')
      .update({ fields: [...collection.fields, field] })
      .eq('id', collectionId)
      .select()
      .single();
    if (error) {
      notify.error('Fusha nuk u shtua', error.message);
      return false;
    }
    setCollections((prev) => prev.map((c) => (c.id === collectionId ? (data as CustomCollection) : c)));
    notify.success('Fusha u shtua.', `“${field.label}” te ${collection.name}.`);
    return true;
  }

  function updateBlock(updated: Block) {
    setBlocks(replaceBlock(blocks, updated), updated.id);
  }

  function deleteBlock(id: string) {
    setBlocks(removeBlock(blocks, id));
    if (selectedId === id || (selected?.type === 'columns' && !findBlock(removeBlock(blocks, id), selectedId!))) {
      select(null);
    }
  }

  function duplicateBlock(id: string) {
    const where = locate(blocks, id);
    const block = findBlock(blocks, id);
    if (!where || !block) return;
    const copy = cloneBlock(block);
    setBlocks(insertAt(blocks, where.container, where.index + 1, copy));
    setSelectedId(copy.id);
  }

  function nudge(id: string, by: -1 | 1) {
    const where = locate(blocks, id);
    if (!where) return;
    const siblings = childrenOf(blocks, where.container);
    const to = where.index + (by === 1 ? 2 : -1);
    if (to < 0 || to > siblings.length) return;
    setBlocks(moveBlock(blocks, id, where.container, to));
  }

  // Keyboard: undo/redo anywhere outside a text field; Delete removes the selection.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target) || !draft) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteBlock(selectedId);
      } else if (e.key === 'Escape') {
        select(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- Drag and drop -------------------------------------------------------

  function startDrag(event: React.DragEvent, payload: DragPayload) {
    event.stopPropagation();
    drag.current = payload;
    event.dataTransfer.effectAllowed = payload.kind === 'new' ? 'copy' : 'move';
    // Firefox will not start a drag without some data on it.
    event.dataTransfer.setData('text/plain', payload.kind);
  }

  /** Over a block: drop before it in the top half, after it in the bottom. */
  function overBlock(event: React.DragEvent, container: Container, index: number) {
    if (!drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const at = event.clientY < rect.top + rect.height / 2 ? index : index + 1;
    if (!dropTarget || !sameContainer(dropTarget.container, container) || dropTarget.index !== at) {
      setDropTarget({ container, index: at });
    }
  }

  function overEmpty(event: React.DragEvent, container: Container, index: number) {
    if (!drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    if (!dropTarget || !sameContainer(dropTarget.container, container) || dropTarget.index !== index) {
      setDropTarget({ container, index });
    }
  }

  /** Over the canvas background: the drop goes at the end of the page. */
  function overCanvas(event: React.DragEvent) {
    if (!drag.current) return;
    event.preventDefault();
    if (event.target === event.currentTarget) setDropTarget({ container: ROOT, index: blocks.length });
  }

  function drop(event: React.DragEvent) {
    event.preventDefault();
    const payload = drag.current;
    const target = dropTarget ?? { container: ROOT, index: blocks.length };
    endDrag();
    if (!payload) return;
    if (payload.kind === 'new') addBlock(payload.type, target, payload.fieldKind);
    else setBlocks(moveBlock(blocks, payload.id, target.container, target.index));
  }

  function endDrag() {
    drag.current = null;
    setDropTarget(null);
  }

  // ---- Pages ---------------------------------------------------------------

  function uniqueSlug(base: string, exceptId?: string) {
    const taken = new Set(pages.filter((p) => p.id !== exceptId).map((p) => p.slug));
    let slug = base;
    for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
    return slug;
  }

  function openNewPage() {
    if (confirmDiscard()) setNewPageOpen(true);
  }

  /** A page made from a template arrives with its own new collections. */
  function adoptCreated(page: CustomPage, created: CustomCollection[]) {
    setCollections((prev) => [...prev, ...created]);
    setPages((prev) => [...prev, page]);
    loadPage(page);
    setPanel('page');
  }

  async function createPage() {
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('custom_pages')
        .insert({
          owner_id: owner.id,
          title: 'Faqe e re',
          slug: uniqueSlug('faqe-e-re'),
          icon: 'file',
          position: pages.reduce((max, p) => Math.max(max, p.position), -1) + 1,
          published: false,
          blocks: [],
        })
        .select()
        .single();
      if (error) throw error;
      const page = { ...(data as CustomPage), blocks: [] };
      setPages((prev) => [...prev, page]);
      loadPage(page);
      setPanel('page');
    } catch (err) {
      notify.error('Faqja nuk u krijua', (err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function savePage() {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      notify.error('Mungon titulli', 'Jepi faqes një titull.');
      setPanel('page');
      return;
    }
    const slug = slugify(draft.slug || title);
    if (pages.some((p) => p.id !== draft.id && p.slug === slug)) {
      notify.error('Adresa është e zënë', `Një faqe tjetër përdor tashmë “${slug}”.`);
      setPanel('page');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('custom_pages')
        .update({
          title,
          slug,
          icon: draft.icon,
          nav_group: draft.nav_group?.trim() || null,
          published: draft.published,
          blocks: draft.blocks,
        })
        .eq('id', draft.id)
        .select()
        .single();
      if (error) throw error;
      const saved = { ...(data as CustomPage), blocks: knownBlocks((data as CustomPage).blocks) };
      setPages((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setDraft(saved);
      setDirty(false);
      notify.success(
        'Faqja u ruajt.',
        saved.published
          ? `${owner.name} e sheh tani te “${saved.title}”.`
          : 'Është ende draft — klienti nuk e sheh.'
      );
    } catch (err) {
      notify.error('Faqja nuk u ruajt', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePage() {
    if (!draft) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('custom_pages').delete().eq('id', draft.id);
      if (error) throw error;
      const rest = pages.filter((p) => p.id !== draft.id);
      setPages(rest);
      loadPage(rest[0] ?? null);
      setConfirmDeletePage(false);
      notify.success('Faqja u fshi.', 'Të dhënat e koleksioneve mbeten.');
    } catch (err) {
      notify.error('Faqja nuk u fshi', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /** Sidebar order: swap with the neighbour, both rows written. */
  async function movePage(id: string, by: -1 | 1) {
    const sorted = [...pages].sort((a, b) => a.position - b.position);
    const i = sorted.findIndex((p) => p.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const a = { id: sorted[i].id, position: sorted[j].position };
    const b = { id: sorted[j].id, position: sorted[i].position };
    if (a.position === b.position) a.position += by; // positions were never spread out
    try {
      const results = await Promise.all([
        supabase.from('custom_pages').update({ position: a.position }).eq('id', a.id),
        supabase.from('custom_pages').update({ position: b.position }).eq('id', b.id),
      ]);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      const pos = new Map([
        [a.id, a.position],
        [b.id, b.position],
      ]);
      setPages((prev) => prev.map((p) => (pos.has(p.id) ? { ...p, position: pos.get(p.id)! } : p)));
      if (draft && pos.has(draft.id)) setDraft({ ...draft, position: pos.get(draft.id)! });
    } catch (err) {
      notify.error('Renditja nuk u ruajt', (err as Error).message);
    }
  }

  const sortedPages = [...pages].sort((a, b) => a.position - b.position);

  // ---- Render --------------------------------------------------------------

  const panelTitle =
    panel === 'widgets'
      ? insertTarget
        ? 'Zgjidh elementin për ta shtuar'
        : 'Elementet'
      : panel === 'edit' && selected
        ? `Ndrysho: ${BLOCK_LABEL[selected.type]}`
        : panel === 'page'
          ? 'Cilësimet e faqes'
          : 'Navigatori';

  return (
    <div className="flex flex-col gap-4">
      <PagesBar
        pages={sortedPages}
        selectedPageId={selectedPageId}
        draftTitle={draft ? draft.title : null}
        dirty={dirty}
        creating={creating}
        collectionCount={collections.length}
        onOpen={openPage}
        onMove={movePage}
        onNew={openNewPage}
        onCollections={() => setCollectionsOpen(true)}
        onPreview={() => setPreviewOpen(true)}
        onSaveTemplate={() => setSaveTemplateOpen(true)}
        onCopy={() => setCopyOpen(true)}
      />

      {!draft ? (
        <div className="bg-card shadow-card rounded-2xl px-6 py-16 text-center">
          <h2 className="text-sm font-semibold">{owner.name} nuk ka ende faqe të personalizuara</h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Krijo një faqe, shto një koleksion për të dhënat, pastaj tërhiq formularë dhe tabela mbi
            të. Faqja shfaqet në menunë e klientit sapo ta publikosh.
          </p>
          <Button onClick={openNewPage} className="mt-5" disabled={creating}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />} Krijo faqen e parë
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* ---------------- The panel ---------------- */}
          <aside className="bg-card shadow-card flex h-fit flex-col overflow-hidden rounded-2xl lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]">
            <div className="bg-primary text-primary-foreground flex h-12 shrink-0 items-center gap-2 px-3">
              {panel !== 'widgets' && (
                <button
                  type="button"
                  aria-label="Kthehu te elementet"
                  onClick={() => {
                    setPanel('widgets');
                    setSelectedId(null);
                  }}
                  className="hover:bg-primary-foreground/15 rounded p-1"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <p className="flex-1 truncate text-sm font-semibold">{panelTitle}</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {panel === 'widgets' && (
                <WidgetPalette
                  search={search}
                  onSearch={setSearch}
                  hasInsertTarget={!!insertTarget}
                  onAdd={(type, fieldKind) => addBlock(type, insertTarget, fieldKind)}
                  onDragStart={startDrag}
                  onDragEnd={endDrag}
                />
              )}

              {panel === 'edit' && selected && (
                <>
                  <div className="grid shrink-0 grid-cols-3 border-b">
                    {INSPECTOR_TABS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTab(t.value)}
                        className={cn(
                          'border-b-2 py-2.5 text-xs font-medium transition-colors',
                          tab === t.value
                            ? 'border-primary text-primary'
                            : 'text-muted-foreground hover:text-foreground border-transparent'
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="p-4">
                    <BlockInspector
                      key={selected.id}
                      block={selected}
                      tab={tab}
                      collections={collections}
                      onChange={updateBlock}
                      onManageCollections={() => setCollectionsOpen(true)}
                      pageBlocks={blocks}
                      onAddField={addCollectionField}
                    />
                  </div>
                </>
              )}

              {panel === 'page' && (
                <div className="p-4">
                  <PageSettings
                    page={draft}
                    navGroups={navGroups}
                    onChange={edit}
                    onDelete={() => setConfirmDeletePage(true)}
                    slugTaken={(slug) => pages.some((p) => p.id !== draft.id && p.slug === slug)}
                  />
                </div>
              )}

              {panel === 'navigator' && (
                <Navigator blocks={blocks} selectedId={selectedId} onSelect={select} />
              )}
            </div>

            <PanelFooter
              panel={panel}
              onPanel={setPanel}
              canUndo={history.past.length > 0}
              canRedo={history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              device={device}
              onDevice={setDevice}
              saving={saving}
              dirty={dirty}
              published={draft.published}
              onSave={savePage}
            />
          </aside>

          {/* ---------------- The canvas ---------------- */}
          <BuilderCanvas
            title={draft.title}
            blocks={blocks}
            device={device}
            context={canvasContext}
            selectedId={selectedId}
            insertTarget={insertTarget}
            dropTarget={dropTarget}
            onSelect={select}
            onPickInsert={(target) => {
              setInsertTarget(target);
              setSelectedId(null);
              setPanel('widgets');
            }}
            onDragStart={startDrag}
            onDragEnd={endDrag}
            onDragOverBlock={overBlock}
            onDragOverEmpty={overEmpty}
            onDragOverCanvas={overCanvas}
            onDrop={drop}
            onNudge={nudge}
            onDuplicate={duplicateBlock}
            onDelete={deleteBlock}
          />
        </div>
      )}

      <NewPageDialog
        open={newPageOpen}
        onOpenChange={setNewPageOpen}
        ownerId={owner.id}
        onBlank={createPage}
        onCreated={adoptCreated}
      />

      {draft && (
        <>
          <PreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            page={draft}
            collections={collections}
            ownerName={owner.name}
          />
          <SaveTemplateDialog
            open={saveTemplateOpen}
            onOpenChange={setSaveTemplateOpen}
            page={draft}
            blocks={draft.blocks}
            collections={collections}
          />
          <CopyPageDialog
            open={copyOpen}
            onOpenChange={setCopyOpen}
            page={draft}
            blocks={draft.blocks}
            collections={collections}
            currentOwnerId={owner.id}
          />
        </>
      )}

      <CollectionsDialog
        open={collectionsOpen}
        onOpenChange={setCollectionsOpen}
        ownerId={owner.id}
        collections={collections}
        onChange={setCollections}
      />

      <DeletePageDialog
        open={confirmDeletePage}
        onOpenChange={setConfirmDeletePage}
        title={draft?.title ?? ''}
        busy={saving}
        onConfirm={deletePage}
      />
    </div>
  );
}
