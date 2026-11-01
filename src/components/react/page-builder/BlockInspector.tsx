import * as React from 'react';
import { Input } from '@/components/ui/react/input';
import { Label } from '@/components/ui/react/label';
import { Textarea } from '@/components/ui/react/textarea';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import { cn } from '@/lib/utils';
import {
  isNumericField,
  safeHref,
  setColumnsLayout,
  type Block,
  type BlockStyle,
  type CollectionSource,
  type ColumnsLayout,
  type CustomCollection,
  type Size,
} from '@/lib/page-builder';

/*
  The editor panel for the selected block, in Elementor's three tabs:
  Përmbajtja (what it says and which data it uses), Stili (how it looks) and
  Të avancuara (where it shows). Every change is applied to the page at once,
  so the canvas is always what the customer gets once the page is saved.
*/

export type InspectorTab = 'content' | 'style' | 'advanced';

interface Props {
  block: Block;
  tab: InspectorTab;
  collections: CustomCollection[];
  onChange: (block: Block) => void;
  onManageCollections: () => void;
}

export default function BlockInspector({ block, tab, collections, onChange, onManageCollections }: Props) {
  // The cast is safe: every caller passes a patch for the block it holds.
  const set = (patch: Partial<Block>) => onChange({ ...block, ...patch } as Block);
  const setStyle = (patch: Partial<BlockStyle>) =>
    onChange({ ...block, style: { ...block.style, ...patch } } as Block);

  if (tab === 'style') return <StyleTab block={block} setStyle={setStyle} />;
  if (tab === 'advanced') return <AdvancedTab block={block} setStyle={setStyle} />;

  const collectionOf = (source: CollectionSource) =>
    collections.find((c) => c.id === source.collectionId);

  return (
    <div className="grid gap-4">
      {block.type === 'columns' && (
        <Field label="Struktura">
          <div className="grid grid-cols-2 gap-1.5">
            {(['1-1', '2-1', '1-2', '1-1-1'] as ColumnsLayout[]).map((layout) => (
              <button
                key={layout}
                type="button"
                aria-pressed={block.layout === layout}
                aria-label={`Kolonat ${layout}`}
                onClick={() => onChange(setColumnsLayout(block, layout))}
                className={cn(
                  'flex h-10 gap-1 rounded-md border p-1.5 transition-colors',
                  block.layout === layout ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                )}
              >
                {layout.split('-').map((part, i) => (
                  <span
                    key={i}
                    className={cn(
                      'rounded-sm',
                      block.layout === layout ? 'bg-primary/40' : 'bg-muted-foreground/25'
                    )}
                    style={{ flexGrow: Number(part) }}
                  />
                ))}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground text-[11px]">
            Në telefon kolonat shfaqen njëra nën tjetrën.
          </p>
        </Field>
      )}

      {block.type === 'heading' && (
        <>
          <Field label="Teksti">
            <Input value={block.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label="Madhësia">
            <Segmented
              value={String(block.level)}
              options={[
                { value: '1', label: 'E madhe' },
                { value: '2', label: 'Mesatare' },
                { value: '3', label: 'E vogël' },
              ]}
              onChange={(v) => set({ level: Number(v) as 1 | 2 | 3 })}
            />
          </Field>
        </>
      )}

      {block.type === 'text' && (
        <>
          <Field label="Teksti">
            <Textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={6} />
          </Field>
          <Field label="Pamja">
            <Segmented
              value={block.tone}
              options={[
                { value: 'default', label: 'Normale' },
                { value: 'muted', label: 'E zbehtë' },
                { value: 'note', label: 'Shënim' },
              ]}
              onChange={(tone) => set({ tone: tone as typeof block.tone })}
            />
          </Field>
        </>
      )}

      {block.type === 'spacer' && (
        <Field label="Lartësia">
          <Segmented
            value={block.size}
            options={[
              { value: 'sm', label: 'E vogël' },
              { value: 'md', label: 'Mesatare' },
              { value: 'lg', label: 'E madhe' },
            ]}
            onChange={(size) => set({ size: size as typeof block.size })}
          />
        </Field>
      )}

      {block.type === 'divider' && (
        <p className="text-muted-foreground text-sm">Ndarësi nuk ka cilësime përmbajtjeje.</p>
      )}

      {block.type === 'button' && (
        <>
          <Field label="Teksti i butonit">
            <Input value={block.label} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label="Lidhja">
            <Input
              value={block.href}
              onChange={(e) => set({ href: e.target.value })}
              placeholder="/app/faturat ose https://…"
            />
            {!safeHref(block.href) && (
              <p className="text-destructive text-xs">
                Lidhja duhet të fillojë me / ose https:// — përndryshe butoni çaktivizohet.
              </p>
            )}
          </Field>
          <Field label="Lloji">
            <Segmented
              value={block.variant}
              options={[
                { value: 'default', label: 'I plotë' },
                { value: 'outline', label: 'Me kornizë' },
              ]}
              onChange={(variant) => set({ variant: variant as typeof block.variant })}
            />
          </Field>
        </>
      )}

      {(block.type === 'form' || block.type === 'table' || block.type === 'stat') && (
        <SourcePicker
          source={block.source}
          collections={collections}
          // Changing the collection drops field choices that belonged to the old one.
          onChange={(source) =>
            set(
              block.type === 'form'
                ? { source, fieldIds: [] }
                : block.type === 'table'
                  ? { source, columnIds: [] }
                  : { source, fieldId: null }
            )
          }
          onManage={onManageCollections}
        />
      )}

      {block.type === 'form' && (
        <>
          <Field label="Titulli">
            <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <FieldChecklist
            label="Fushat e formularit"
            collection={collectionOf(block.source)}
            selected={block.fieldIds}
            onChange={(fieldIds) => set({ fieldIds })}
          />
          <Field label="Teksti i butonit">
            <Input value={block.submitLabel} onChange={(e) => set({ submitLabel: e.target.value })} />
          </Field>
        </>
      )}

      {block.type === 'table' && (
        <>
          <Field label="Titulli">
            <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <FieldChecklist
            label="Kolonat"
            collection={collectionOf(block.source)}
            selected={block.columnIds}
            onChange={(columnIds) => set({ columnIds })}
          />
          <Field label="Mesazhi kur tabela është bosh">
            <Input
              value={block.emptyText ?? ''}
              onChange={(e) => set({ emptyText: e.target.value })}
              placeholder="Nuk ka ende vlera në këtë tabelë."
            />
          </Field>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={block.allowEdit}
              onChange={(e) => set({ allowEdit: e.target.checked })}
              className="accent-primary size-4"
            />
            Klienti mund të ndryshojë dhe fshijë rreshta
          </label>
        </>
      )}

      {block.type === 'stat' && (
        <>
          <Field label="Etiketa">
            <Input value={block.label} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label="Llogaritja">
            <Segmented
              value={block.op}
              options={[
                { value: 'count', label: 'Numri i rreshtave' },
                { value: 'sum', label: 'Shuma e një fushe' },
              ]}
              onChange={(op) => set({ op: op as typeof block.op })}
            />
          </Field>
          {block.op === 'sum' && (
            <Field label="Fusha që mblidhet">
              <SearchableSelect
                value={block.fieldId ?? ''}
                onValueChange={(fieldId) => set({ fieldId })}
                placeholder="Zgjidh një fushë numri"
                searchPlaceholder="Kërko…"
                emptyText="Koleksioni nuk ka fusha numri"
                options={(collectionOf(block.source)?.fields ?? [])
                  .filter(isNumericField)
                  .map((f) => ({
                    value: f.id,
                    label: f.label,
                    hint: f.type === 'formula' ? 'Llogaritje' : undefined,
                  }))}
              />
            </Field>
          )}
        </>
      )}
    </div>
  );
}

// ---- Stili ------------------------------------------------------------------

const SIZES: { value: Size; label: string }[] = [
  { value: 'none', label: 'Asnjë' },
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
];

function StyleTab({ block, setStyle }: { block: Block; setStyle: (p: Partial<BlockStyle>) => void }) {
  const style = block.style ?? {};
  const bg = style.background ?? 'none';
  return (
    <div className="grid gap-4">
      <Field label="Sfondi">
        <div className="grid grid-cols-4 gap-1.5">
          {(
            [
              { value: 'none', label: 'Asnjë', swatch: 'border-dashed' },
              { value: 'card', label: 'Kartë', swatch: 'bg-card shadow-card' },
              { value: 'muted', label: 'Gri', swatch: 'bg-muted' },
              { value: 'brand', label: 'Ngjyrë', swatch: 'bg-brand/15' },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={bg === o.value}
              onClick={() => setStyle({ background: o.value })}
              className={cn(
                'grid gap-1 rounded-md border p-1.5 text-[10px] font-medium transition-colors',
                bg === o.value ? 'border-primary text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <span className={cn('h-5 rounded border', o.swatch)} />
              {o.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Hapësira e brendshme">
        <Segmented
          value={style.padding ?? (bg === 'none' ? 'none' : 'md')}
          options={SIZES}
          onChange={(padding) => setStyle({ padding: padding as Size })}
        />
      </Field>

      {block.type !== 'columns' && (
        <Field label="Rreshtimi">
          <Segmented
            value={style.align ?? 'left'}
            options={[
              { value: 'left', label: 'Majtas' },
              { value: 'center', label: 'Qendër' },
              { value: 'right', label: 'Djathtas' },
            ]}
            onChange={(align) => setStyle({ align: align as BlockStyle['align'] })}
          />
        </Field>
      )}
    </div>
  );
}

// ---- Të avancuara -------------------------------------------------------------

function AdvancedTab({ block, setStyle }: { block: Block; setStyle: (p: Partial<BlockStyle>) => void }) {
  const style = block.style ?? {};
  return (
    <div className="grid gap-4">
      <Field label="Hapësira sipër">
        <Segmented
          value={style.spaceTop ?? 'none'}
          options={SIZES}
          onChange={(spaceTop) => setStyle({ spaceTop: spaceTop as Size })}
        />
      </Field>

      <Field label="Dukshmëria">
        <div className="grid gap-2 rounded-lg border p-3">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={Boolean(style.hideOnDesktop)}
              onChange={(e) => setStyle({ hideOnDesktop: e.target.checked })}
              className="accent-primary size-4"
            />
            Fshihe në kompjuter dhe tablet
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={Boolean(style.hideOnMobile)}
              onChange={(e) => setStyle({ hideOnMobile: e.target.checked })}
              className="accent-primary size-4"
            />
            Fshihe në telefon
          </label>
        </div>
        <p className="text-muted-foreground text-[11px]">
          Kontrolloje me butonat e pajisjeve sipër faqes.
        </p>
      </Field>

      <Field label="ID e elementit">
        <code className="bg-muted rounded px-2 py-1 text-xs">{block.id}</code>
      </Field>
    </div>
  );
}

// ---- Shared -------------------------------------------------------------------

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="bg-muted flex flex-wrap gap-0.5 rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
            value === o.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SourcePicker({
  source,
  collections,
  onChange,
  onManage,
}: {
  source: CollectionSource;
  collections: CustomCollection[];
  onChange: (source: CollectionSource) => void;
  onManage: () => void;
}) {
  return (
    <Field label="Koleksioni">
      <SearchableSelect
        value={source.collectionId ?? ''}
        onValueChange={(collectionId) => onChange({ kind: 'collection', collectionId })}
        placeholder="Zgjidh koleksionin"
        searchPlaceholder="Kërko…"
        emptyText="Ende asnjë koleksion"
        options={collections.map((c) => ({
          value: c.id,
          label: c.name,
          hint: `${c.fields.length} fusha`,
        }))}
      />
      <button
        type="button"
        onClick={onManage}
        className="text-primary justify-self-start text-xs font-medium hover:underline"
      >
        Menaxho koleksionet
      </button>
    </Field>
  );
}

/*
  Which of a collection's fields a form shows, or a table lists. Nothing ticked
  means all of them — so a field added to the collection later shows up
  without revisiting every block that uses it.
*/
function FieldChecklist({
  label,
  collection,
  selected,
  onChange,
}: {
  label: string;
  collection: CustomCollection | undefined;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!collection) return null;
  const all = selected.length === 0;

  function toggle(id: string) {
    const base = all ? collection!.fields.map((f) => f.id) : selected;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    if (next.length === 0) return; // at least one field stays; untick-all would read as "all"
    // Keep the collection's order, and fold "every field" back to empty.
    const ordered = collection!.fields.map((f) => f.id).filter((x) => next.includes(x));
    onChange(ordered.length === collection!.fields.length ? [] : ordered);
  }

  return (
    <Field label={label}>
      {collection.fields.length === 0 ? (
        <p className="text-muted-foreground text-xs">Koleksioni nuk ka ende fusha.</p>
      ) : (
        <div className="grid gap-1.5 rounded-lg border p-2.5">
          {collection.fields.map((f) => (
            <label key={f.id} className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={all || selected.includes(f.id)}
                onChange={() => toggle(f.id)}
                className="accent-primary size-4"
              />
              {f.label}
              {f.type === 'formula' && (
                <span className="text-muted-foreground text-[10px]">llogaritje</span>
              )}
            </label>
          ))}
          <p className="text-muted-foreground mt-1 text-[11px]">
            {all ? 'Të gjitha fushat — edhe ato që shtohen më vonë.' : `${selected.length} të zgjedhura`}
          </p>
        </div>
      )}
    </Field>
  );
}
