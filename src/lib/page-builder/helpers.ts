import { safeNextPath } from '@/lib/utils';
import type { PageIcon } from '@/models/page-builder';

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
  if (value.startsWith('/')) return safeNextPath(value, '') || null;
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
