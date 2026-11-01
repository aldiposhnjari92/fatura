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
  | 'email'
  | 'tel'
  | 'url'
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
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Telefon' },
  { value: 'url', label: 'Lidhje (URL)' },
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
  /** Played once when the page opens (Elementor's "entrance animation"). */
  animation?: 'none' | 'fade' | 'slide-up' | 'zoom';
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

/*
  The widgets below are this app's own takes on what page builders such as
  Elementor Pro offer, trimmed to what a business back-office page needs.
  None of them embeds a third-party site (the CSP forbids frames) and an
  image may only come from the page-assets bucket (see safeImageSrc).
*/

/** A curated icon set; the names map to icons in page-builder/icons.ts. */
export const WIDGET_ICONS = [
  'check',
  'star',
  'heart',
  'phone',
  'mail',
  'map-pin',
  'clock',
  'calendar',
  'truck',
  'package',
  'shield',
  'zap',
  'users',
  'wallet',
  'chart',
  'gift',
  'award',
  'info',
] as const;
export type WidgetIcon = (typeof WIDGET_ICONS)[number];

export interface ListItem {
  id: string;
  text: string;
}

export interface TitledItem {
  id: string;
  title: string;
  text: string;
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  src: string;
  alt: string;
  caption: string;
  ratio: 'auto' | '16/9' | '4/3' | '1/1';
  fit: 'cover' | 'contain';
  rounded: boolean;
}

export interface IconBoxBlock extends BlockBase {
  type: 'iconbox';
  icon: WidgetIcon;
  title: string;
  text: string;
  layout: 'top' | 'left';
}

export interface AlertBlock extends BlockBase {
  type: 'alert';
  variant: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  text: string;
}

export interface IconListBlock extends BlockBase {
  type: 'iconlist';
  icon: WidgetIcon;
  items: ListItem[];
}

export interface TabsBlock extends BlockBase {
  type: 'tabs';
  items: TitledItem[];
}

export interface AccordionBlock extends BlockBase {
  type: 'accordion';
  items: TitledItem[];
  /** Several open at once (a toggle) rather than one at a time. */
  multiple: boolean;
  firstOpen: boolean;
}

export interface TocBlock extends BlockBase {
  type: 'toc';
  title: string;
  /** The deepest heading level listed. */
  depth: 2 | 3;
}

export interface TestimonialBlock extends BlockBase {
  type: 'testimonial';
  quote: string;
  author: string;
  role: string;
  rating: number;
}

export interface RatingBlock extends BlockBase {
  type: 'rating';
  label: string;
  /** 0–5 in halves. */
  value: number;
}

export interface PriceFeature extends ListItem {
  included: boolean;
}

export interface PriceTableBlock extends BlockBase {
  type: 'pricetable';
  title: string;
  price: string;
  period: string;
  features: PriceFeature[];
  buttonLabel: string;
  buttonHref: string;
  featured: boolean;
  badge: string;
}

export interface PriceItem extends ListItem {
  description: string;
  price: string;
}

export interface PriceListBlock extends BlockBase {
  type: 'pricelist';
  items: PriceItem[];
}

export interface CtaBlock extends BlockBase {
  type: 'cta';
  title: string;
  text: string;
  buttonLabel: string;
  buttonHref: string;
  tone: 'brand' | 'dark' | 'light';
}

export interface FlipBoxBlock extends BlockBase {
  type: 'flipbox';
  icon: WidgetIcon;
  frontTitle: string;
  frontText: string;
  backTitle: string;
  backText: string;
  buttonLabel: string;
  buttonHref: string;
}

export interface CountdownBlock extends BlockBase {
  type: 'countdown';
  title: string;
  /** Local date and time, yyyy-mm-ddThh:mm. */
  target: string;
  doneText: string;
}

