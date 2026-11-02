import type { SupabaseClient } from '@supabase/supabase-js';
import { computeTotals } from '@/lib/invoices';
import { fold } from './columns';
import { EXPORT_PAGE } from './exporter';
import type { ImportResult, ParsedInvoice } from '@/models/excel';

/* Writing parsed invoices into the user's account. */

/** Invoice numbers the user already has, so a re-import skips rather than collides. */
export async function existingInvoiceNumbers(
  supabase: SupabaseClient,
  ownerId: string
): Promise<Set<string>> {
  const numbers = new Set<string>();
  for (let from = 0; ; from += EXPORT_PAGE) {
    const { data, error } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('owner_id', ownerId)
      .range(from, from + EXPORT_PAGE - 1);
    if (error) throw error;
    for (const row of data ?? []) numbers.add(row.invoice_number as string);
    if (!data || data.length < EXPORT_PAGE) return numbers;
  }
}

/**
 * Write parsed invoices, one at a time.
 *
 * Not a single bulk insert: the quota trigger runs per row, and a bulk insert
 * that trips it on row 6 would roll back the five before it. One by one, the
 * user keeps everything their plan allows and is told where it stopped.
 *
 * Clients are matched to existing ones by NIPT, then by name, and created
 * only when neither matches — importing the same customer twice must not
 * leave two of them in the client list.
 */
export async function importInvoices(
  supabase: SupabaseClient,
  ownerId: string,
  invoices: ParsedInvoice[],
  onProgress?: (done: number) => void
): Promise<ImportResult> {
  const { data: clientRows, error: clientError } = await supabase
    .from('clients')
    .select('id, name, nipt')
    .eq('owner_id', ownerId);
  if (clientError) throw clientError;

  const byNipt = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of clientRows ?? []) {
    if (c.nipt) byNipt.set(fold(c.nipt), c.id);
    byName.set(fold(c.name), c.id);
  }

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    failed: [],
    quotaReached: false,
    clientsCreated: 0,
  };

  async function clientIdFor(client: ParsedInvoice['client']): Promise<string> {
    const found =
      (client.nipt && byNipt.get(fold(client.nipt))) || byName.get(fold(client.name));
    if (found) return found;

    const { data, error } = await supabase
      .from('clients')
      .insert({ owner_id: ownerId, ...client })
      .select('id')
      .single();
    if (error) throw error;
    const id = (data as { id: string }).id;
    if (client.nipt) byNipt.set(fold(client.nipt), id);
    byName.set(fold(client.name), id);
    result.clientsCreated += 1;
    return id;
  }

  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];
    try {
      const totals = computeTotals(invoice.items, invoice.vat_percent, invoice.discount);
      const { error } = await supabase.from('invoices').insert({
        owner_id: ownerId,
        client_id: await clientIdFor(invoice.client),
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        items: invoice.items,
        subtotal: totals.subtotal,
        vat_percent: invoice.vat_percent,
        discount: totals.discount,
        total: totals.total,
        status: invoice.status,
        // Left null, the trigger stamps "now" — right for a click, wrong for history.
        paid_at: invoice.paid_at,
        notes: invoice.notes,
      });

      if (error) {
        if (error.code === '23505') {
          result.skipped += 1;
        } else if (/(FREE|STARTER)_PLAN_LIMIT_REACHED/.test(error.message)) {
          result.quotaReached = true;
          return result;
        } else {
          throw error;
        }
      } else {
        result.imported += 1;
      }
    } catch (err) {
      result.failed.push({
        row: invoice.row,
        message: `${invoice.invoice_number}: ${(err as Error).message}`,
      });
    }
    onProgress?.(i + 1);
  }

  return result;
}
