/*
  Page builder — the shared vocabulary of the admin editor and the customer's
  rendered page (supabase/migrations/0024_page_builder.sql, 0025_page_builder_phase2.sql).

  A page is a list of blocks. A `columns` block holds further blocks in two or
  three columns — one level deep, never columns inside columns. Every block
  type the renderer knows is listed here; anything else in the stored JSON is
  skipped, never guessed at. Text is always rendered as text — there is no
  HTML block — styles are a fixed set of choices mapped to classes rather than
  raw CSS, links are checked by safeHref(), and formulas are parsed here, never
  eval'd. A layout can describe a page but never carry code into one.
*/

// ---- Collections ------------------------------------------------------

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'formula';

export interface CollectionField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Choices for a `select` field. */
  options?: string[];
  /**
   * For a `formula` field: arithmetic over other number fields, stored with
   * field ids — `{a1b2c3d4} * {e5f6a7b8}`. Shown to the admin with labels.
   * Computed when shown, never stored on the record, so it cannot go stale.
   */
  formula?: string;
}

export interface CustomCollection {
  id: string;
  owner_id: string;
  name: string;
  fields: CollectionField[];
  created_at: string;
  updated_at: string;
}

export type RecordValue = string | number | boolean | null;

export interface CustomRecord {
  id: string;
  owner_id: string;
  collection_id: string;
  data: Record<string, RecordValue>;
  created_at: string;
  updated_at: string;
}

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Tekst' },
  { value: 'textarea', label: 'Tekst i gjatë' },
  { value: 'number', label: 'Numër' },
  { value: 'date', label: 'Datë' },
  { value: 'select', label: 'Zgjedhje' },
  { value: 'checkbox', label: 'Po / Jo' },
  { value: 'formula', label: 'Llogaritje' },
];

/** Fields a person types into — a formula is worked out, not entered. */
export const isInputField = (f: CollectionField) => f.type !== 'formula';

/** Fields whose value is a number: what a formula or a sum can use. */
export const isNumericField = (f: CollectionField) => f.type === 'number' || f.type === 'formula';

// ---- Blocks -------------------------------------------------------------

/*
  Where a table, form or stat reads its rows from. Phase 1 and 2 know one
  source, the customer's own collections; invoices or clients later become
  another `kind` here rather than a new block type.
*/
export interface CollectionSource {
  kind: 'collection';
  collectionId: string | null;
}

/*
  The Stili and Të avancuara tabs. Every value is one of a few named choices
  that map to classes in styleClasses() — the admin picks, never types CSS.
*/
export type Size = 'none' | 'sm' | 'md' | 'lg';

export interface BlockStyle {
  align?: 'left' | 'center' | 'right';
  background?: 'none' | 'card' | 'muted' | 'brand';
  padding?: Size;
  /** Space above the block, on top of the page's normal gap. */
  spaceTop?: Size;
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
}

interface BlockBase {
  id: string;
  style?: BlockStyle;
}

export interface HeadingBlock extends BlockBase {
  type: 'heading';
  text: string;
  level: 1 | 2 | 3;
}

export interface TextBlock extends BlockBase {
  type: 'text';
  text: string;
  tone: 'default' | 'muted' | 'note';
}

export interface FormBlock extends BlockBase {
  type: 'form';
  title: string;
  source: CollectionSource;
  /** Field ids to show, in order. Empty means every field of the collection. */
  fieldIds: string[];
  submitLabel: string;
}

export interface TableBlock extends BlockBase {
  type: 'table';
  title: string;
  source: CollectionSource;
  /** Field ids shown as columns. Empty means every field of the collection. */
  columnIds: string[];
  /** Lets the customer edit and delete rows from the table itself. */
  allowEdit: boolean;
  /** Shown under the header row while the collection has no rows. */
  emptyText: string;
}

export interface StatBlock extends BlockBase {
  type: 'stat';
  label: string;
  source: CollectionSource;
  op: 'count' | 'sum';
  /** The number (or formula) field summed when `op` is 'sum'. */
  fieldId: string | null;
}

export interface ButtonBlock extends BlockBase {
  type: 'button';
  label: string;
  href: string;
  variant: 'default' | 'outline';
}

export interface DividerBlock extends BlockBase {
  type: 'divider';
}

