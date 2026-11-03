import type { InvoiceStatus } from '@/models/invoice';

/** The choices on the Të ardhurat page, as they appear in its URL (?periudha=…). */
export type PeriodPreset =
  | 'kjo-jave'
  | 'java-kaluar'
  | 'ky-muaj'
  | 'muaji-kaluar'
  | 'ky-vit'
  | 'viti-kaluar'
  | 'tjeter';

/** A span of whole days, both ends included, as yyyy-mm-dd in Albanian time. */
export interface DateRange {
  from: string;
  to: string;
}

export interface Period extends DateRange {
  preset: PeriodPreset;
  /** "tetor 2026", "2025", "1 shtator – 15 tetor 2026". */
  label: string;
  /** What the period is compared with — the same stretch of time just before it. */
  previous: DateRange & { label: string };
}

/** One invoice as the page reads it — only the columns it needs. */
export interface EarningsInvoice {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  paid_at: string | null;
  subtotal: number;
  discount: number;
  total: number;
  clients: { name: string } | null;
}

/** An invoice paid inside the period, with the day it was paid. */
export interface PaidInvoice extends EarningsInvoice {
  paidOn: string;
}

export interface EarningsBucket {
  /** yyyy-mm-dd, yyyy-mm or yyyy. */
  key: string;
  /** Under the bar: "5", "tet", "2025". */
  short: string;
  /** In the tooltip: "5 tetor 2026", "tetor 2026", "2025". */
  long: string;
  amount: number;
  count: number;
}

export interface EarningsSummary {
  /** Collected: invoices marked paid, by the day they were paid. */
  earned: number;
  /** The VAT inside `earned` — collected, but owed onward. */
  earnedVat: number;
  paidCount: number;
  /** Collected in the period before, for the comparison. */
  previousEarned: number;
  /** Invoiced: every invoice issued in the period, drafts left out. */
  invoiced: number;
  invoicedCount: number;
  /** Of the invoices issued in the period, what is still unpaid today. */
  outstanding: number;
  outstandingCount: number;
  overdueCount: number;
  /** 'day' up to a month, 'month' up to two years, 'year' beyond. */
  bucketSize: 'day' | 'month' | 'year';
  buckets: EarningsBucket[];
  /** Most recently paid first. */
  paid: PaidInvoice[];
}

export interface EarningsPeriodPickerProps {
  /** The preset button to show as chosen; null when the arrows moved off every preset. */
  preset: PeriodPreset | null;
  from: string;
  to: string;
}
