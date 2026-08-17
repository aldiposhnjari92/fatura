/**
 * Payment method registry.
 *
 * Albania is not a supported Stripe merchant country, and PayPal receiving on
 * an Albanian account is unreliable, so nothing here assumes a single gateway.
 * Bank transfer needs no third party and is how Albanian SMEs actually pay;
 * card and PayPal are real integrations that switch on when their credentials
 * are present, and are shown as unavailable (never as broken buttons) until
 * then.
 */

export type PaymentMethod = 'bank_transfer' | 'card' | 'paypal';

/*
  Display only. The amount actually charged comes from
  public.pro_monthly_price() via create_payment() — the server never trusts a
  price sent by the browser. Keep the two in step when changing it.
*/
export const PRO_MONTHLY_ALL = 2000;

export interface PlanOption {
  months: number;
  label: string;
  /** Total in Lek. */
  total: number;
  /** Marketing note, e.g. a discount hint. */
  note?: string;
  best?: boolean;
}

export const PLAN_OPTIONS: PlanOption[] = [
  { months: 1, label: '1 muaj', total: PRO_MONTHLY_ALL },
  { months: 6, label: '6 muaj', total: PRO_MONTHLY_ALL * 6, note: 'gjysmë viti' },
  { months: 12, label: '12 muaj', total: PRO_MONTHLY_ALL * 12, note: 'një vit', best: true },
];

export interface BankDetails {
  beneficiary: string;
  bank: string;
  iban: string;
  swift: string;
  currency: string;
}

/**
 * Read on the server only. Falls back to obvious placeholders so the page still
 * renders during setup — `isBankConfigured()` reports whether they are real.
 */
export function getBankDetails(env: Record<string, unknown>): BankDetails {
  return {
    beneficiary: String(env.BANK_BENEFICIARY ?? 'Fatura.co'),
    bank: String(env.BANK_NAME ?? 'Emri i bankës'),
    iban: String(env.BANK_IBAN ?? 'AL00 0000 0000 0000 0000 0000 0000'),
    swift: String(env.BANK_SWIFT ?? 'XXXXALTX'),
    currency: String(env.BANK_CURRENCY ?? 'ALL'),
  };
}

export function isBankConfigured(env: Record<string, unknown>): boolean {
  const iban = String(env.BANK_IBAN ?? '');
  return iban.length > 8 && !iban.startsWith('AL00 0000');
}

export function isPaypalConfigured(env: Record<string, unknown>): boolean {
  return Boolean(env.PUBLIC_PAYPAL_CLIENT_ID) && Boolean(env.PAYPAL_SECRET);
}

/**
 * PayPal Advanced Checkout renders hosted card fields, so one integration
 * covers both "pay with PayPal" and "pay by card". Whether card fields are
 * actually enabled depends on the merchant account's approval status.
 */
export function isCardConfigured(env: Record<string, unknown>): boolean {
  return isPaypalConfigured(env) && String(env.PAYPAL_CARD_FIELDS ?? '') === 'true';
}

export interface MethodInfo {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: string;
  available: boolean;
  unavailableReason?: string;
}

export function getMethods(env: Record<string, unknown>): MethodInfo[] {
  const paypal = isPaypalConfigured(env);
  const card = isCardConfigured(env);

  return [
    {
      id: 'bank_transfer',
      label: 'Transfertë bankare',
      description:
        'Paguaj nga banka jote me referencën që të japim. E aktivizojmë brenda 24 orëve pune.',
      icon: 'landmark',
      available: true,
    },
    {
      id: 'card',
      label: 'Kartë krediti / debiti',
      description: card
        ? 'Visa ose Mastercard. Aktivizohet menjëherë pas pagesës.'
        : 'Pagesa me kartë aktivizohet sapo të lidhet llogaria tregtare.',
      icon: 'credit-card',
      available: card,
      unavailableReason: 'Ende pa llogari tregtare',
    },
    {
      id: 'paypal',
      label: 'PayPal',
      description: paypal
        ? 'Paguaj me llogarinë tënde PayPal. Aktivizohet menjëherë.'
        : 'PayPal aktivizohet sapo të konfigurohen kredencialet.',
      icon: 'wallet',
      available: paypal,
      unavailableReason: 'Ende pa kredenciale',
    },
  ];
}

/** Human summary of what a purchase buys, e.g. "12 muaj · 11 880 Lekë". */
export function describePlan(months: number): string {
  const option = PLAN_OPTIONS.find((o) => o.months === months);
  return option ? option.label : `${months} muaj`;
}
