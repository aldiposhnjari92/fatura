import type { Client } from '@/models/client';
import type { InvoiceItem, InvoiceStatus } from '@/models/invoice';

export type ExcelColumnKey =
  | 'number'
  | 'client'
  | 'clientNipt'
  | 'clientEmail'
  | 'clientAddress'
  | 'issueDate'
  | 'dueDate'
  | 'status'
  | 'paidAt'
  | 'vat'
  | 'discount'
  | 'description'
  | 'quantity'
  | 'price'
  | 'amount'
  | 'subtotal'
  | 'total'
  | 'notes';

export interface ExcelColumnDef {
  key: ExcelColumnKey;
  header: string;
  width: number;
  /** Other headers accepted on import, so an English or hand-made sheet still maps. */
  aliases?: string[];
}

export interface ExcelExportRow {
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  items: InvoiceItem[] | null;
  vat_percent: number;
  discount: number;
  status: InvoiceStatus;
  paid_at: string | null;
  notes: string | null;
  clients: Pick<Client, 'name' | 'nipt' | 'email' | 'address'> | null;
}

export type ExcelCell = {
  value?: unknown;
  type?: unknown;
  format?: string;
  fontWeight?: 'bold';
} | null;

export interface ParsedInvoice {
  /** First sheet row (1-based, as Excel shows it) the invoice came from. */
  row: number;
  invoice_number: string;
  client: { name: string; nipt: string | null; email: string | null; address: string | null };
  issue_date: string;
  due_date: string | null;
  status: Exclude<InvoiceStatus, 'overdue'>;
  paid_at: string | null;
  vat_percent: number;
  discount: number;
  notes: string | null;
  items: InvoiceItem[];
}

export interface RowProblem {
  row: number;
  message: string;
}

export interface ParseResult {
  invoices: ParsedInvoice[];
  problems: RowProblem[];
}

/** Which sheet column (0-based) feeds each field; a field left out is not imported. */
export type ColumnMapping = Partial<Record<ExcelColumnKey, number>>;

export interface ImportField {
  key: ExcelColumnKey;
  label: string;
  required: boolean;
}

export interface WorkbookSheet {
  rows: unknown[][];
  /** Rows that could be the header — the first few with anything in them. */
  headerCandidates: number[];
  headerIndex: number;
  mapping: ColumnMapping;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: RowProblem[];
  /** The plan's monthly cap was reached; everything after it was not attempted. */
  quotaReached: boolean;
  clientsCreated: number;
}

/** The file as read, kept so the user can go back and remap it without choosing it again. */
export type ExcelImportSource = {
  fileName: string;
  sheet: WorkbookSheet;
  existing: Set<string>;
};

export type ExcelImportMapping = {
  source: ExcelImportSource;
  headerIndex: number;
  mapping: ColumnMapping;
};

export type ExcelImportPreview = ExcelImportMapping & {
  ready: ParsedInvoice[];
  duplicates: number;
  problems: RowProblem[];
};

export type ExcelImportPhase =
  | { kind: 'closed' }
  | ({ kind: 'mapping' } & ExcelImportMapping)
  | { kind: 'preview'; preview: ExcelImportPreview }
  | { kind: 'importing'; total: number; done: number }
  | { kind: 'result'; result: ImportResult };
