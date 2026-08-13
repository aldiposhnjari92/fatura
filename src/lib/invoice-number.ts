import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Suggest the next invoice number for this business, e.g. FAT-2025-004.
 * Prefers the SQL helper; falls back to a client-side scan so a missing
 * migration degrades to a working suggestion rather than a crash.
 */
export async function suggestInvoiceNumber(
  supabase: SupabaseClient,
  ownerId: string,
  year = new Date().getFullYear()
): Promise<string> {
  const { data, error } = await supabase.rpc('next_invoice_number', { p_year: year });
  if (!error && typeof data === 'string' && data) return data;

  const prefix = `FAT-${year}-`;
  const { data: rows } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('owner_id', ownerId)
    .like('invoice_number', `${prefix}%`);

  const highest = (rows ?? []).reduce((max, row) => {
    const match = /^FAT-\d{4}-(\d+)$/.exec(row.invoice_number ?? '');
    if (!match) return max;
    return Math.max(max, Number.parseInt(match[1], 10) || 0);
  }, 0);

  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}
