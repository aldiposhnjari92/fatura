import type { PAGE_ICONS, WIDGET_ICONS } from '@/lib/page-builder';

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

export interface BlockBase {
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

export type PaletteGroup =
  'Struktura' | 'Bazë' | 'Përmbajtje' | 'Marketing' | 'Të dhëna' | 'Fushat e formularit';

/** Where a block lives: the page itself, or one column of a columns block. */
export type Container = { kind: 'root' } | { kind: 'column'; blockId: string; col: number };

/*
  + − × ÷, parentheses, decimal constants and {field} references — nothing
  else. A small recursive-descent parser: `Function` / `eval` would let a
  formula reach the page's globals.
*/
export type FormulaToken =
  { t: 'num'; v: number } | { t: 'ref'; v: string } | { t: 'op'; v: string };

export type PageIcon = (typeof PAGE_ICONS)[number];

export interface CollectionDef {
  /** The id the snapshot's blocks refer to; replaced on instantiate. */
  id: string;
  name: string;
  fields: CollectionField[];
}

export interface Snapshot {
  blocks: Block[];
  collections: CollectionDef[];
}

export interface PageTemplate extends Snapshot {
  id: string;
  name: string;
  description: string | null;
  icon: PageIcon;
  /** Built-in starters live in code and cannot be deleted. */
  builtin?: boolean;
}
