import type { SupabaseClient } from '@supabase/supabase-js';
import { computeTotals } from '@/lib/invoices';
import { translate } from '@/lib/i18n';
import { invoiceFileName } from '@/lib/pdf';
import type { ColumnMapping, ExcelCell, ExcelColumnDef, ExcelColumnKey, ExcelExportRow, ImportField, ImportResult, ParsedInvoice, ParseResult, RowProblem, WorkbookSheet } from '@/models/excel';

/*
  Invoices to and from .xlsx.

  One sheet, one row per line item. An invoice with three lines is three rows
  that repeat its number, client and dates — the shape every accountant's
  spreadsheet already has, and the only one that survives being sorted,
  filtered or pasted into by hand. The import groups rows back together by
  invoice number; a row with no number continues the invoice above it, so a
  sheet typed by hand does not have to repeat it on every line.

  Columns are matched by header, not position, so a user can reorder or drop
  the optional ones — and a sheet with headers of its own is mapped by hand
  (see "Column mapping" below). Subtotal and total are written out for the
  reader but never read back: `computeTotals` is the only arithmetic that is
  trusted. A line's amount is read only when the sheet has no unit price.

  Both libraries are loaded on demand, like the PDF engine — nobody should
  download a spreadsheet parser to look at their invoice list.
*/

const COLUMNS: ExcelColumnDef[] = [
  { key: 'number', header: 'Numri', width: 16, aliases: ['nr', 'nr fature', 'fatura nr', 'numri i fatures', 'numri fatures', 'invoice number', 'invoice no', 'invoice', 'number'] },
  { key: 'client', header: 'Klienti', width: 28, aliases: ['klient', 'emri i klientit', 'bleresi', 'subjekti', 'client', 'customer', 'buyer'] },
  { key: 'clientNipt', header: 'NIPT i klientit', width: 16, aliases: ['nipt', 'client nipt', 'tax id'] },
  { key: 'clientEmail', header: 'Email i klientit', width: 24, aliases: ['email', 'client email'] },
  { key: 'clientAddress', header: 'Adresa e klientit', width: 28, aliases: ['adresa', 'client address', 'address'] },
  { key: 'issueDate', header: 'Data e lëshimit', width: 14, aliases: ['data', 'dt', 'data e fatures', 'data fatures', 'leshuar', 'issue date', 'invoice date', 'date'] },
  { key: 'dueDate', header: 'Afati', width: 14, aliases: ['afati i pageses', 'due date', 'due'] },
  { key: 'status', header: 'Statusi', width: 13, aliases: ['status'] },
  { key: 'paidAt', header: 'Paguar më', width: 14, aliases: ['data e pageses', 'paid at', 'paid on'] },
  { key: 'vat', header: 'TVSH %', width: 9, aliases: ['tvsh', 'vat', 'vat %'] },
  { key: 'discount', header: 'Zbritja', width: 11, aliases: ['zbritje', 'discount'] },
  { key: 'description', header: 'Përshkrimi', width: 36, aliases: ['pershkrim', 'artikulli', 'artikull', 'sherbimi', 'description', 'item'] },
  { key: 'quantity', header: 'Sasia', width: 9, aliases: ['qty', 'quantity'] },
  { key: 'price', header: 'Çmimi', width: 12, aliases: ['cmimi njesi', 'price', 'unit price'] },
  { key: 'amount', header: 'Vlera', width: 13, aliases: ['shuma', 'amount', 'line total'] },
  { key: 'subtotal', header: 'Nëntotali', width: 13, aliases: ['subtotal'] },
  { key: 'total', header: 'Totali', width: 13, aliases: ['total'] },
  { key: 'notes', header: 'Shënime', width: 30, aliases: ['shenim', 'notes', 'note'] },
];

const DATE_FORMAT = 'dd.mm.yyyy';
const MONEY_FORMAT = '#,##0';