export interface ProgressBlock extends BlockBase {
  type: 'progress';
  label: string;
  /** A fixed percentage, or the sum of a field against a target. */
  mode: 'static' | 'goal';
  value: number;
  source: CollectionSource;
  fieldId: string | null;
  target: number;
}

/** Elementor Pro's Loop Grid: one card per record of a collection. */
export interface CardsBlock extends BlockBase {
  type: 'cards';
  title: string;
  source: CollectionSource;
  titleFieldId: string | null;
  subtitleFieldId: string | null;
  valueFieldId: string | null;
  badgeFieldId: string | null;
  perRow: 2 | 3 | 4;
  emptyText: string;
}

/*
  A form built element by element: each field is its own block, placed
  anywhere on the page — even in different columns — and a submit button
  saves them together. Blocks belong to one form when they share a
  collection and a form name; their values live in one shared store on the
  page, so a calculated field updates as the inputs it uses are typed.
*/
export const DEFAULT_FORM = 'Formulari 1';

export interface FieldBlock extends BlockBase {
  type: 'field';
  source: CollectionSource;
  /** The collection field this input writes; null until it is connected. */
  fieldId: string | null;
  /** What it was added as — the type a new collection field gets. */
  kind: FieldType;
  /** Which form on the page it belongs to (with the collection). */
  form: string;
  /** Shown instead of the field's own name when set. */
  label: string;
  placeholder: string;
  hint: string;
}

export interface SubmitBlock extends BlockBase {
  type: 'submit';
  source: CollectionSource;
  form: string;
  label: string;
  successText: string;
  /** Clear the connected fields after a successful save. */
  resetAfter: boolean;
  fullWidth: boolean;
}

/** The key a form's shared values live under. */
export const formKey = (collectionId: string | null, form: string) =>
  `${collectionId ?? ''}::${form.trim() || DEFAULT_FORM}`;

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
  | SpacerBlock
  | ImageBlock
  | IconBoxBlock
  | AlertBlock
  | IconListBlock
  | TabsBlock
  | AccordionBlock
  | TocBlock
  | TestimonialBlock
  | RatingBlock
  | PriceTableBlock
  | PriceListBlock
  | CtaBlock
  | FlipBoxBlock
  | CountdownBlock
  | ProgressBlock
  | CardsBlock
  | FieldBlock
  | SubmitBlock;

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

export type PaletteGroup =
  | 'Struktura'
  | 'Bazë'
  | 'Përmbajtje'
  | 'Marketing'
  | 'Të dhëna'
  | 'Fushat e formularit';

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
  { type: 'image', label: 'Imazh', description: 'Një foto e ngarkuar', group: 'Bazë' },
  { type: 'iconlist', label: 'Listë me ikona', description: 'Pika me ikonë', group: 'Bazë' },
  { type: 'alert', label: 'Njoftim', description: 'Kuti informacioni ose paralajmërimi', group: 'Bazë' },
  { type: 'iconbox', label: 'Kuti me ikonë', description: 'Ikonë, titull dhe tekst', group: 'Përmbajtje' },
  { type: 'tabs', label: 'Skeda', description: 'Përmbajtje në skeda', group: 'Përmbajtje' },
  { type: 'accordion', label: 'Fizarmonikë', description: 'Pyetje që hapen e mbyllen', group: 'Përmbajtje' },
  { type: 'toc', label: 'Përmbajtja', description: 'Lista e titujve të faqes', group: 'Përmbajtje' },
  { type: 'testimonial', label: 'Dëshmi', description: 'Citat me autor', group: 'Përmbajtje' },
  { type: 'rating', label: 'Vlerësim', description: 'Yje 0–5', group: 'Përmbajtje' },
  { type: 'pricetable', label: 'Tabelë çmimi', description: 'Paketë me çmim dhe veçori', group: 'Marketing' },
  { type: 'pricelist', label: 'Listë çmimesh', description: 'Artikuj me çmim', group: 'Marketing' },
  { type: 'cta', label: 'Thirrje për veprim', description: 'Banner me buton', group: 'Marketing' },
  { type: 'flipbox', label: 'Kuti që rrotullohet', description: 'Dy anë, kthehet me hover', group: 'Marketing' },
  { type: 'countdown', label: 'Numërim mbrapsht', description: 'Kohë deri në një datë', group: 'Marketing' },
  { type: 'form', label: 'Formular', description: 'Fusha që ruajnë të dhëna', group: 'Të dhëna' },
  { type: 'table', label: 'Tabelë', description: 'Liston të dhënat e ruajtura', group: 'Të dhëna' },
  { type: 'cards', label: 'Kartela', description: 'Një kartelë për çdo rresht', group: 'Të dhëna' },
  { type: 'stat', label: 'Statistikë', description: 'Numër ose shumë', group: 'Të dhëna' },
  { type: 'progress', label: 'Shirit progresi', description: 'Përqindje ose objektiv', group: 'Të dhëna' },
  { type: 'field', label: 'Fushë', description: 'Një fushë formulari', group: 'Fushat e formularit' },
  { type: 'submit', label: 'Butoni i dërgimit', description: 'Ruan fushat e lidhura', group: 'Fushat e formularit' },
];