export interface SpacerBlock extends BlockBase {
  type: 'spacer';
  size: Exclude<Size, 'none'>;
}

export type ColumnsLayout = '1-1' | '2-1' | '1-2' | '1-1-1';

export interface ColumnsBlock extends BlockBase {
  type: 'columns';
  layout: ColumnsLayout;
  /** One array of blocks per column; never contains another `columns`. */
  columns: LeafBlock[][];
}

export type LeafBlock =
  | HeadingBlock
  | TextBlock
  | FormBlock
  | TableBlock
  | StatBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock;

export type Block = LeafBlock | ColumnsBlock;
export type BlockType = Block['type'];

export interface CustomPage {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  icon: PageIcon;
  /** The sidebar heading this page sits under; null means "Faqet". */
  nav_group: string | null;
  position: number;
  published: boolean;
  blocks: Block[];
  created_at: string;
  updated_at: string;
}

/** What the sidebar needs — app_bootstrap() returns only this much. */
export type CustomPageNav = Pick<
  CustomPage,
  'id' | 'slug' | 'title' | 'icon' | 'position' | 'nav_group'
>;

export const DEFAULT_NAV_GROUP = 'Faqet';

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

export type PaletteGroup = 'Struktura' | 'Bazë' | 'Të dhëna';

/** The palette, grouped and ordered the way the editor offers it. */
export const BLOCK_TYPES: {
  type: BlockType;
  label: string;
  description: string;
  group: PaletteGroup;
}[] = [
  { type: 'columns', label: 'Kolona', description: 'Ndaje rreshtin në 2 ose 3', group: 'Struktura' },
  { type: 'spacer', label: 'Hapësirë', description: 'Hapësirë bosh', group: 'Struktura' },
  { type: 'divider', label: 'Ndarës', description: 'Vijë ndarëse', group: 'Struktura' },
  { type: 'heading', label: 'Titull', description: 'Një titull seksioni', group: 'Bazë' },
  { type: 'text', label: 'Tekst', description: 'Një paragraf ose shënim', group: 'Bazë' },
  { type: 'button', label: 'Buton', description: 'Lidhje me një faqe', group: 'Bazë' },
  { type: 'form', label: 'Formular', description: 'Fusha që ruajnë të dhëna', group: 'Të dhëna' },
  { type: 'table', label: 'Tabelë', description: 'Liston të dhënat e ruajtura', group: 'Të dhëna' },
  { type: 'stat', label: 'Statistikë', description: 'Numër ose shumë', group: 'Të dhëna' },
];

export const COLUMN_COUNTS: Record<ColumnsLayout, number> = {
  '1-1': 2,
  '2-1': 2,
  '1-2': 2,
  '1-1-1': 3,
};

export function createBlock(type: BlockType, collectionId: string | null = null): Block {
  const id = newId();
  const source: CollectionSource = { kind: 'collection', collectionId };
  switch (type) {
    case 'heading':
      return { id, type, text: 'Titull i ri', level: 2 };
    case 'text':
      return { id, type, text: 'Shkruaj tekstin këtu.', tone: 'default' };
    case 'form':
      return { id, type, title: 'Shto të dhëna', source, fieldIds: [], submitLabel: 'Ruaj' };
    case 'table':
      return {
        id,
        type,
        title: 'Të dhënat',
        source,
        columnIds: [],
        allowEdit: true,
        emptyText: 'Nuk ka ende vlera në këtë tabelë.',
      };
    case 'stat':
      return { id, type, label: 'Gjithsej', source, op: 'count', fieldId: null };
    case 'button':
      return { id, type, label: 'Hap', href: '/app', variant: 'default' };
    case 'divider':
      return { id, type };
    case 'spacer':
      return { id, type, size: 'md' };
    case 'columns':
      return { id, type, layout: '1-1', columns: [[], []] };
  }
}

const LEAF_TYPES = new Set<string>(
  BLOCK_TYPES.filter((b) => b.type !== 'columns').map((b) => b.type)
);

function isLeaf(b: unknown): b is LeafBlock {
  return (
    !!b &&
    typeof b === 'object' &&
    typeof (b as Block).id === 'string' &&
    LEAF_TYPES.has((b as Block).type)
  );
}

