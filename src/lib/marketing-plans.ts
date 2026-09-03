/**
 * The three plan cards, as the marketing pages draw them.
 *
 * This lived twice — 64 near-identical lines in src/pages/index.astro and
 * again in src/pages/cmimet.astro, differing in exactly three strings. Both
 * copies also hardcoded the prices, so `PLANS` called itself the single source
 * of truth while two pages quietly disagreed with it whenever it changed. The
 * money now comes from src/lib/plans.ts, which mirrors the SQL that actually
 * charges; only the wording is a per-page decision, and it is passed in.
 */

import { PLANS, type PlanId } from '@/lib/plans';

/** Per-page wording. Anything omitted falls back to the shared copy. */
export interface PlanCopy {
  description?: string;
  features?: string[];
}

export type PlanCopyOverrides = Partial<Record<PlanId, PlanCopy>>;

interface Button {
  label: string;
  href: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

export interface MarketingPlan {
  name: string;
  description: string;
  price: number;
  currency: string;
  unit: string;
  features: string[];
  featured?: boolean;
  badge?: string;
  note?: string;
  button: Button;
  authedButton?: Button;
}

/* The shared card copy. Prices are deliberately absent — they come from PLANS. */
const BASE: Record<PlanId, Omit<MarketingPlan, 'price'>> = {
  free: {
    name: PLANS.free.name,
    description: 'Për të filluar sot.',
    currency: 'ALL',
    unit: 'muaj',
    features: [
      '5 fatura në muaj',
      'Klientë të palimituar',
      'PDF me logon tënde',
      'TVSH dhe zbritje',
    ],
    note: 'Pa kartë krediti',
    button: { label: 'Fillo falas', href: '/regjistrohu', variant: 'outline' },
    authedButton: { label: 'Shko te paneli', href: '/app', variant: 'outline' },
  },
  starter: {
    name: PLANS.starter.name,
    description: 'Për biznese që faturojnë çdo javë.',
    currency: 'ALL',
    unit: 'muaj',
    features: [
      '30 fatura në muaj',
      'Gjithçka nga plani falas',
      'Klientë të palimituar',
      'Anulo kur të duash',
    ],
    note: 'Anulo kur të duash',
    button: {
      label: 'Fillo me Starter',
      href: '/regjistrohu?plan=starter&muaj=1',
      variant: 'outline',
    },
    authedButton: {
      label: 'Kalo në Starter',
      href: '/app/abonimi?plan=starter&muaj=1',
      variant: 'outline',
    },
  },
  pro: {
    name: PLANS.pro.name,
    description: 'Për biznese që faturojnë çdo ditë.',
    currency: 'ALL',
    unit: 'muaj',
    features: [
      'Fatura të palimituara',
      'Gjithçka nga plani Starter',
      'Mbështetje me përparësi në WhatsApp',
      'Veçoritë e reja të parët',
    ],
    featured: true,
    badge: 'Më i zgjedhuri',
    note: 'Anulo kur të duash',
    button: { label: 'Fillo me Pro', href: '/regjistrohu?plan=pro&muaj=1' },
    authedButton: { label: 'Kalo në Pro', href: '/app/abonimi?plan=pro&muaj=1' },
  },
};

/** Ladder order — the order the pricing table renders the columns in. */
const ORDER: PlanId[] = ['free', 'starter', 'pro'];

export function marketingPlans(overrides: PlanCopyOverrides = {}): MarketingPlan[] {
  return ORDER.map((id) => ({
    ...BASE[id],
    ...overrides[id],
    price: PLANS[id].monthlyALL,
  }));
}
