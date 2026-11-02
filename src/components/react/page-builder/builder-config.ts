import {
  AlignLeft,
  AtSign,
  BadgeDollarSign,
  BellRing,
  Calculator,
  CalendarDays,
  CheckSquare,
  ChevronDownSquare,
  Columns3,
  FlipHorizontal2,
  Hash,
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  ListChecks,
  ListCollapse,
  ListOrdered,
  Megaphone,
  Minus,
  MousePointerClick,
  MoveVertical,
  PanelTop,
  Phone,
  Quote,
  Receipt,
  Send,
  Sigma,
  SquareStack,
  Star,
  Table2,
  TextCursorInput,
  Timer,
  TrendingUp,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { BLOCK_TYPES, FIELD_PALETTE } from '@/lib/page-builder';
import type { Block, BlockType, FieldType, PageIcon, PaletteGroup } from '@/models/page-builder';
import type { PreviewDevice } from '@/models/page-builder-ui';

/* What the editor shows for each block: its icon, its name, where it sits in the palette. */

export const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
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
  field: TextCursorInput,
  submit: Send,
};

/* Each input type gets its own tile in the "Fushat e formularit" palette. */
export const FIELD_ICONS: Record<FieldType, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  date: CalendarDays,
  select: ChevronDownSquare,
  checkbox: CheckSquare,
  email: AtSign,
  tel: Phone,
  url: Link2,
  formula: Calculator,
};

export const BLOCK_LABEL = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b.label])) as Record<
  BlockType,
  string
>;

/*
  The palette's sections, in order. A Record rather than a list so that a new
  PaletteGroup cannot be forgotten here — a group missing from this order is
  never drawn, which is how the form-field tiles once went missing.
*/
const GROUP_ORDER: Record<PaletteGroup, number> = {
  Struktura: 0,
  Bazë: 1,
  Përmbajtje: 2,
  Marketing: 3,
  'Të dhëna': 4,
  'Fushat e formularit': 5,
};
export const PALETTE_GROUPS = (Object.keys(GROUP_ORDER) as PaletteGroup[]).sort(
  (a, b) => GROUP_ORDER[a] - GROUP_ORDER[b]
);

export const ICON_LABELS: Record<PageIcon, string> = {
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

export const DEVICE_WIDTH: Record<PreviewDevice, string> = {
  desktop: 'max-w-none',
  tablet: 'max-w-[768px]',
  mobile: 'max-w-[390px]',
};

/** A one-line name for a block, for the navigator and the canvas tag. */
export function summary(block: Block): string {
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
    case 'field':
      return `${block.label || FIELD_PALETTE.find((f) => f.kind === block.kind)?.label || 'Fushë'} · ${block.form}`;
    case 'submit':
      return `${block.label || 'Dërgo'} · ${block.form}`;
    default:
      return BLOCK_LABEL[block.type];
  }
}