/** Stored JSON in, only blocks the renderer knows out — at both levels. */
export function knownBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  const out: Block[] = [];
  for (const b of value) {
    if (isLeaf(b)) {
      out.push(b);
    } else if (b && typeof b === 'object' && b.type === 'columns' && typeof b.id === 'string') {
      const layout: ColumnsLayout = b.layout in COLUMN_COUNTS ? b.layout : '1-1';
      const count = COLUMN_COUNTS[layout];
      const cols = Array.isArray(b.columns) ? b.columns : [];
      out.push({
        ...b,
        layout,
        columns: Array.from({ length: count }, (_, i) =>
          Array.isArray(cols[i]) ? cols[i].filter(isLeaf) : []
        ),
      });
    }
  }
  return out;
}

/** Every block on the page, columns' children included. */
export function flattenBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((b) => (b.type === 'columns' ? [b, ...b.columns.flat()] : [b]));
}

// ---- Tree editing (pure; the editor's every change goes through these) ---

/** Where a block lives: the page itself, or one column of a columns block. */
export type Container = { kind: 'root' } | { kind: 'column'; blockId: string; col: number };

export const ROOT: Container = { kind: 'root' };

export function sameContainer(a: Container, b: Container) {
  return a.kind === 'root'
    ? b.kind === 'root'
    : b.kind === 'column' && a.blockId === b.blockId && a.col === b.col;
}

export function findBlock(blocks: Block[], id: string): Block | undefined {
  return flattenBlocks(blocks).find((b) => b.id === id);
}

/** The container a block sits in and its index there. */
export function locate(blocks: Block[], id: string): { container: Container; index: number } | null {
  const top = blocks.findIndex((b) => b.id === id);
  if (top !== -1) return { container: ROOT, index: top };
  for (const b of blocks) {
    if (b.type !== 'columns') continue;
    for (let col = 0; col < b.columns.length; col += 1) {
      const index = b.columns[col].findIndex((c) => c.id === id);
      if (index !== -1) return { container: { kind: 'column', blockId: b.id, col }, index };
    }
  }
  return null;
}

export function childrenOf(blocks: Block[], container: Container): Block[] {
  if (container.kind === 'root') return blocks;
  const parent = blocks.find((b) => b.id === container.blockId);
  return parent?.type === 'columns' ? (parent.columns[container.col] ?? []) : [];
}

function withChildren(blocks: Block[], container: Container, children: Block[]): Block[] {
  if (container.kind === 'root') return children;
  return blocks.map((b) =>
    b.id === container.blockId && b.type === 'columns'
      ? {
          ...b,
          columns: b.columns.map((col, i) =>
            i === container.col ? (children.filter((c) => c.type !== 'columns') as LeafBlock[]) : col
          ),
        }
      : b
  );
}

export function insertAt(blocks: Block[], container: Container, index: number, block: Block): Block[] {
  // Columns inside a column would be a second level; it goes in after the parent instead.
  if (block.type === 'columns' && container.kind === 'column') {
    const at = blocks.findIndex((b) => b.id === container.blockId);
    return insertAt(blocks, ROOT, at + 1, block);
  }
  const children = [...childrenOf(blocks, container)];
  children.splice(Math.max(0, Math.min(index, children.length)), 0, block);
  return withChildren(blocks, container, children);
}

export function removeBlock(blocks: Block[], id: string): Block[] {
  const where = locate(blocks, id);
  if (!where) return blocks;
  const children = childrenOf(blocks, where.container).filter((b) => b.id !== id);
  return withChildren(blocks, where.container, children);
}

export function replaceBlock(blocks: Block[], updated: Block): Block[] {
  const where = locate(blocks, updated.id);
  if (!where) return blocks;
  const children = childrenOf(blocks, where.container).map((b) => (b.id === updated.id ? updated : b));
  return withChildren(blocks, where.container, children);
}

/** Move a block to `index` in `to` — the index as it reads before the move. */
export function moveBlock(blocks: Block[], id: string, to: Container, index: number): Block[] {
  const where = locate(blocks, id);
  const block = findBlock(blocks, id);
  if (!where || !block) return blocks;
  // A columns block cannot be dropped into its own columns.
  if (to.kind === 'column' && to.blockId === id) return blocks;
  let at = index;
  if (sameContainer(where.container, to)) {
    if (at === where.index || at === where.index + 1) return blocks;
    if (at > where.index) at -= 1;
  }
  return insertAt(removeBlock(blocks, id), to, at, block);
}

