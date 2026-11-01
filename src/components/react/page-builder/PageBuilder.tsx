import * as React from 'react';
import {
  BadgeDollarSign,
  BellRing,
  FlipHorizontal2,
  Image as ImageIcon,
  LayoutGrid,
  ListChecks,
  ListOrdered,
  ListCollapse,
  Megaphone,
  PanelTop,
  Quote,
  Receipt,
  SquareStack,
  Star,
  Timer,
  TrendingUp,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Columns3,
  Copy,
  CopyPlus,
  Database,
  Eye,
  EyeOff,
  GripVertical,
  Heading,
  Layers,
  LayoutTemplate,
  Loader2,
  Minus,
  Monitor,
  MoreHorizontal,
  MousePointerClick,
  MoveVertical,
  Plus,
  Redo2,
  Save,
  Search,
  Settings,
  Sigma,
  Smartphone,
  Table2,
  Tablet,
  TextCursorInput,
  Trash2,
  Type,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/react/dropdown-menu';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
  BLOCK_TYPES,
  COLUMN_GRID,
  DEFAULT_NAV_GROUP,
  PAGE_ICONS,
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
  styleClasses,
  type Block,
  type BlockType,
  type Container,
  type CustomCollection,
  type CustomPage,
  type LeafBlock,
  type PageIcon,
  type PaletteGroup,
} from '@/lib/page-builder';
import { BlockContextProvider, BlockView, type BlockContext } from './PageBlocks';
import BlockInspector, { Field, Segmented, type InspectorTab } from './BlockInspector';
import CollectionsDialog from './CollectionsDialog';
import { CopyPageDialog, NewPageDialog, PreviewDialog, SaveTemplateDialog } from './PageDialogs';

/*
  The admin's page builder for one customer, laid out the way Elementor is.

  Left: one panel that changes with what you are doing — the element grid,
  the selected element's settings (Përmbajtja / Stili / Të avancuara), the
  page's settings, or the Navigator tree. Its footer holds the tools Elementor
  keeps there: page settings, navigator, undo/redo, device preview and save.

  Right: the page itself, drawn by the same components the customer's page
  uses, with interaction switched off. Click to select; drag to move; drop
  elements from the panel between blocks or into a column. The canvas is a
  container, so the phone preview stacks columns and hides elements exactly as
  a phone will.

  Edits stay local until "Ruaj" — a page is one row written in one update, so
  the customer never sees a half-built layout, and drafts stay invisible to
  them until published.
*/

interface Props {
  owner: { id: string; name: string };
  pages: CustomPage[];
  collections: CustomCollection[];
}

const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  columns: Columns3,
  spacer: MoveVertical,
  divider: Minus,
  heading: Heading,
  text: Type,
  button: MousePointerClick,
  form: TextCursorInput,
  table: Table2,
  stat: Sigma,
  image: ImageIcon,
  iconlist: ListChecks,
  alert: BellRing,
  iconbox: SquareStack,
  tabs: PanelTop,
  accordion: ListCollapse,
  toc: ListOrdered,
  testimonial: Quote,
  rating: Star,
  pricetable: BadgeDollarSign,
  pricelist: Receipt,
  cta: Megaphone,
  flipbox: FlipHorizontal2,
  countdown: Timer,
  progress: TrendingUp,
  cards: LayoutGrid,
};

const BLOCK_LABEL = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b.label])) as Record<
  BlockType,
  string
>;

const PALETTE_GROUPS: PaletteGroup[] = ['Struktura', 'Bazë', 'Përmbajtje', 'Marketing', 'Të dhëna'];

const ICON_LABELS: Record<PageIcon, string> = {
  file: 'Dokument',
  'clipboard-list': 'Listë',
  table: 'Tabelë',
  package: 'Paketë',
  'shopping-cart': 'Shportë',
  calendar: 'Kalendar',
  wallet: 'Portofol',
  star: 'Yll',
  truck: 'Kamion',
  users: 'Njerëz',
};

type Device = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTH: Record<Device, string> = {
  desktop: 'max-w-none',
  tablet: 'max-w-[768px]',
  mobile: 'max-w-[390px]',
};

