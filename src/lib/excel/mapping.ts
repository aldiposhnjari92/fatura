import { translate } from '@/lib/i18n';
import { cellToIso, toText } from './cells';
import { COLUMNS, fold } from './columns';
import { loadReader } from './engine';
import type { ColumnMapping, ExcelColumnKey, ImportField, WorkbookSheet } from '@/models/excel';

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