/** A deep copy with fresh ids, so a duplicate never shares an id with its source. */
export function cloneBlock(block: Block): Block {
  if (block.type === 'columns') {
    return {
      ...block,
      id: newId(),
      columns: block.columns.map((col) => col.map((c) => cloneBlock(c) as LeafBlock)),
    };
  }
  return { ...structuredClone(block), id: newId() };
}

/** A layout change keeps every child: a dropped column's blocks join the last kept one. */
export function setColumnsLayout(block: ColumnsBlock, layout: ColumnsLayout): ColumnsBlock {
  const count = COLUMN_COUNTS[layout];
  const columns = Array.from({ length: count }, (_, i) => [...(block.columns[i] ?? [])]);
  for (let i = count; i < block.columns.length; i += 1) columns[count - 1].push(...block.columns[i]);
  return { ...block, layout, columns };
}

// ---- Style ----------------------------------------------------------------

/*
  Literal class strings, so Tailwind sees every one of them at build time.
  `@…` variants are container queries against the page, not the window, which
  is what lets the editor's phone preview stack and hide exactly like a phone.
*/
const PADDING: Record<Size, string> = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-8' };
const SPACE_TOP: Record<Size, string> = { none: '', sm: 'mt-2', md: 'mt-6', lg: 'mt-12' };
const BACKGROUND = {
  none: '',
  card: 'bg-card shadow-card rounded-2xl',
  muted: 'bg-muted rounded-2xl',
  brand: 'bg-brand/10 rounded-2xl',
} as const;
const ALIGN = { left: '', center: 'text-center', right: 'text-right' } as const;

