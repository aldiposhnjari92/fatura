import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvoiceItem } from '@/lib/types';

/**
 * A product this business has invoiced before.
 *
 * There is no products table: a line item is whatever was typed into an
 * invoice, and the invoices already are the record of what this business
 * sells. Deriving the catalogue from them means it is never empty on the
 * first run and never drifts out of date — the cost is that a product is
 * forgotten only by editing the invoices it appears on.
 */
export interface ProductSuggestion {
  /** As last typed — the casing and accents of the most recent use. */
  description: string;
  /** The price on the most recent line, offered as the default. */
  price: number;
  /** How many invoice lines it has appeared on; the most-used come first. */
  uses: number;
}

/*
  How far back to look and how much to hand the browser. A business on the
  free tier tops out at a few invoices a month, so 300 covers years of them,
  and 200 distinct products is far past what anyone scrolls.
*/
const SCAN_INVOICES = 300;
const MAX_SUGGESTIONS = 200;

/** Fold case and accents so "Kafé" and "kafe" are the same product. */
export function productKey(description: string): string {
  return description
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * The products this owner has invoiced before, most-used first.
 *
 * Newest invoices are scanned first so the price and spelling that win are the
 * most recent ones, while `uses` still counts every line across the scan.
 */
export async function suggestProducts(
  supabase: SupabaseClient,
  ownerId: string
): Promise<ProductSuggestion[]> {
  const { data } = await supabase
    .from('invoices')
    .select('items')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(SCAN_INVOICES);

  const byKey = new Map<string, ProductSuggestion>();

  for (const row of data ?? []) {
    const items = (row?.items ?? []) as InvoiceItem[];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const description = String(item?.description ?? '').trim();
      if (!description) continue;

      const key = productKey(description);
      const seen = byKey.get(key);
      if (seen) {
        seen.uses += 1;
      } else {
        // First sighting is the most recent one, so it sets the spelling
        // and the price everything after it only adds a use to.
        byKey.set(key, { description, price: Number(item?.price) || 0, uses: 1 });
      }
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.uses - a.uses || a.description.localeCompare(b.description))
    .slice(0, MAX_SUGGESTIONS);
}

/**
 * Append a line, or fold it into the one already carrying the same product.
 *
 * A remembered product is entered once: a second entry of it is a quantity
 * change, not a new line. So the quantities add up, and the price entered last
 * wins — that is the one the user just decided on.
 *
 * A price left blank is the exception. The field no longer fills itself in
 * when a product is picked, so blank means "the same as before" far more often
 * than it means "free"; the line keeps the price it had rather than being
 * silently zeroed by a repeat entry.
 */
export function mergeProductLine(
  items: InvoiceItem[],
  line: InvoiceItem
): InvoiceItem[] {
  const at = productLineIndex(items, line.description);
  if (at === items.length) return [...items, line];

  return items.map((item, i) => {
    if (i !== at) return item;
    const entered = Number(line.price) || 0;
    return {
      ...item,
      quantity: (Number(item.quantity) || 0) + (Number(line.quantity) || 0),
      price: entered || Number(item.price) || 0,
    };
  });
}

/** Where `mergeProductLine` puts this product — `items.length` when it is new. */
export function productLineIndex(items: InvoiceItem[], description: string): number {
  const key = productKey(description);
  const at = items.findIndex((item) => productKey(item.description) === key);
  return at === -1 ? items.length : at;
}

/**
 * The saved catalogue plus the products on the invoice being written.
 *
 * A product typed for the first time is remembered the moment it is added to
 * the invoice, not only after a save and a reload — otherwise the second time
 * you need it is the one time the list can't help. A line on the open invoice
 * also carries the freshest price, so it overrides the stored one.
 */
export function mergeProductCatalogue(
  saved: ProductSuggestion[],
  items: InvoiceItem[]
): ProductSuggestion[] {
  const byKey = new Map(saved.map((p) => [productKey(p.description), p]));

  for (const item of items) {
    const description = String(item?.description ?? '').trim();
    if (!description) continue;

    const key = productKey(description);
    byKey.set(key, {
      description,
      price: Number(item?.price) || 0,
      uses: (byKey.get(key)?.uses ?? 0) + 1,
    });
  }

  return [...byKey.values()].sort(
    (a, b) => b.uses - a.uses || a.description.localeCompare(b.description)
  );
}
