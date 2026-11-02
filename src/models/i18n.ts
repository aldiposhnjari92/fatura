import type { sq } from '@/lib/i18n';

export type TranslationKey = keyof typeof sq;

export interface InvoiceStrings {
  invoice: string;
  from: string;
  billTo: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  nipt: string;
  description: string;
  qty: string;
  unitPrice: string;
  amount: string;
  subtotal: string;
  discount: string;
  vat: string;
  total: string;
  notes: string;
  status: string;
  thanks: string;
  generatedWith: string;
  currency: string;
  statuses: { draft: string; paid: string; unpaid: string; overdue: string };
}
