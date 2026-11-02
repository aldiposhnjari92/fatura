import type { ExcelColumnDef } from '@/models/excel';

/* The sheet's columns, in the order the export writes them. */

export const COLUMNS: ExcelColumnDef[] = [
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

export const DATE_FORMAT = 'dd.mm.yyyy';
export const MONEY_FORMAT = '#,##0';

/** Lower-case, accents stripped — so "Përshkrimi", "PERSHKRIMI" and "pershkrimi" are one header. */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
