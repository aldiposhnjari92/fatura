import { PLANS, type PlanId } from '@/lib/plans';

export type InvoiceStatus = 'draft' | 'paid' | 'unpaid' | 'overdue';

export interface Profile {
  id: string;
  business_name: string | null;
  nipt: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  logo_url: string | null;
  /** True while any paid plan is running. Which one is `plan`. */
  is_pro: boolean;
  /**
   * The tier bought. Only meaningful while the subscription is live — read the
   * effective tier from `Astro.locals.plan` (active_plan() in SQL), which
   * already accounts for expiry.
   */
  plan?: PlanId;
  is_admin?: boolean;
  /** Read-mostly operator: sees invoice activity, changes nothing. */
  is_manager?: boolean;
  /** When the subscription lapses; null means no expiry set. */
  pro_until?: string | null;
  /** Set when the customer asked not to renew; access still runs to pro_until. */
  cancelled_at?: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  nipt: string | null;
  address: string | null;
  created_at: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id: string;
  owner_id: string;
  client_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  items: InvoiceItem[];
  subtotal: number;
  vat_percent: number;
  discount: number;
  total: number;
  status: InvoiceStatus;
  /** Set only while status is 'paid'; maintained by a database trigger. */
  paid_at?: string | null;
  notes: string | null;
  created_at: string;
}

/** An invoice joined with its client row, as the list and detail pages read it. */
export interface InvoiceWithClient extends Invoice {
  clients: Pick<Client, 'id' | 'name' | 'email' | 'nipt' | 'address'> | null;
}

export interface Totals {
  subtotal: number;
  discount: number;
  vatAmount: number;
  total: number;
}

/**
 * The single source of truth for invoice arithmetic — used by the editor, the
 * PDF and the server. Discount applies to the subtotal, VAT applies after it.
 */
export function computeTotals(
  items: InvoiceItem[],
  vatPercent: number,
  discount: number
): Totals {
  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    return sum + Math.round(qty * price);
  }, 0);

  const safeDiscount = Math.min(Math.max(Math.round(Number(discount) || 0), 0), subtotal);
  const net = subtotal - safeDiscount;
  const vatAmount = Math.round((net * (Number(vatPercent) || 0)) / 100);

  return {
    subtotal,
    discount: safeDiscount,
    vatAmount,
    total: net + vatAmount,
  };
}

/**
 * Status chips. Tinted surfaces with a matching ring, defined per theme so they
 * stay legible on both the light mist ground and the dark ink one.
 */
export const STATUS_META: Record<
  InvoiceStatus,
  { label: string; className: string }
> = {
  draft: {
    label: 'Draft',
    className:
      'bg-slate-200/70 text-slate-700 ring-slate-300/60 dark:bg-white/10 dark:text-slate-200 dark:ring-white/15',
  },
  unpaid: {
    label: 'E papaguar',
    className:
      'bg-amber-100 text-amber-900 ring-amber-300/70 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/30',
  },
  paid: {
    label: 'E paguar',
    className:
      'bg-teal-100 text-teal-900 ring-teal-300/70 dark:bg-brand/20 dark:text-brand dark:ring-brand/40',
  },
  overdue: {
    label: 'E vonuar',
    className:
      'bg-red-100 text-red-900 ring-red-300/70 dark:bg-red-400/15 dark:text-red-200 dark:ring-red-400/30',
  },
};

/**
 * Lateness is derived, never stored — the mirror of public.is_overdue() in
 * SQL. Keep the two in step: an invoice is late when it has been issued, is
 * still unpaid, and its due date has passed. Drafts are not late (they were
 * never sent) and a paid invoice is never late however late it was settled.
 */
export function isOverdue(
  status: InvoiceStatus,
  dueDate: string | null | undefined
): boolean {
  if (status !== 'unpaid' || !dueDate) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

/** What the badge should say: the stored status, upgraded to overdue if late. */
export function displayStatus(
  status: InvoiceStatus,
  dueDate: string | null | undefined
): InvoiceStatus {
  return isOverdue(status, dueDate) ? 'overdue' : status;
}

/** Whole days a payment is late. 0 when it is not. */
export function daysOverdue(
  status: InvoiceStatus,
  dueDate: string | null | undefined
): number {
  if (!isOverdue(status, dueDate)) return 0;
  const due = new Date(dueDate as string);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}

/** Free plan ceiling. Starter raises it to 30; Pro lifts it entirely. */
export const FREE_INVOICE_LIMIT = PLANS.free.invoiceLimit as number;
