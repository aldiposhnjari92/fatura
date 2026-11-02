import type { Block, BlockType, ColumnsLayout, FieldBlock, FieldType, LeafBlock, PaletteGroup } from '@/models/page-builder';

// ---- Blocks -------------------------------------------------------------

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
/*
  A form built element by element: each field is its own block, placed
  anywhere on the page — even in different columns — and a submit button
  saves them together. Blocks belong to one form when they share a
  collection and a form name; their values live in one shared store on the
  page, so a calculated field updates as the inputs it uses are typed.
*/
export const DEFAULT_FORM = 'Formulari 1';

/** The key a form's shared values live under. */
export const formKey = (collectionId: string | null, form: string) =>
  `${collectionId ?? ''}::${form.trim() || DEFAULT_FORM}`;

/** The fields an element-built form is made of: every connected field block on the page. */
export function formMembers(blocks: Block[], key: string): FieldBlock[] {
  return flattenBlocks(blocks).filter(
    (b): b is FieldBlock =>
      b.type === 'field' && !!b.fieldId && formKey(b.source.collectionId, b.form) === key
  );
}

export const DEFAULT_NAV_GROUP = 'Faqet';

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

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