export function styleClasses(style: BlockStyle | undefined): string {
  if (!style) return '';
  const bg = style.background ?? 'none';
  return [
    BACKGROUND[bg],
    // A background with no padding would put text against its edge.
    PADDING[style.padding ?? (bg === 'none' ? 'none' : 'md')],
    SPACE_TOP[style.spaceTop ?? 'none'],
    ALIGN[style.align ?? 'left'],
    style.hideOnMobile ? '@max-2xl:hidden' : '',
    style.hideOnDesktop ? '@2xl:hidden' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export const COLUMN_GRID: Record<ColumnsLayout, string> = {
  '1-1': '@2xl:grid-cols-2',
  '2-1': '@2xl:grid-cols-[2fr_1fr]',
  '1-2': '@2xl:grid-cols-[1fr_2fr]',
  '1-1-1': '@2xl:grid-cols-3',
};

export const SPACER_HEIGHT: Record<SpacerBlock['size'], string> = {
  sm: 'h-4',
  md: 'h-10',
  lg: 'h-20',
};

// ---- Formulas -------------------------------------------------------------

/*
  + − × ÷, parentheses, decimal constants and {field} references — nothing
  else. A small recursive-descent parser: `Function` / `eval` would let a
  formula reach the page's globals.
*/
type Token = { t: 'num'; v: number } | { t: 'ref'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Token[] | null {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if ('+-*/()×÷−'.includes(ch)) {
      out.push({ t: 'op', v: ch === '×' ? '*' : ch === '÷' ? '/' : ch === '−' ? '-' : ch });
      i += 1;
    } else if (ch === '{') {
      const end = src.indexOf('}', i);
      if (end === -1) return null;
      out.push({ t: 'ref', v: src.slice(i + 1, end).trim() });
      i = end + 1;
    } else if (/[\d.,]/.test(ch)) {
      let j = i;
      while (j < src.length && /[\d.,]/.test(src[j])) j += 1;
      const n = Number(src.slice(i, j).replace(',', '.'));
      if (!Number.isFinite(n)) return null;
      out.push({ t: 'num', v: n });
      i = j;
    } else {
      return null;
    }
  }
  return out;
}

/**
 * Evaluates a stored formula against a record's values. Returns null when the
 * formula is malformed or divides by zero — shown as "—", never as a crash.
 */
export function evaluateFormula(
  formula: string,
  resolve: (ref: string) => number
): number | null {
  const parsed = tokenize(formula);
  if (!parsed || parsed.length === 0) return null;
  const tokens: Token[] = parsed;
  let pos = 0;
  const peek = () => tokens[pos];

  function primary(): number | null {
    const tok = tokens[pos++];
    if (!tok) return null;
    if (tok.t === 'num') return tok.v;
    if (tok.t === 'ref') return resolve(tok.v);
    if (tok.v === '-') {
      const v = primary();
      return v === null ? null : -v;
    }
    if (tok.v === '(') {
      const v = sum();
      if (peek()?.t !== 'op' || peek()?.v !== ')') return null;
      pos += 1;
      return v;
    }
    return null;
  }

  function product(): number | null {
    let left = primary();
    while (left !== null && peek()?.t === 'op' && (peek()!.v === '*' || peek()!.v === '/')) {
      const op = tokens[pos++].v;
      const right = primary();
      if (right === null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function sum(): number | null {
    let left = product();
    while (left !== null && peek()?.t === 'op' && (peek()!.v === '+' || peek()!.v === '-')) {
      const op = tokens[pos++].v;
      const right = product();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  const result = sum();
  if (pos !== tokens.length || result === null || !Number.isFinite(result)) return null;
  return Math.round(result * 100) / 100;
}

/** A field's numeric value on a record — formulas worked out, one level deep. */
export function numericValue(
  field: CollectionField,
  data: Record<string, RecordValue>,
  fields: CollectionField[],
  depth = 0
): number | null {
  if (field.type === 'formula') {
    // A formula may use another formula, but not loop back on itself forever.
    if (depth > 4 || !field.formula) return null;
    return evaluateFormula(field.formula, (ref) => {
      const other = fields.find((f) => f.id === ref);
      return other ? (numericValue(other, data, fields, depth + 1) ?? 0) : 0;
    });
  }
  const n = Number(data[field.id]);
  return Number.isFinite(n) ? n : null;
}

/** `{a1b2} * {c3d4}` → `{Kosto} * {Sasia}`, for the admin to read and edit. */
export function formulaToLabels(formula: string, fields: CollectionField[]): string {
  return formula.replace(/\{([^}]*)\}/g, (_, ref: string) => {
    const f = fields.find((x) => x.id === ref.trim());
    return `{${f ? f.label : ref}}`;
  });
}

/**
 * `{Kosto} * {Sasia}` → `{a1b2} * {c3d4}`. Returns the unknown label instead
 * when one does not match a number field, so the dialog can say which.
 */
export function formulaToIds(
  text: string,
  fields: CollectionField[]
): { formula: string } | { unknown: string } {
  let unknown: string | null = null;
  const formula = text.replace(/\{([^}]*)\}/g, (_, label: string) => {
    const f = fields.find(
      (x) => isNumericField(x) && x.label.trim().toLowerCase() === label.trim().toLowerCase()
    );
    if (!f) unknown ??= label.trim();
    return `{${f ? f.id : label}}`;
  });
  return unknown !== null ? { unknown } : { formula };
}

// ---- Page icons ---------------------------------------------------------

export const PAGE_ICONS = [
  'file',
  'clipboard-list',
  'table',
  'package',
  'shopping-cart',
  'calendar',
  'wallet',
  'star',
  'truck',
  'users',
] as const;

export type PageIcon = (typeof PAGE_ICONS)[number];

export function isPageIcon(value: unknown): value is PageIcon {
  return PAGE_ICONS.includes(value as PageIcon);
}

// ---- Helpers ------------------------------------------------------------

/** "Porositë e Javës" → "porosite-e-javes". Matches the slug check in SQL. */
export function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'faqe'
  );
}

/**
 * Only same-site paths and http(s) links survive. A `javascript:` URL typed
 * into a button would otherwise run in the customer's session.
 */
export function safeHref(href: string): string | null {
  const value = href.trim();
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** The fields a form or table shows, in the configured order. */
export function pickFields(collection: CustomCollection | undefined, ids: string[]) {
  const fields = collection?.fields ?? [];
  if (ids.length === 0) return fields;
  const byId = new Map(fields.map((f) => [f.id, f]));
  return ids.map((id) => byId.get(id)).filter((f): f is CollectionField => !!f);
}
