import type { BlockStyle, ColumnsLayout, Size, SpacerBlock } from '@/models/page-builder';

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