/** Lower-case, accents stripped — so "Përshkrimi", "PERSHKRIMI" and "pershkrimi" are one header. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** A failure to fetch the spreadsheet chunk means the page is stale, not broken. */
export class ExcelEngineLoadError extends Error {
  constructor(cause: unknown) {
    super(translate('xls.staleReload'));
    this.name = 'ExcelEngineLoadError';
    this.cause = cause;
  }
}

async function loadWriter() {
  try {
    return (await import('write-excel-file/browser')).default;
  } catch (error) {
    throw new ExcelEngineLoadError(error);
  }
}

async function loadReader() {
  try {
    return (await import('read-excel-file/browser')).readSheet;
  } catch (error) {
    throw new ExcelEngineLoadError(error);
  }
}

// ---------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------

/** 'YYYY-MM-DD' as a UTC Date, which is what the writer turns into an Excel date. */
function isoToCellDate(iso: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function validIso(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Whatever a date cell holds, as 'YYYY-MM-DD'. The reader hands back a Date
 * for a formatted cell, a serial number for an unformatted one, and a string
 * for anything typed as text — in Albania that is day-first.
 */
function cellToIso(value: unknown): string | null {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return validIso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  if (typeof value === 'number') {
    // Excel serial: days since 1899-12-30. Anything below ~1955 is not a date we mean.
    if (value < 20000 || value > 80000) return null;
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return validIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const text = String(value).trim();
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (match) return validIso(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (match) return validIso(Number(match[3]), Number(match[2]), Number(match[1]));
  return null;
}

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------

/** PostgREST caps a response at 1000 rows by default, so the export reads in pages. */
const EXPORT_PAGE = 1000;

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

// ---------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------

function toText(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return cellToIso(value) ?? '';
  return String(value).trim();
}

/** Numbers as Excel stores them, or as typed: "1.200,50", "1,200.50" and "1200" all read. */
function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = String(value).replace(/[\s%]|lek[ëe]?|all/gi, '');
  if (!text) return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > lastDot) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function toStatus(value: unknown): ParsedInvoice['status'] | null {
  const text = fold(toText(value));
  if (!text) return 'draft';
  if (['draft', 'drafti', 'skice'].includes(text)) return 'draft';
  if (['paid', 'e paguar', 'paguar', 'paguara', 'e paguara'].includes(text)) return 'paid';
  // Lateness is derived from the due date, never stored, so a late invoice
  // comes back in as an unpaid one and turns late again by itself.
  if (
    ['unpaid', 'e papaguar', 'papaguar', 'e papaguara', 'overdue', 'e vonuar', 'vonuar'].includes(text)
  ) {
    return 'unpaid';
  }
  return null;
}

// ---------------------------------------------------------------------
// Column mapping
//
// A user's own spreadsheet rarely says "Numri" and "Data e lëshimit". The
// import guesses from the headers, and when the guess cannot find what it
// needs the user points each field at one of their columns instead. Those
// choices are remembered per header name, so the second import of the same
// kind of file goes straight to the preview.
// ---------------------------------------------------------------------

const REQUIRED: ExcelColumnKey[] = ['number', 'client', 'issueDate'];
/** A line needs at least one of these to be worth importing. */
const ITEM_SOURCES: ExcelColumnKey[] = ['description', 'price', 'amount'];

/** Everything the import can read. Subtotal and total are never read: they are recomputed. */
export const IMPORT_FIELDS: ImportField[] = COLUMNS.filter(
  (c) => c.key !== 'subtotal' && c.key !== 'total'
).map((c) => ({ key: c.key, label: c.header, required: REQUIRED.includes(c.key) }));

const REMEMBERED_KEY = 'fatura.xls.columns';

/** A header as a lookup key: "Nr. Faturës:" and "nr fatures" are the same column. */
function headerKey(value: string): string {
  return fold(value)
    .replace(/[^a-z0-9% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rememberedHeaders(): Record<string, ExcelColumnKey> {
  try {
    return JSON.parse(localStorage.getItem(REMEMBERED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Keep the user's choices so the same file layout maps by itself next time. */
export function rememberMapping(headers: string[], mapping: ColumnMapping): void {
  try {
    const remembered = rememberedHeaders();
    for (const [key, index] of Object.entries(mapping)) {
      const header = headerKey(headers[index as number] ?? '');
      if (header) remembered[header] = key as ExcelColumnKey;
    }
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(remembered));
  } catch {
    // Private mode or storage full: the mapping still works, it just is not remembered.
  }
}

/** Best guess from header names: the user's remembered choices first, then ours. */
export function guessMapping(header: unknown[]): ColumnMapping {
  const lookup = new Map<string, ExcelColumnKey>();
  for (const column of COLUMNS) {
    lookup.set(headerKey(column.header), column.key);
    for (const alias of column.aliases ?? []) lookup.set(headerKey(alias), column.key);
  }
  for (const [name, key] of Object.entries(rememberedHeaders())) lookup.set(name, key);

  const mapping: ColumnMapping = {};
  header.forEach((cell, index) => {
    const key = lookup.get(headerKey(toText(cell)));
    if (key && mapping[key] === undefined) mapping[key] = index;
  });
  return mapping;
}

/** Required fields the mapping still lacks — the item fields count as one. */
export function missingFields(mapping: ColumnMapping): ImportField[] {
  const missing = IMPORT_FIELDS.filter((f) => f.required && mapping[f.key] === undefined);
  if (ITEM_SOURCES.every((key) => mapping[key] === undefined)) {
    missing.push(IMPORT_FIELDS.find((f) => f.key === 'description')!);
  }
  return missing;
}

/** "A", "B" … "AA" — what Excel calls a column that has no header. */
export function columnLetter(index: number): string {
  let out = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
  }
  return out;
}

/** Read the first sheet and guess where its header is and what each column holds. */
export async function readInvoicesWorkbook(file: File): Promise<WorkbookSheet> {
  const readSheet = await loadReader();
  const rows = (await readSheet(file)) as unknown[][];

  const headerCandidates: number[] = [];
  for (let i = 0; i < rows.length && headerCandidates.length < 10; i++) {
    if (rows[i].some((cell) => toText(cell) !== '')) headerCandidates.push(i);
  }
  if (headerCandidates.length === 0) throw new Error(translate('xls.errEmpty'));

  // The header is the first of the opening rows the guess fully understands,
  // so a title line or two above it is fine. Failing that, the row it
  // recognises most columns in, then the widest row of text — a title line
  // is one cell, a header row is many — and the user maps the rest.
  const score = (i: number) => {
    const texts = rows[i].filter((cell) => typeof cell === 'string' && cell.trim() !== '');
    return Object.keys(guessMapping(rows[i])).length * 100 + texts.length;
  };
  const headerIndex =
    headerCandidates.find((i) => missingFields(guessMapping(rows[i])).length === 0) ??
    headerCandidates.reduce((best, i) => (score(i) > score(best) ? i : best));

  return { rows, headerCandidates, headerIndex, mapping: guessMapping(rows[headerIndex]) };
}

/** The header row's cells as text, one per column the sheet uses. */
export function sheetHeaders(sheet: WorkbookSheet, headerIndex: number): string[] {
  const width = Math.max(0, ...sheet.rows.map((row) => row.length));
  const header = sheet.rows[headerIndex] ?? [];
  return Array.from({ length: width }, (_, i) => toText(header[i]));
}

/** The first value under the header in a column, to show what the column holds. */
export function columnSample(sheet: WorkbookSheet, headerIndex: number, column: number): string {
  for (let i = headerIndex + 1; i < sheet.rows.length; i++) {
    const value = sheet.rows[i][column];
    if (value instanceof Date) return cellToIso(value) ?? '';
    const text = toText(value);
    if (text) return text;
  }
  return '';
}

/** Turn the sheet into invoices using the given mapping, plus everything that could not be read. */
export function parseInvoiceRows(
  sheet: WorkbookSheet,
  headerIndex: number,
  mapping: ColumnMapping
): ParseResult {
  const rows = sheet.rows;
  const missing = missingFields(mapping);
  if (missing.length > 0) {
    const names = missing.map((f) => f.label).join(', ');
    return {
      invoices: [],
      problems: [{ row: headerIndex + 1, message: translate('xls.errMissingColumns', { columns: names }) }],
    };
  }

  const get = (row: unknown[], key: ExcelColumnKey) => {
    const index = mapping[key];
    return index === undefined ? null : row[index];
  };

  const byNumber = new Map<string, ParsedInvoice>();
  const broken = new Set<string>();
  const problems: RowProblem[] = [];
  let current: ParsedInvoice | null = null;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;
    if (!row.some((cell) => toText(cell) !== '')) continue;

    const number = toText(get(row, 'number'));
    const report = (message: string) => problems.push({ row: rowNumber, message });

    let invoice: ParsedInvoice | null;
    if (!number) {
      // A line with no number belongs to the invoice above it.
      if (!current) {
        report(translate('xls.errNoNumber'));
        continue;
      }
      invoice = current;
    } else if (byNumber.has(number)) {
      invoice = byNumber.get(number)!;
    } else if (broken.has(number)) {
      continue;
    } else {
      const clientName = toText(get(row, 'client'));
      const issueDate = cellToIso(get(row, 'issueDate'));
      const rawDue = get(row, 'dueDate');
      const dueDate = cellToIso(rawDue);
      const status = toStatus(get(row, 'status'));
      const vat = toNumber(get(row, 'vat')) ?? 0;
      const discount = toNumber(get(row, 'discount')) ?? 0;

      const error = !clientName
        ? translate('xls.errNoClient')
        : !issueDate
          ? translate('xls.errBadIssueDate')
          : toText(rawDue) && !dueDate
            ? translate('xls.errBadDueDate')
            : !status
              ? translate('xls.errBadStatus', { value: toText(get(row, 'status')) })
              : vat < 0 || vat > 100
                ? translate('xls.errBadVat')
                : discount < 0
                  ? translate('xls.errBadDiscount')
                  : null;

      if (error) {
        report(`${number}: ${error}`);
        broken.add(number);
        current = null;
        continue;
      }

      invoice = {
        row: rowNumber,
        invoice_number: number,
        client: {
          name: clientName,
          nipt: toText(get(row, 'clientNipt')) || null,
          email: toText(get(row, 'clientEmail')) || null,
          address: toText(get(row, 'clientAddress')) || null,
        },
        issue_date: issueDate!,
        due_date: dueDate,
        status: status!,
        paid_at: status === 'paid' ? cellToIso(get(row, 'paidAt')) : null,
        vat_percent: Math.round(vat),
        discount: Math.round(discount),
        notes: toText(get(row, 'notes')) || null,
        items: [],
      };
      byNumber.set(number, invoice);
    }
    current = invoice;

    const description = toText(get(row, 'description'));
    const quantity = toNumber(get(row, 'quantity'));
    let price = toNumber(get(row, 'price'));
    // A sheet that only records what each line came to: the unit price is
    // worked back from it, so the recomputed total lands on the same number.
    const amount = toNumber(get(row, 'amount'));
    if (price == null && amount != null) {
      price = quantity ? Math.round((amount / quantity) * 100) / 100 : amount;
    }
    // Neither a description nor a price is an invoice's own row, not a line.
    if (!description && !price) continue;
    if ((quantity ?? 1) < 0 || (price ?? 0) < 0) {
      report(`${invoice.invoice_number}: ${translate('xls.errNegativeLine')}`);
      continue;
    }
    invoice.items.push({
      description: description || translate('xls.defaultItem'),
      quantity: quantity ?? 1,
      price: price ?? 0,
    });
  }

  const invoices: ParsedInvoice[] = [];
  for (const invoice of byNumber.values()) {
    if (invoice.items.length === 0) {
      problems.push({
        row: invoice.row,
        message: `${invoice.invoice_number}: ${translate('xls.errNoItems')}`,
      });
    } else {
      invoices.push(invoice);
    }
  }

  problems.sort((a, b) => a.row - b.row);
  return { invoices, problems };
}

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
