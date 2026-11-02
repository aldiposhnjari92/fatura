import type { InvoiceStatus } from '@/models/invoice';

export interface SearchResultRow {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  meta?: string;
  status?: InvoiceStatus;
}

export interface SearchResults {
  q: string;
  invoices: SearchResultRow[];
  clients: SearchResultRow[];
  invoiceCount: number;
  clientCount: number;
}

export interface GlobalSearchProps {
  /**
   * The term the current page is already showing results for. Keeps the field
   * in step with the page instead of going blank the moment a search lands.
   */
  initialQuery?: string;
}