/*
  The "Fushat e formularit" palette: one entry per input type, all of them a
  'field' block that remembers what it was added as.
*/
export const FIELD_PALETTE: { kind: FieldType; label: string }[] = [
  { kind: 'text', label: 'Tekst' },
  { kind: 'textarea', label: 'Tekst i gjatë' },
  { kind: 'number', label: 'Numër' },
  { kind: 'date', label: 'Datë' },
  { kind: 'select', label: 'Zgjedhje' },
  { kind: 'checkbox', label: 'Po / Jo' },
  { kind: 'email', label: 'Email' },
  { kind: 'tel', label: 'Telefon' },
  { kind: 'url', label: 'Lidhje' },
  { kind: 'formula', label: 'Llogaritje' },
];

export const COLUMN_COUNTS: Record<ColumnsLayout, number> = {
  '1-1': 2,
  '2-1': 2,
  '1-2': 2,
  '1-1-1': 3,
};

export function createBlock(
  type: BlockType,
  collectionId: string | null = null,
  fieldKind: FieldType = 'text'
): Block {
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
    case 'image':
      return { id, type, src: '', alt: '', caption: '', ratio: 'auto', fit: 'cover', rounded: true };
    case 'iconbox':
      return { id, type, icon: 'star', title: 'Pse ne', text: 'Një përshkrim i shkurtër.', layout: 'top' };
    case 'alert':
      return { id, type, variant: 'info', title: 'Kujdes', text: 'Një mesazh i rëndësishëm.' };
    case 'iconlist':
      return {
        id,
        type,
        icon: 'check',
        items: [
          { id: newId(), text: 'Pika e parë' },
          { id: newId(), text: 'Pika e dytë' },
        ],
      };
    case 'tabs':
      return {
        id,
        type,
        items: [
          { id: newId(), title: 'Skeda 1', text: 'Përmbajtja e skedës së parë.' },
          { id: newId(), title: 'Skeda 2', text: 'Përmbajtja e skedës së dytë.' },
        ],
      };
    case 'accordion':
      return {
        id,
        type,
        multiple: false,
        firstOpen: true,
        items: [
          { id: newId(), title: 'Pyetja e parë?', text: 'Përgjigjja këtu.' },
          { id: newId(), title: 'Pyetja e dytë?', text: 'Përgjigjja këtu.' },
        ],
      };
    case 'toc':
      return { id, type, title: 'Në këtë faqe', depth: 3 };
    case 'testimonial':
      return {
        id,
        type,
        quote: 'Shërbim i shpejtë dhe korrekt.',
        author: 'Emri Mbiemri',
        role: 'Klient',
        rating: 5,
      };
    case 'rating':
      return { id, type, label: 'Vlerësimi', value: 4.5 };
    case 'pricetable':
      return {
        id,
        type,
        title: 'Paketa Standard',
        price: '2 500 Lekë',
        period: 'në muaj',
        features: [
          { id: newId(), text: 'Veçoria e parë', included: true },
          { id: newId(), text: 'Veçoria e dytë', included: true },
          { id: newId(), text: 'Veçoria e tretë', included: false },
        ],
        buttonLabel: 'Zgjidh',
        buttonHref: '/app',
        featured: false,
        badge: '',
      };
    case 'pricelist':
      return {
        id,
        type,
        items: [
          { id: newId(), text: 'Shërbimi i parë', description: 'Përshkrim i shkurtër', price: '1 000 Lekë' },
          { id: newId(), text: 'Shërbimi i dytë', description: 'Përshkrim i shkurtër', price: '1 500 Lekë' },
        ],
      };
    case 'cta':
      return {
        id,
        type,
        title: 'Gati për hapin tjetër?',
        text: 'Një fjali që të bind të veprosh.',
        buttonLabel: 'Fillo tani',
        buttonHref: '/app',
        tone: 'brand',
      };
    case 'flipbox':
      return {
        id,
        type,
        icon: 'zap',
        frontTitle: 'Shpejt',
        frontText: 'Kalo miun për më shumë.',
        backTitle: 'Si funksionon',
        backText: 'Shpjegimi në anën e pasme.',
        buttonLabel: 'Më shumë',
        buttonHref: '/app',
      };
    case 'countdown': {
      const inAWeek = new Date(Date.now() + 7 * 86_400_000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const target = `${inAWeek.getFullYear()}-${pad(inAWeek.getMonth() + 1)}-${pad(inAWeek.getDate())}T09:00`;
      return { id, type, title: 'Afati', target, doneText: 'Afati ka kaluar.' };
    }
    case 'progress':
      return { id, type, label: 'Progresi', mode: 'static', value: 60, source, fieldId: null, target: 100000 };
    case 'field':
      return {
        id,
        type,
        source,
        fieldId: null,
        kind: fieldKind,
        form: DEFAULT_FORM,
        label: '',
        placeholder: '',
        hint: '',
      };
    case 'submit':
      return {
        id,
        type,
        source,
        form: DEFAULT_FORM,
        label: 'Dërgo',
        successText: 'U ruajt me sukses.',
        resetAfter: true,
        fullWidth: false,
      };
    case 'cards':
      return {
        id,
        type,
        title: '',
        source,
        titleFieldId: null,
        subtitleFieldId: null,
        valueFieldId: null,
        badgeFieldId: null,
        perRow: 3,
        emptyText: 'Nuk ka ende të dhëna.',
      };
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
const ANIMATION = {
  none: '',
  fade: 'animate-in fade-in duration-700',
  'slide-up': 'animate-in fade-in slide-in-from-bottom-6 duration-700',
  zoom: 'animate-in fade-in zoom-in-95 duration-700',
} as const;

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
    ANIMATION[style.animation ?? 'none'],
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

/**
 * Images come only from this app's own public bucket: an arbitrary URL would
 * be blocked by the CSP anyway, and refusing it here keeps a stored layout
 * from pointing a customer's browser somewhere else.
 */
export function safeImageSrc(src: string): string | null {
  const base = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  if (!base || !src) return null;
  return src.startsWith(`${base}/storage/v1/object/public/page-assets/`) ? src : null;
}

/** The id a heading carries, so a table of contents can link to it. */
export const headingAnchor = (blockId: string) => `h-${blockId}`;

/** The fields a form or table shows, in the configured order. */
export function pickFields(collection: CustomCollection | undefined, ids: string[]) {
  const fields = collection?.fields ?? [];
  if (ids.length === 0) return fields;
  const byId = new Map(fields.map((f) => [f.id, f]));
  return ids.map((id) => byId.get(id)).filter((f): f is CollectionField => !!f);
}