type Panel = 'widgets' | 'edit' | 'page' | 'navigator';
type DragPayload = { kind: 'new'; type: BlockType } | { kind: 'move'; id: string };
type Target = { container: Container; index: number };

/** How long consecutive edits fold into one undo step — a word, not a letter. */
const COALESCE_MS = 600;
const HISTORY_LIMIT = 60;

/** A one-line name for a block, for the navigator and the canvas tag. */
function summary(block: Block): string {
  switch (block.type) {
    case 'heading':
    case 'text':
      return block.text.slice(0, 40) || BLOCK_LABEL[block.type];
    case 'form':
    case 'table':
      return block.title || BLOCK_LABEL[block.type];
    case 'stat':
      return block.label || BLOCK_LABEL.stat;
    case 'button':
      return block.label || BLOCK_LABEL.button;
    case 'columns':
      return `${BLOCK_LABEL.columns} ${block.layout.replace(/-/g, ' / ')}`;
    case 'iconbox':
    case 'alert':
    case 'pricetable':
    case 'cta':
    case 'toc':
    case 'countdown':
      return block.title || BLOCK_LABEL[block.type];
    case 'cards':
      return block.title || BLOCK_LABEL.cards;
    case 'progress':
    case 'rating':
      return block.label || BLOCK_LABEL[block.type];
    case 'testimonial':
      return block.author || BLOCK_LABEL.testimonial;
    case 'flipbox':
      return block.frontTitle || BLOCK_LABEL.flipbox;
    case 'image':
      return block.alt || block.caption || BLOCK_LABEL.image;
    default:
      return BLOCK_LABEL[block.type];
  }
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export default function PageBuilder({ owner, pages: initialPages, collections: initialCollections }: Props) {
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
  const [panel, setPanel] = React.useState<Panel>('widgets');
  const [tab, setTab] = React.useState<InspectorTab>('content');
  const [device, setDevice] = React.useState<Device>('desktop');
  const [search, setSearch] = React.useState('');
  const [insertTarget, setInsertTarget] = React.useState<Target | null>(null);
  const [dropTarget, setDropTarget] = React.useState<Target | null>(null);
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

  function addBlock(type: BlockType, target: Target | null = insertTarget) {
    // A data block starts on the only collection when there is just one.
    const block = createBlock(type, collections.length === 1 ? collections[0].id : null);
    const where = target ?? { container: ROOT, index: blocks.length };
    setBlocks(insertAt(blocks, where.container, where.index, block));
    setSelectedId(block.id);
    setPanel('edit');
    setTab('content');
    setInsertTarget(null);
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

  function drop(event: React.DragEvent) {
    event.preventDefault();
    const payload = drag.current;
    const target = dropTarget ?? { container: ROOT, index: blocks.length };
    endDrag();
    if (!payload) return;
    if (payload.kind === 'new') addBlock(payload.type, target);
    else setBlocks(moveBlock(blocks, payload.id, target.container, target.index));
  }

  function endDrag() {
    drag.current = null;
    setDropTarget(null);
  }

  const isDropAt = (container: Container, index: number) =>
    !!dropTarget && sameContainer(dropTarget.container, container) && dropTarget.index === index;

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

  // ---- Canvas pieces -----------------------------------------------------------

  // Plain render functions, not components: a component declared in here would
  // be a new type every render, remounting the canvas — and cancelling a drag.
  function dropLine(container: Container, index: number) {
    return (
      <div
        className={cn(
          'h-1 rounded-full transition-colors',
          isDropAt(container, index) ? 'bg-primary' : 'bg-transparent'
        )}
      />
    );
  }

  function addHere(target: Target, label: string) {
    const active =
      insertTarget &&
      sameContainer(insertTarget.container, target.container) &&
      insertTarget.index === target.index;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setInsertTarget(target);
          setSelectedId(null);
          setPanel('widgets');
        }}
        className={cn(
          'text-muted-foreground hover:border-primary hover:text-primary flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-xs font-medium transition-colors',
          active && 'border-primary bg-primary/5 text-primary'
        )}
      >
        <Plus className="size-3.5" /> {label}
      </button>
    );
  }

  /** The selection frame every block gets on the canvas: outline, tag and toolbar. */
  function frame(block: Block, container: Container, index: number, children: React.ReactNode) {
    const isSelected = block.id === selectedId;
    const Icon = BLOCK_ICONS[block.type];
    return (
      <div
        key={block.id}
        draggable
        onDragStart={(e) => startDrag(e, { kind: 'move', id: block.id })}
        onDragEnd={endDrag}
        onDragOver={(e) => overBlock(e, container, index)}
        onClick={(e) => {
          e.stopPropagation();
          select(block.id);
        }}
        className={cn(
          'group/frame relative cursor-pointer rounded-md outline-2 -outline-offset-2 transition-[outline-color]',
          isSelected
            ? 'outline-primary outline'
            : 'outline-transparent hover:outline hover:outline-dashed hover:outline-primary/50'
        )}
      >
        {/* Elementor's tab: the element's name, and the handle to drag it by. */}
        <div
          className={cn(
            'bg-primary text-primary-foreground absolute -top-6 left-0 z-10 items-center gap-1 rounded-t-md px-1.5 py-0.5 text-[11px] font-medium',
            isSelected ? 'flex' : 'hidden group-hover/frame:flex'
          )}
        >
          <GripVertical className="size-3 cursor-grab" aria-hidden />
          <Icon className="size-3" aria-hidden />
          {BLOCK_LABEL[block.type]}
        </div>
        <div
          className={cn(
            'bg-background absolute -top-6 right-0 z-10 items-center gap-0.5 rounded-t-md border border-b-0 px-1',
            isSelected ? 'flex' : 'hidden group-hover/frame:flex'
          )}
        >
          <ToolButton label="Lart" onClick={() => nudge(block.id, -1)} disabled={index === 0}>
            <ArrowUp />
          </ToolButton>
          <ToolButton
            label="Poshtë"
            onClick={() => nudge(block.id, 1)}
            disabled={index === childrenOf(blocks, container).length - 1}
          >
            <ArrowDown />
          </ToolButton>
          <ToolButton label="Dyfisho" onClick={() => duplicateBlock(block.id)}>
            <Copy />
          </ToolButton>
          <ToolButton label="Fshi" danger onClick={() => deleteBlock(block.id)}>
            <Trash2 />
          </ToolButton>
        </div>
        {children}
      </div>
    );
  }

  function leaf(block: LeafBlock, container: Container, index: number) {
    return frame(
      block,
      container,
      index,
      // Interaction is off in the editor: clicks select, they do not type.
      <div className={cn('pointer-events-none select-none', styleClasses(block.style))} aria-hidden>
        <BlockView block={block} />
      </div>
    );
  }

  function section(block: Extract<Block, { type: 'columns' }>, index: number) {
    return frame(
      block,
      ROOT,
      index,
        <div className={cn('grid gap-5 p-1', COLUMN_GRID[block.layout], styleClasses(block.style))}>
          {block.columns.map((column, col) => {
            const container: Container = { kind: 'column', blockId: block.id, col };
            return (
              <div
                key={col}
                onDragOver={(e) => overEmpty(e, container, column.length)}
                className="border-muted-foreground/25 flex min-w-0 flex-col gap-1 rounded-md border border-dashed p-2"
              >
                {column.map((child, i) => (
                  <React.Fragment key={child.id}>
                    {dropLine(container, i)}
                    {leaf(child, container, i)}
                  </React.Fragment>
                ))}
                {dropLine(container, column.length)}
                {addHere({ container, index: column.length }, 'Shto')}
              </div>
            );
          })}
        </div>
    );
  }

  // ---- Render --------------------------------------------------------------

  const visiblePalette = BLOCK_TYPES.filter(
    (b) => !search.trim() || b.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Pages bar */}
      <div className="bg-card shadow-card flex flex-col gap-3 rounded-2xl p-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {sortedPages.map((page, i) => (
            <div
              key={page.id}
              className={cn(
                'group flex items-center rounded-lg border transition-colors',
                page.id === selectedPageId ? 'border-primary bg-primary/5' : 'hover:bg-muted'
              )}
            >
              <button
                type="button"
                onClick={() => openPage(page.id)}
                className="flex items-center gap-2 py-1.5 pr-1 pl-3 text-sm font-medium"
              >
                {page.published ? (
                  <Eye className="text-success size-3.5" aria-label="Publikuar" />
                ) : (
                  <EyeOff className="text-muted-foreground size-3.5" aria-label="Draft" />
                )}
                {page.id === selectedPageId && draft ? draft.title || 'Pa titull' : page.title}
                {page.id === selectedPageId && dirty && (
                  <span className="bg-warning size-1.5 rounded-full" aria-label="E paruajtur" />
                )}
              </button>
              <span className="flex pr-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  aria-label={`Lëvize ${page.title} para`}
                  disabled={i === 0}
                  onClick={() => movePage(page.id, -1)}
                  className="text-muted-foreground hover:text-foreground rounded p-0.5 disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5 -rotate-90" />
                </button>
                <button
                  type="button"
                  aria-label={`Lëvize ${page.title} pas`}
                  disabled={i === sortedPages.length - 1}
                  onClick={() => movePage(page.id, 1)}
                  className="text-muted-foreground hover:text-foreground rounded p-0.5 disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5 -rotate-90" />
                </button>
              </span>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={openNewPage} disabled={creating}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />} Faqe e re
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCollectionsOpen(true)}>
            <Database /> Koleksionet ({collections.length})
          </Button>
          {draft && (
            <>
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                <Eye /> Parapamje
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-8" aria-label="Më shumë">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onSelect={() => setSaveTemplateOpen(true)}>
                    <LayoutTemplate /> Ruaj si shabllon
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCopyOpen(true)}>
                    <CopyPlus /> Kopjo te një klient tjetër
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

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
              <p className="flex-1 truncate text-sm font-semibold">
                {panel === 'widgets'
                  ? insertTarget
                    ? 'Zgjidh elementin për ta shtuar'
                    : 'Elementet'
                  : panel === 'edit' && selected
                    ? `Ndrysho: ${BLOCK_LABEL[selected.type]}`
                    : panel === 'page'
                      ? 'Cilësimet e faqes'
                      : 'Navigatori'}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {panel === 'widgets' && (
                <div className="grid gap-4 p-3">
                  <div className="relative">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                    <Input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Kërko element…"
                      className="pl-8"
                    />
                  </div>
                  {PALETTE_GROUPS.map((group) => {
                    const items = visiblePalette.filter((b) => b.group === group);
                    if (items.length === 0) return null;
                    return (
                      <div key={group}>
                        <p className="text-muted-foreground mb-2 text-[11px] font-bold tracking-[0.12em] uppercase">
                          {group}
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {items.map((b) => {
                            const Icon = BLOCK_ICONS[b.type];
                            return (
                              <button
                                key={b.type}
                                type="button"
                                draggable
                                onDragStart={(e) => startDrag(e, { kind: 'new', type: b.type })}
                                onDragEnd={endDrag}
                                onClick={() => addBlock(b.type)}
                                title={`${b.description} — tërhiqe ose kliko`}
                                className="hover:border-primary hover:text-primary flex aspect-square cursor-grab flex-col items-center justify-center gap-2 rounded-lg border p-2 text-center transition-colors active:cursor-grabbing"
                              >
                                <Icon className="size-5" />
                                <span className="text-[11px] leading-tight font-medium">{b.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-muted-foreground text-[11px] leading-snug">
                    Tërhiqe një element mbi faqe ose brenda një kolone. Me klik shtohet{' '}
                    {insertTarget ? 'te vendi i zgjedhur' : 'në fund të faqes'}.
                  </p>
                </div>
              )}

              {panel === 'edit' && selected && (
                <>
                  <div className="grid shrink-0 grid-cols-3 border-b">
                    {(
                      [
                        { value: 'content', label: 'Përmbajtja' },
                        { value: 'style', label: 'Stili' },
                        { value: 'advanced', label: 'Të avancuara' },
                      ] as const
                    ).map((t) => (
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

            {/* Elementor's footer: page settings, navigator, history, devices, save. */}
            <div className="bg-muted/60 flex shrink-0 items-center gap-0.5 border-t p-1.5">
              <FooterButton label="Cilësimet e faqes" active={panel === 'page'} onClick={() => setPanel(panel === 'page' ? 'widgets' : 'page')}>
                <Settings />
              </FooterButton>
              <FooterButton label="Navigatori" active={panel === 'navigator'} onClick={() => setPanel(panel === 'navigator' ? 'widgets' : 'navigator')}>
                <Layers />
              </FooterButton>
              <FooterButton label="Zhbëj (Ctrl+Z)" disabled={history.past.length === 0} onClick={undo}>
                <Undo2 />
              </FooterButton>
              <FooterButton label="Ribëj (Ctrl+Y)" disabled={history.future.length === 0} onClick={redo}>
                <Redo2 />
              </FooterButton>
              <span className="bg-border mx-0.5 h-5 w-px" />
              <FooterButton label="Kompjuter" active={device === 'desktop'} onClick={() => setDevice('desktop')}>
                <Monitor />
              </FooterButton>
              <FooterButton label="Tablet" active={device === 'tablet'} onClick={() => setDevice('tablet')}>
                <Tablet />
              </FooterButton>
              <FooterButton label="Telefon" active={device === 'mobile'} onClick={() => setDevice('mobile')}>
                <Smartphone />
              </FooterButton>
              <Button size="sm" className="ml-auto h-8" onClick={savePage} disabled={saving || !dirty}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {dirty ? (draft.published ? 'Përditëso' : 'Ruaj') : 'E ruajtur'}
              </Button>
            </div>
          </aside>

          {/* ---------------- The canvas ---------------- */}
          <section
            className="bg-muted/40 min-h-[560px] overflow-x-auto rounded-2xl border p-4 sm:p-6"
            onClick={() => select(null)}
            onDragOver={(e) => {
              if (!drag.current) return;
              e.preventDefault();
              if (e.target === e.currentTarget) setDropTarget({ container: ROOT, index: blocks.length });
            }}
            onDrop={drop}
          >
            <div
              className={cn(
                'bg-background mx-auto rounded-xl p-4 shadow-sm transition-[max-width] duration-300 sm:p-6',
                DEVICE_WIDTH[device]
              )}
            >
              <BlockContextProvider value={canvasContext}>
                <div className="@container">
                  <h1 className="mb-6 text-2xl font-semibold tracking-tight">{draft.title}</h1>

                  {blocks.length === 0 ? (
                    <div
                      onDragOver={(e) => overEmpty(e, ROOT, 0)}
                      className={cn(
                        'text-muted-foreground grid place-items-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center text-sm transition-colors',
                        isDropAt(ROOT, 0) && 'border-primary bg-primary/5 text-primary'
                      )}
                    >
                      <p>Tërhiq elementin e parë këtu, ose</p>
                      <div className="w-48">
                        {addHere({ container: ROOT, index: 0 }, 'Shto element')}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {blocks.map((block, index) => (
                        <React.Fragment key={block.id}>
                          {dropLine(ROOT, index)}
                          <div className="pt-5">
                            {block.type === 'columns' ? (
                              section(block, index)
                            ) : (
                              leaf(block, ROOT, index)
                            )}
                          </div>
                        </React.Fragment>
                      ))}
                      {dropLine(ROOT, blocks.length)}
                      <div className="pt-4" onDragOver={(e) => overEmpty(e, ROOT, blocks.length)}>
                        {addHere({ container: ROOT, index: blocks.length }, 'Shto element')}
                      </div>
                    </div>
                  )}
                </div>
              </BlockContextProvider>
            </div>
          </section>
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

      <Dialog open={confirmDeletePage} onOpenChange={(open) => !saving && setConfirmDeletePage(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fshi faqen “{draft?.title}”?</DialogTitle>
            <DialogDescription>
              Faqja hiqet nga menuja e klientit. Koleksionet dhe të dhënat e tyre nuk preken.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeletePage(false)} disabled={saving}>
              Anulo
            </Button>
            <Button variant="destructive" onClick={deletePage} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Po, fshije
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Small parts --------------------------------------------------------------

function ToolButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'text-muted-foreground rounded p-1 disabled:opacity-30 [&_svg]:size-3.5',
        danger ? 'hover:text-destructive' : 'hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function FooterButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md p-1.5 transition-colors disabled:opacity-30 [&_svg]:size-4',
        active ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

/** The page as a tree — Elementor's Navigator — for picking what is hard to click. */
function Navigator({
  blocks,
  selectedId,
  onSelect,
}: {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (blocks.length === 0) {
    return <p className="text-muted-foreground p-4 text-sm">Faqja është bosh.</p>;
  }
  const row = (block: Block, depth: number, prefix?: string) => {
    const Icon = BLOCK_ICONS[block.type];
    return (
      <button
        key={block.id}
        type="button"
        onClick={() => onSelect(block.id)}
        style={{ paddingLeft: `${12 + depth * 18}px` }}
        className={cn(
          'flex w-full items-center gap-2 py-2 pr-3 text-left text-sm transition-colors',
          block.id === selectedId ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
        )}
      >
        <Icon className="text-muted-foreground size-3.5 shrink-0" />
        {prefix && <span className="text-muted-foreground shrink-0 text-[11px]">{prefix}</span>}
        <span className="truncate">{summary(block)}</span>
        {(block.style?.hideOnMobile || block.style?.hideOnDesktop) && (
          <EyeOff className="text-muted-foreground ml-auto size-3 shrink-0" aria-label="E fshehur në një pajisje" />
        )}
      </button>
    );
  };
  return (
    <div className="py-1">
      {blocks.map((block) =>
        block.type === 'columns' ? (
          <React.Fragment key={block.id}>
            {row(block, 0)}
            {block.columns.map((column, col) => (
              <React.Fragment key={col}>
                <p className="text-muted-foreground py-1 text-[11px]" style={{ paddingLeft: '30px' }}>
                  Kolona {col + 1}
                  {column.length === 0 && ' — bosh'}
                </p>
                {column.map((child) => row(child, 2))}
              </React.Fragment>
            ))}
          </React.Fragment>
        ) : (
          row(block, 0)
        )
      )}
    </div>
  );
}

function PageSettings({
  page,
  navGroups,
  onChange,
  onDelete,
  slugTaken,
}: {
  page: CustomPage;
  navGroups: string[];
  onChange: (patch: Partial<CustomPage>) => void;
  onDelete: () => void;
  slugTaken: (slug: string) => boolean;
}) {
  const slug = slugify(page.slug || page.title);
  const listId = React.useId();
  return (
    <div className="grid gap-4">
      <Field label="Titulli (në menu)">
        <Input value={page.title} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>

      <Field label="Adresa">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground shrink-0 text-xs">/app/p/</span>
          <Input
            value={page.slug}
            onChange={(e) => onChange({ slug: e.target.value.toLowerCase() })}
            onBlur={() => onChange({ slug })}
          />
        </div>
        {slugTaken(slug) && <p className="text-destructive text-xs">Kjo adresë përdoret nga një faqe tjetër.</p>}
      </Field>

      <Field label="Grupi në menu">
        <Input
          list={listId}
          value={page.nav_group ?? ''}
          onChange={(e) => onChange({ nav_group: e.target.value })}
          placeholder={DEFAULT_NAV_GROUP}
        />
        <datalist id={listId}>
          {navGroups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <p className="text-muted-foreground text-[11px]">
          Faqet me të njëjtin grup shfaqen bashkë nën këtë titull. Bosh = “{DEFAULT_NAV_GROUP}”.
        </p>
      </Field>

      <Field label="Ikona">
        <div className="grid grid-cols-5 gap-1">
          {PAGE_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              title={ICON_LABELS[icon]}
              aria-label={ICON_LABELS[icon]}
              aria-pressed={page.icon === icon}
              onClick={() => onChange({ icon })}
              className={cn(
                'rounded-md border px-1 py-1.5 text-[10px] transition-colors',
                page.icon === icon ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'
              )}
            >
              {ICON_LABELS[icon]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Dukshmëria">
        <Segmented
          value={page.published ? 'on' : 'off'}
          options={[
            { value: 'off', label: 'Draft' },
            { value: 'on', label: 'Publikuar' },
          ]}
          onChange={(v) => onChange({ published: v === 'on' })}
        />
        <p className="text-muted-foreground text-[11px]">
          {page.published ? 'Klienti e sheh në menu pasi ta ruash.' : 'Vetëm ti e sheh. Publikoje kur të jetë gati.'}
        </p>
      </Field>

      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive justify-self-start"
        onClick={onDelete}
      >
        <Trash2 /> Fshi faqen
      </Button>
    </div>
  );
}
