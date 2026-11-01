import * as React from 'react';
import { ExternalLink, Loader2, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { NumberInput } from '@/components/ui/react/number-input';
import { Label } from '@/components/ui/react/label';
import { Textarea } from '@/components/ui/react/textarea';
import { DatePicker } from '@/components/ui/react/date-picker';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/react/table';
import { notify } from '@/lib/toast';
import { cn, formatDate, groupThousands } from '@/lib/utils';
import {
  COLUMN_GRID,
  SPACER_HEIGHT,
  isInputField,
  isNumericField,
  numericValue,
  pickFields,
  safeHref,
  styleClasses,
  type Block,
  type CollectionField,
  type CustomCollection,
  type CustomRecord,
  type FormBlock,
  type LeafBlock,
  type RecordValue,
  type StatBlock,
  type TableBlock,
} from '@/lib/page-builder';

/*
  Renders a page's blocks. The same pieces draw the customer's live page and
  the admin's editor canvas; `preview` turns every write into a no-op so the
  editor can show a working-looking form without touching anyone's data.

  Records live in one place per page, so a form and a table on the same
  collection stay in step: a row saved by the form appears in the table below
  it without a reload.

  The root is a container (`@container`): columns stack and "hide on phone"
  applies by the width of the page itself, which is what lets the editor's
  phone preview behave exactly like a phone.
*/

interface Props {
  blocks: Block[];
  collections: CustomCollection[];
  records?: CustomRecord[];
  /** The admin's Parapamje: real rows, but every write switched off. */
  readOnly?: boolean;
}

/** One shared empty list: a fresh `[]` default would re-run the effect below every render. */
const NO_RECORDS: CustomRecord[] = [];

export default function PageBlocks({
  blocks,
  collections,
  records: initial = NO_RECORDS,
  readOnly = false,
}: Props) {
  const [records, setRecords] = React.useState<CustomRecord[]>(initial);
  const byId = React.useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);

  const ctx = React.useMemo<BlockContext>(
    () => ({
      preview: readOnly,
      collection: (id) => (id ? byId.get(id) : undefined),
      rows: (id) => (id ? records.filter((r) => r.collection_id === id) : []),
      onSaved: (row) =>
        setRecords((prev) =>
          prev.some((r) => r.id === row.id)
            ? prev.map((r) => (r.id === row.id ? row : r))
            : [row, ...prev]
        ),
      onDeleted: (id) => setRecords((prev) => prev.filter((r) => r.id !== id)),
    }),
    [byId, records, readOnly]
  );

  // The preview fetches its rows after opening; follow them when they land.
  React.useEffect(() => setRecords(initial), [initial]);

  if (blocks.length === 0) {
    return (
      <p className="text-muted-foreground rounded-2xl border border-dashed px-6 py-16 text-center text-sm">
        Kjo faqe është ende bosh.
      </p>
    );
  }

  return (
    <BlockContextProvider value={ctx}>
      <div className="@container flex flex-col gap-5">
        {blocks.map((block) =>
          block.type === 'columns' ? (
            <div
              key={block.id}
              className={cn('grid gap-5', COLUMN_GRID[block.layout], styleClasses(block.style))}
            >
              {block.columns.map((column, i) => (
                <div key={i} className="flex min-w-0 flex-col gap-5">
                  {column.map((child) => (
                    <StyledLeaf key={child.id} block={child} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <StyledLeaf key={block.id} block={block} />
          )
        )}
      </div>
    </BlockContextProvider>
  );
}

// ---- Context --------------------------------------------------------------

export interface BlockContext {
  preview: boolean;
  collection: (id: string | null) => CustomCollection | undefined;
  rows: (collectionId: string | null) => CustomRecord[];
  onSaved: (row: CustomRecord) => void;
  onDeleted: (id: string) => void;
}

const Ctx = React.createContext<BlockContext | null>(null);
export const BlockContextProvider = Ctx.Provider;

function useBlockContext(): BlockContext {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('BlockView rendered outside a BlockContextProvider');
  return ctx;
}

/** A leaf block inside its style wrapper (background, padding, alignment, visibility). */
export function StyledLeaf({ block }: { block: LeafBlock }) {
  const classes = styleClasses(block.style);
  return classes ? (
    <div className={classes}>
      <BlockView block={block} />
    </div>
  ) : (
    <BlockView block={block} />
  );
}

export function BlockView({ block }: { block: LeafBlock }) {
  const ctx = useBlockContext();

  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
      return (
        <Tag
          className={cn(
            'font-semibold tracking-tight',
            block.level === 1 && 'text-2xl @2xl:text-3xl',
            block.level === 2 && 'text-xl',
            block.level === 3 && 'text-base'
          )}
        >
          {block.text}
        </Tag>
      );
    }
    case 'text':
      return (
        <p
          className={cn(
            'text-sm leading-relaxed whitespace-pre-line',
            block.tone === 'muted' && 'text-muted-foreground',
            block.tone === 'note' && 'border-brand/30 bg-brand/5 rounded-xl border px-4 py-3'
          )}
        >
          {block.text}
        </p>
      );
    case 'divider':
      return <hr className="border-border" />;
    case 'spacer':
      return <div className={SPACER_HEIGHT[block.size]} aria-hidden />;
    case 'button': {
      const href = safeHref(block.href);
      const external = href?.startsWith('http');
      const live = !!href && !ctx.preview;
      return (
        <div>
          <Button asChild={live} variant={block.variant} disabled={!href}>
            {live ? (
              <a href={href!} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {block.label}
                {external && <ExternalLink />}
              </a>
            ) : (
              <span>{block.label}</span>
            )}
          </Button>
        </div>
      );
    }
    case 'form':
      return <FormView block={block} />;
    case 'table':
      return <TableView block={block} />;
    case 'stat':
      return <StatView block={block} />;
  }
}

// ---- Shared bits --------------------------------------------------------

function Missing({ what }: { what: string }) {
  return (
    <p className="border-warning/40 bg-warning/10 rounded-xl border px-4 py-3 text-left text-sm">
      {what} nuk ka një koleksion të lidhur.
    </p>
  );
}

type Values = Record<string, RecordValue>;

function emptyValues(fields: CollectionField[]): Values {
  return Object.fromEntries(
    fields
      .filter(isInputField)
      .map((f) => [f.id, f.type === 'checkbox' ? false : f.type === 'number' ? 0 : ''])
  );
}

/** Only what a person typed — formula results are never stored. */
function storable(fields: CollectionField[], values: Values): Values {
  const keep = new Set(fields.filter(isInputField).map((f) => f.id));
  return Object.fromEntries(Object.entries(values).filter(([k]) => keep.has(k)));
}

function missingRequired(fields: CollectionField[], values: Values): CollectionField | undefined {
  return fields.find(
    (f) =>
      f.required &&
      isInputField(f) &&
      f.type !== 'checkbox' &&
      (values[f.id] === '' || values[f.id] === null || values[f.id] === undefined)
  );
}

function formatNumber(n: number): string {
  const whole = groupThousands(Math.trunc(n));
  const cents = Math.round(Math.abs(n % 1) * 100);
  const sign = n < 0 && Math.trunc(n) === 0 ? '-' : '';
  return cents ? `${sign}${whole},${String(cents).padStart(2, '0')}` : `${sign}${whole}`;
}

/** A record's value for one field, as text — formulas worked out. */
export function formatValue(
  field: CollectionField,
  data: Values,
  fields: CollectionField[]
): string {
  if (isNumericField(field)) {
    const n = numericValue(field, data, fields);
    if (field.type === 'number' && (data[field.id] === '' || data[field.id] == null)) return '—';
    return n === null ? '—' : formatNumber(n);
  }
  const value = data[field.id];
  if (value === null || value === undefined || value === '') return '—';
  switch (field.type) {
    case 'date':
      return formatDate(String(value));
    case 'checkbox':
      return value ? 'Po' : 'Jo';
    default:
      return String(value);
  }
}

function FieldInput({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: CollectionField;
  value: RecordValue;
  onChange: (value: RecordValue) => void;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${field.id}`;
  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.required && field.type !== 'checkbox' ? ' *' : ''}
    </Label>
  );

  switch (field.type) {
    case 'textarea':
      return (
        <div className="space-y-1.5 @lg:col-span-2">
          {label}
          <Textarea id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} rows={3} />
        </div>
      );
    case 'number':
      return (
        <div className="space-y-1.5">
          {label}
          <NumberInput id={id} value={Number(value) || 0} onValueChange={onChange} decimal className="text-right" />
        </div>
      );
    case 'date':
      return (
        <div className="space-y-1.5">
          {label}
          <DatePicker
            id={id}
            value={String(value ?? '')}
            onChange={onChange}
            clearable={!field.required}
            aria-label={field.label}
          />
        </div>
      );
    case 'select':
      return (
        <div className="space-y-1.5">
          {label}
          <SearchableSelect
            id={id}
            value={String(value ?? '')}
            onValueChange={onChange}
            options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
            placeholder="Zgjidh…"
            searchPlaceholder="Kërko…"
            emptyText="Asnjë rezultat"
          />
        </div>
      );
    case 'checkbox':
      return (
        <label htmlFor={id} className="flex items-center gap-2.5 self-end py-2 text-sm font-medium">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-primary size-4"
          />
          {field.label}
        </label>
      );
    default:
      return (
        <div className="space-y-1.5">
          {label}
          <Input id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
  }
}

function FieldGrid({
  fields,
  allFields,
  values,
  setValues,
  idPrefix,
}: {
  fields: CollectionField[];
  /** Every field of the collection — formulas may use ones the form hides. */
  allFields: CollectionField[];
  values: Values;
  setValues: (next: Values) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-4 text-left @lg:grid-cols-2">
      {fields.map((field) =>
        field.type === 'formula' ? (
          // Worked out live as the inputs it uses are typed.
          <div key={field.id} className="space-y-1.5">
            <p className="text-sm leading-none font-medium">{field.label}</p>
            <output className="bg-muted flex h-10 items-center justify-end rounded-md px-3 text-sm font-semibold tabular-nums">
              {formatValue(field, values, allFields)}
            </output>
          </div>
        ) : (
          <FieldInput
            key={field.id}
            field={field}
            value={values[field.id] ?? null}
            onChange={(v) => setValues({ ...values, [field.id]: v })}
            idPrefix={idPrefix}
          />
        )
      )}
    </div>
  );
}

async function saveRecord(collectionId: string, data: Values, recordId: string | null): Promise<CustomRecord> {
  if (recordId) {
    const { data: row, error } = await supabase
      .from('custom_records')
      .update({ data })
      .eq('id', recordId)
      .select()
      .single();
    if (error) throw error;
    return row as CustomRecord;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesioni skadoi. Hyr sërish.');
  const { data: row, error } = await supabase
    .from('custom_records')
    .insert({ owner_id: user.id, collection_id: collectionId, data })
    .select()
    .single();
  if (error) throw error;
  return row as CustomRecord;
}

// ---- Form ---------------------------------------------------------------

function FormView({ block }: { block: FormBlock }) {
  const ctx = useBlockContext();
  const collection = ctx.collection(block.source.collectionId);
  const allFields = collection?.fields ?? [];
  const fields = pickFields(collection, block.fieldIds);
  const [values, setValues] = React.useState<Values>(() => emptyValues(fields));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The admin reconfiguring fields in the editor must not leave stale keys.
  const fieldKey = fields.map((f) => f.id).join('|');
  React.useEffect(() => setValues(emptyValues(fields)), [fieldKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!collection) return <Missing what="Formulari" />;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const missing = missingRequired(fields, values);
    if (missing) {
      setError(`Plotëso fushën "${missing.label}".`);
      return;
    }
    setError(null);
    if (ctx.preview) {
      notify.info('Parapamje', 'Këtu formulari nuk ruan asgjë.');
      return;
    }
    setSaving(true);
    try {
      const row = await saveRecord(collection!.id, storable(allFields, values), null);
      ctx.onSaved(row);
      setValues(emptyValues(fields));
      notify.success('U ruajt.', `Një rresht i ri te ${collection!.name}.`);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      notify.error('Nuk u ruajt', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card shadow-card grid gap-4 rounded-2xl p-5 text-left">
      {block.title && <h2 className="text-base font-semibold">{block.title}</h2>}
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-sm">Koleksioni nuk ka ende fusha.</p>
      ) : (
        <FieldGrid
          fields={fields}
          allFields={allFields}
          values={values}
          setValues={setValues}
          idPrefix={block.id}
        />
      )}
      {error && <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>}
      <div>
        <Button type="submit" disabled={saving || fields.filter(isInputField).length === 0}>
          {saving && <Loader2 className="animate-spin" />}
          {block.submitLabel || 'Ruaj'}
        </Button>
      </div>
    </form>
  );
}

// ---- Table --------------------------------------------------------------

function TableView({ block }: { block: TableBlock }) {
  const ctx = useBlockContext();
  const collection = ctx.collection(block.source.collectionId);
  const rows = ctx.rows(block.source.collectionId);
  const columns = pickFields(collection, block.columnIds);
  const allFields = collection?.fields ?? [];
  const [editing, setEditing] = React.useState<{ id: string; values: Values } | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<CustomRecord | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!collection) return <Missing what="Tabela" />;

  const canEdit = block.allowEdit;
  const span = columns.length + (canEdit ? 1 : 0);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const missing = missingRequired(allFields, editing.values);
    if (missing) {
      notify.error('Mungon një fushë', `Plotëso "${missing.label}".`);
      return;
    }
    setBusy(true);
    try {
      ctx.onSaved(await saveRecord(collection!.id, storable(allFields, editing.values), editing.id));
      setEditing(null);
      notify.success('U ruajt.', 'Ndryshimet u ruajtën.');
    } catch (err) {
      notify.error('Nuk u ruajt', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('custom_records').delete().eq('id', pendingDelete.id);
      if (error) throw error;
      ctx.onDeleted(pendingDelete.id);
      setPendingDelete(null);
      notify.success('U fshi.', 'Rreshti u hoq.');
    } catch (err) {
      notify.error('Nuk u fshi', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 text-left">
      {block.title && <h2 className="text-base font-semibold">{block.title}</h2>}
      <div className="bg-card shadow-card overflow-hidden rounded-2xl">
        {columns.length === 0 ? (
          <p className="text-muted-foreground px-6 py-10 text-center text-sm">
            Koleksioni nuk ka ende fusha.
          </p>
        ) : (
          /*
            The header is always there, rows or not: it is what tells the
            customer what the table is for before the first row exists.
          */
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((field) => (
                    <TableHead key={field.id} className={cn(isNumericField(field) && 'text-right')}>
                      {field.label}
                    </TableHead>
                  ))}
                  {canEdit && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={span} className="text-muted-foreground py-10 text-center">
                      {block.emptyText || 'Nuk ka ende vlera në këtë tabelë.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      {columns.map((field) => (
                        <TableCell
                          key={field.id}
                          className={cn(
                            'max-w-[18rem] truncate',
                            isNumericField(field) && 'text-right tabular-nums',
                            field.type === 'formula' && 'font-medium'
                          )}
                        >
                          {formatValue(field, row.data, allFields)}
                        </TableCell>
                      ))}
                      {canEdit && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Ndrysho rreshtin"
                              disabled={ctx.preview}
                              onClick={() =>
                                setEditing({ id: row.id, values: { ...emptyValues(allFields), ...row.data } })
                              }
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Fshi rreshtin"
                              disabled={ctx.preview}
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setPendingDelete(row)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !busy && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ndrysho rreshtin</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleSave} className="@container grid gap-4">
              <FieldGrid
                fields={allFields}
                allFields={allFields}
                values={editing.values}
                setValues={(values) => setEditing({ ...editing, values })}
                idPrefix={`${block.id}-edit`}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                  Anulo
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />}
                  Ruaj
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && !busy && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta fshijmë këtë rresht?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">Ky veprim nuk kthehet mbrapsht.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={busy}>
              Anulo
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Po, fshije
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ---- Stat ---------------------------------------------------------------

function StatView({ block }: { block: StatBlock }) {
  const ctx = useBlockContext();
  const collection = ctx.collection(block.source.collectionId);
  const rows = ctx.rows(block.source.collectionId);
  if (!collection) return <Missing what="Statistika" />;

  const field = collection.fields.find((f) => f.id === block.fieldId);
  const value =
    block.op === 'sum' && field
      ? formatNumber(
          rows.reduce((sum, r) => sum + (numericValue(field, r.data, collection.fields) ?? 0), 0)
        )
      : groupThousands(rows.length);

  return (
    <div className="bg-card shadow-card rounded-2xl px-5 py-4 text-left">
      <p className="text-muted-foreground text-xs font-medium">{block.label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
