/**
 * The plan ladder, in one place.
 *
 * Mirrors the database, which is the real authority: plan_monthly_price() and
 * plan_invoice_limit() in supabase/migrations/0017_starter_plan.sql. Nothing
 * here is ever used to charge anyone — create_payment() reads the price from
 * SQL — but the marketing pages, the meters and the checkout all need the
 * numbers without a round trip. Change one side, change the other.
 */

export type PlanId = 'free' | 'starter' | 'pro';

/** Tiers that are actually bought. Free is what you lapse to, not what you buy. */
export type PaidPlanId = Exclude<PlanId, 'free'>;

export interface PlanSpec {
  id: PlanId;
  /** Display name, as it appears on the pricing cards. */
  name: string;
  /** Uppercase chip in the app shell. */
  badge: string;
  /** Whole Lek per month. */
  monthlyALL: number;
  /** Invoices per calendar month; null means unlimited. */
  invoiceLimit: number | null;
}

export const PLANS: Record<PlanId, PlanSpec> = {
  free: { id: 'free', name: 'Falas', badge: 'FALAS', monthlyALL: 0, invoiceLimit: 5 },
  starter: {
    id: 'starter',
    name: 'Starter',
    badge: 'STARTER',
    monthlyALL: 1000,
    invoiceLimit: 30,
  },
  pro: { id: 'pro', name: 'Pro', badge: 'PRO', monthlyALL: 2000, invoiceLimit: null },
};

/** In ladder order — the order the pricing cards and the plan picker use. */
export const PAID_PLANS: PlanSpec[] = [PLANS.starter, PLANS.pro];

export function isPlanId(value: unknown): value is PlanId {
  return value === 'free' || value === 'starter' || value === 'pro';
}

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return value === 'starter' || value === 'pro';
}

/** Never throws: an unknown tier is treated as free, which grants the least. */
export function planOf(value: unknown): PlanSpec {
  return isPlanId(value) ? PLANS[value] : PLANS.free;
}

/** Invoices allowed this month; null means unlimited. */
export function invoiceLimitOf(plan: unknown): number | null {
  return planOf(plan).invoiceLimit;
}

/**
 * How much of the month's quota is gone, 0–1. Always 0 on an unlimited plan,
 * so a meter bound to it simply stays empty rather than dividing by null.
 */
export function usageRatio(plan: unknown, used: number): number {
  const limit = invoiceLimitOf(plan);
  if (limit === null || limit <= 0) return 0;
  return Math.min(1, Math.max(0, used / limit));
}

/** True when the next invoice would be refused by enforce_invoice_quota(). */
export function quotaReached(plan: unknown, used: number): boolean {
  const limit = invoiceLimitOf(plan);
  return limit !== null && used >= limit;
}
