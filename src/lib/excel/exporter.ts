import type { SupabaseClient } from '@supabase/supabase-js';
import { computeTotals } from '@/lib/invoices';
import { translate } from '@/lib/i18n';
import { invoiceFileName } from '@/lib/pdf';
import { isoToCellDate } from './cells';
import { COLUMNS, DATE_FORMAT, MONEY_FORMAT } from './columns';
import { loadWriter } from './engine';
import type { ExcelCell, ExcelColumnKey, ExcelExportRow } from '@/models/excel';

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------

/** PostgREST caps a response at 1000 rows by default, so the export reads in pages. */
export const EXPORT_PAGE = 1000;

const EXPORT_SELECT =
  'invoice_number, issue_date, due_date, items, vat_percent, discount, status, paid_at, notes, clients(name, nipt, email, address)';

async function fetchAllInvoices(supabase: SupabaseClient, ownerId: string): Promise<ExcelExportRow[]> {
  const rows: ExcelExportRow[] = [];
  for (let from = 0; ; from += EXPORT_PAGE) {
    const { data, error } = await supabase
      .from('invoices')
      .select(EXPORT_SELECT)
      .eq('owner_id', ownerId)
      .order('issue_date', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, from + EXPORT_PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as ExcelExportRow[]));
    if (!data || data.length < EXPORT_PAGE) return rows;
  }
}

function textCell(value: string | null | undefined): ExcelCell {
  return value ? { value, type: String } : null;
}

function numberCell(value: number, format?: string): ExcelCell {
  return { value, type: Number, format };
}

function dateCell(iso: string | null | undefined): ExcelCell {
  const date = isoToCellDate(iso);
  return date ? { value: date, type: Date, format: DATE_FORMAT } : null;
}

function headerRow(): ExcelCell[] {
  return COLUMNS.map((c) => ({ value: c.header, type: String, fontWeight: 'bold' }));
}

function invoiceRows(invoice: ExcelExportRow): ExcelCell[][] {
  const items = Array.isArray(invoice.items) && invoice.items.length > 0
    ? invoice.items
    : [{ description: '', quantity: 0, price: 0 }];
  const totals = computeTotals(items, invoice.vat_percent, invoice.discount);
  const status = translate(`status.${invoice.status}` as 'status.draft');

  return items.map((item) => {
    const byKey: Record<ExcelColumnKey, ExcelCell> = {
      number: textCell(invoice.invoice_number),
      client: textCell(invoice.clients?.name),
      clientNipt: textCell(invoice.clients?.nipt),
      clientEmail: textCell(invoice.clients?.email),
      clientAddress: textCell(invoice.clients?.address),
      issueDate: dateCell(invoice.issue_date),
      dueDate: dateCell(invoice.due_date),
      status: textCell(status),
      paidAt: dateCell(invoice.paid_at),
      vat: numberCell(Number(invoice.vat_percent) || 0),
      discount: numberCell(totals.discount, MONEY_FORMAT),
      description: textCell(item.description),
      quantity: numberCell(Number(item.quantity) || 0),
      price: numberCell(Number(item.price) || 0, MONEY_FORMAT),
      amount: numberCell(
        Math.round((Number(item.quantity) || 0) * (Number(item.price) || 0)),
        MONEY_FORMAT
      ),
      subtotal: numberCell(totals.subtotal, MONEY_FORMAT),
      total: numberCell(totals.total, MONEY_FORMAT),
      notes: textCell(invoice.notes),
    };
    return COLUMNS.map((c) => byKey[c.key]);
  });
}

async function writeWorkbook(rows: ExcelCell[][], fileName: string) {
  const writeXlsxFile = await loadWriter();
  // The library's cell types are constructor-keyed generics that do not
  // survive being built in a loop; the shapes above are what it documents.
  await writeXlsxFile(rows as never, {
    sheet: 'Faturat',
    columns: COLUMNS.map((c) => ({ width: c.width })),
    stickyRowsCount: 1,
  }).toFile(fileName);
}

/** Download every invoice the user owns as one .xlsx. Returns how many invoices went in. */
export async function exportInvoicesToExcel(
  supabase: SupabaseClient,
  ownerId: string
): Promise<number> {
  const invoices = await fetchAllInvoices(supabase, ownerId);
  const rows = [headerRow(), ...invoices.flatMap(invoiceRows)];
  const today = new Date().toISOString().slice(0, 10);
  await writeWorkbook(rows, `faturat-${today}.xlsx`);
  return invoices.length;
}

/**
 * Download one invoice as .xlsx, in the same layout as the full export — so
 * the file can be handed to an accountant or imported back unchanged.
 */
export async function exportInvoiceToExcel(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('invoices')
    .select(EXPORT_SELECT)
    .eq('id', invoiceId)
    .single();
  if (error) throw error;
  const invoice = data as unknown as ExcelExportRow;
  await writeWorkbook(
    [headerRow(), ...invoiceRows(invoice)],
    invoiceFileName(invoice.invoice_number, invoice.clients?.name, 'xlsx')
  );
}

/** An empty sheet with the right headers and one example invoice, to fill in. */
export async function downloadExcelTemplate(): Promise<void> {
  const year = new Date().getFullYear();
  const example: ExcelExportRow = {
    invoice_number: `FAT-${year}-001`,
    issue_date: `${year}-01-15`,
    due_date: `${year}-02-15`,
    items: [
      { description: 'Shërbim konsulence', quantity: 2, price: 5000 },
      { description: 'Materiale', quantity: 1, price: 3000 },
    ],
    vat_percent: 20,
    discount: 0,
    status: 'unpaid',
    paid_at: null,
    notes: null,
    clients: { name: 'Klienti Shembull sh.p.k.', nipt: 'L12345678A', email: null, address: 'Tiranë' },
  };
  await writeWorkbook([headerRow(), ...invoiceRows(example)], 'fatura-shabllon.xlsx');
}
