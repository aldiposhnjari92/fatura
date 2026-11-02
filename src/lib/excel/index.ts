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

export { ExcelEngineLoadError } from './engine';
export { downloadExcelTemplate, exportInvoiceToExcel, exportInvoicesToExcel } from './exporter';
export {
  IMPORT_FIELDS,
  columnLetter,
  columnSample,
  guessMapping,
  missingFields,
  readInvoicesWorkbook,
  rememberMapping,
  sheetHeaders,
} from './mapping';
export { parseInvoiceRows } from './parse';
export { existingInvoiceNumbers, importInvoices } from './importer';
