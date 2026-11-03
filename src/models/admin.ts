import type { PlanId } from '@/models/billing';

/** The tabs of the payments page (/admin/pagesat). */
export type PaymentStatusFilter = 'all' | 'pending' | 'confirmed' | 'rejected';

/** The filters of the businesses page (/admin/perdoruesit). */
export type BusinessFilter = 'all' | 'paid' | 'starter' | 'pro' | 'free' | 'admin' | 'inactive';

export interface ActivityRow {
  id: number;
  type: string;
  ref: string | null;
  amount: number | null;
  created_at: string;
  business_name: string | null;
  city: string | null;
}

export interface ActivityStreamProps {
  /** Server-rendered first page, so the list is never empty on load. */
  initial?: ActivityRow[];
  /**
   * `bell`  — header button with an unread count and a dropdown panel
   * `list`  — the history table body
   * `toast` — floating notifications
   */
  variant?: 'bell' | 'toast' | 'list';
  /**
   * Which feed to read. `platform` is every business (managers and admins);
   * `own` is only the signed-in customer's own events, scoped by RLS.
   */
  scope?: 'platform' | 'own';
}

export interface AdminUserRow {
  id: string;
  email: string;
  business_name: string | null;
  city: string | null;
  nipt: string | null;
  is_pro: boolean;
  /** Tier in force, from active_plan() — already accounts for expiry. */
  plan?: PlanId;
  is_admin: boolean;
  is_manager?: boolean;
  /** Per-account screens switched on — see lib/features.ts. */
  features?: string[] | null;
  pro_until: string | null;
  created_at: string;
  invoice_count: number;
  client_count: number;
  invoiced_total: number;
  /** Total of the invoices it issued (drafts left out) — 0030. Absent before that migration runs. */
  revenue_total?: number;
  /** Total of its invoices marked paid — 0030. */
  earned_total?: number;
  /** What the business paid us for its plan. */
  paid_total: number;
  last_invoice_at: string | null;
}

export interface AdminUserTableProps {
  rows: AdminUserRow[];
  currentAdminId: string;
}

export interface UserDeletePreview {
  id: string;
  business_name: string | null;
  email: string;
  is_admin: boolean;
  is_manager?: boolean;
  is_self: boolean;
  pro_active: boolean;
  pro_until: string | null;
  invoices: number;
  clients: number;
  payments: number;
  paid_total: number;
  last_payment_at: string | null;
  other_admins: number;
}
