import type { InvoiceLanguage } from './types';

/**
 * Strings printed onto the PDF. The app UI itself is Albanian; the *invoice*
 * is bilingual because freelancers here bill foreign clients constantly.
 */
export const PDF_STRINGS = {
  sq: {
    invoice: 'FATURË',
    from: 'Nga',
    billTo: 'Faturuar për',
    invoiceNo: 'Fatura Nr.',
    issueDate: 'Data e lëshimit',
    dueDate: 'Afati i pagesës',
    nipt: 'NIPT',
    description: 'Përshkrimi',
    qty: 'Sasia',
    unitPrice: 'Çmimi',
    amount: 'Vlera',
    subtotal: 'Nëntotali',
    discount: 'Zbritje',
    vat: 'TVSH',
    total: 'TOTALI',
    notes: 'Shënime',
    status: 'Statusi',
    thanks: 'Faleminderit për bashkëpunimin!',
    generatedWith: 'Krijuar me Fatura.co',
    currency: 'Lekë',
    statuses: {
      draft: 'Draft',
      paid: 'E PAGUAR',
      unpaid: 'E PAPAGUAR',
      overdue: 'E VONUAR',
    },
  },
  en: {
    invoice: 'INVOICE',
    from: 'From',
    billTo: 'Bill to',
    invoiceNo: 'Invoice No.',
    issueDate: 'Issue date',
    dueDate: 'Due date',
    nipt: 'VAT ID',
    description: 'Description',
    qty: 'Qty',
    unitPrice: 'Unit price',
    amount: 'Amount',
    subtotal: 'Subtotal',
    discount: 'Discount',
    vat: 'VAT',
    total: 'TOTAL',
    notes: 'Notes',
    status: 'Status',
    thanks: 'Thank you for your business!',
    generatedWith: 'Created with Fatura.co',
    currency: 'ALL',
    statuses: {
      draft: 'DRAFT',
      paid: 'PAID',
      unpaid: 'UNPAID',
      overdue: 'OVERDUE',
    },
  },
} as const;

export type PdfStrings = (typeof PDF_STRINGS)[InvoiceLanguage];

export function t(language: InvoiceLanguage): PdfStrings {
  return PDF_STRINGS[language] ?? PDF_STRINGS.en;
}
