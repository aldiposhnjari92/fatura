import type * as React from 'react';

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

export type PaymentMethod = 'bank_transfer' | 'card' | 'paypal';

export interface TermOption {
  months: number;
  /** Name of the term, as a card or toggle title: "Mujor" / "Vjetor". */
  label: string;
  /** Unit noun for a price line, rendered as "/muaj" or "/vit". */
  unit: string;
  /** The term as a span of time, for running text: "një muaj" / "një vit". */
  periodLabel: string;
  /** Total in Lek for this plan over this term. */
  total: number;
  /** Marketing note, e.g. a discount hint. */
  note?: string;
  best?: boolean;
}

export type TermMeta = Omit<TermOption, 'months' | 'total'>;

export interface BankDetails {
  beneficiary: string;
  bank: string;
  iban: string;
  swift: string;
  currency: string;
}

export interface MethodInfo {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: string;
  available: boolean;
  unavailableReason?: string;
}

/** Per-page wording. Anything omitted falls back to the shared copy. */
export interface PlanCopy {
  description?: string;
  features?: string[];
}

export type PlanCopyOverrides = Partial<Record<PlanId, PlanCopy>>;

export interface PlanButton {
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
  button: PlanButton;
  authedButton?: PlanButton;
}

export interface PayPalSdkOptions {
  clientId: string;
  /** Must match the `currency_code` the server puts on the order. */
  currency: string;
  /** Ask for the hosted card fields as well as the buttons. */
  cardFields: boolean;
}

/* The SDK's own surface is far wider than this; typed to what is actually called. */
export interface PayPalNamespace {
  Buttons?: (options: Record<string, unknown>) => {
    render: (target: HTMLElement) => Promise<void>;
    close: () => void;
    isEligible?: () => boolean;
  };
  CardFields?: (options: Record<string, unknown>) => PayPalCardFields;
}

export interface PayPalCardFields {
  isEligible: () => boolean;
  submit: () => Promise<void>;
  NameField: (options?: Record<string, unknown>) => PayPalCardField;
  NumberField: (options?: Record<string, unknown>) => PayPalCardField;
  ExpiryField: (options?: Record<string, unknown>) => PayPalCardField;
  CVVField: (options?: Record<string, unknown>) => PayPalCardField;
}

export interface PayPalCardField {
  render: (target: HTMLElement | string) => Promise<void>;
  close?: () => Promise<void>;
}

export type PayPalMode = 'paypal' | 'card';

export interface PayPalPanelProps {
  clientId: string;
  /** Must match PAYPAL_CURRENCY — the currency the server puts on the order. */
  currency: string;
  /** Whether Advanced Card Payments is approved on the merchant account. */
  cardFieldsEnabled: boolean;
  mode: PayPalMode;
  months: number;
  plan: PaidPlanId;
  /** Called after a capture completes, before the page reloads its state. */
  onPaid: () => void;
}

export interface PayPalOrderRequest {
  months: number;
  plan: PaidPlanId;
}

export interface CheckoutPayment {
  id: string;
  reference: string;
  method: PaymentMethod;
  amount: number;
  months: number;
  /** Which tier this request buys. Absent on rows created before Starter. */
  plan?: PaidPlanId;
  created_at: string;
  /** Set when create_payment() handed back an existing open request. */
  reused?: boolean;
}

export interface CheckoutProps {
  methods: MethodInfo[];
  bank: BankDetails;
  bankConfigured: boolean;
  paypalClientId: string | null;
  /** Settlement currency of the merchant account — must match the order's. */
  paypalCurrency?: string;
  /** True once Advanced Card Payments is approved, enabling hosted card fields. */
  cardFieldsEnabled?: boolean;
  pending: CheckoutPayment | null;
  /** The tier in force right now — 'free' once a subscription has lapsed. */
  activePlan: PlanId;
  proActive: boolean;
  proUntil: string | null;
  /** Set when the customer already asked not to renew. */
  cancelledAt?: string | null;
  /**
   * Start of the running billing period, derived server-side from the most
   * recent confirmed payment. Null when Pro was granted by an admin, in which
   * case the period bar is hidden rather than guessed.
   */
  periodStart?: string | null;
  /** Invoices issued this calendar month — drives the free-plan meter. */
  invoicesThisMonth?: number;
  /** The term and method of the payment that bought the running period. */
  currentTerm?: CurrentTerm | null;
  /** Term chosen on the pricing page and carried through signup. */
  initialMonths?: number;
  /** Tier chosen on the pricing page and carried through signup. */
  initialPlan?: PaidPlanId;
  /** True when the visitor arrived here straight after picking a paid plan. */
  fromSignup?: boolean;
  /** The page's side rail, slotted in so the island can own the full layout. */
  children?: React.ReactNode;
}

export interface QueuedPayment {
  id: string;
  reference: string;
  method: string;
  amount: number;
  months: number;
  /** Tier this payment buys; absent on rows created before Starter existed. */
  plan?: string | null;
  created_at: string;
  provider_ref: string | null;
  business_name: string | null;
  city: string | null;
}

// ---- The checkout page's parts -------------------------------------------------------

/** What the customer pays for now, as the subscription details read it. */
export type CurrentTerm = { months: number; method: string; amount: number };

export interface MembershipCardProps {
  /** Any paid plan is running. */
  proActive: boolean;
  activePlan: PlanId;
  /** When the customer asked not to renew, or null. */
  cancelled: string | null;
  endsOn: string | null;
  daysLeft: number | null;
  /** Fraction of the paid period used, or null when it cannot be known. */
  periodProgress: number | null;
  /** Null on Pro — unlimited. */
  monthlyLimit: number | null;
  invoicesThisMonth: number;
  usageRatio: number;
  overLimit: boolean;
  cancelBusy: boolean;
  onResume: () => void;
  /** Open the purchase flow, optionally on a given tier. */
  onBuy: (plan?: PaidPlanId) => void;
  onCancel: () => void;
}

export interface PlanPickerProps {
  plan: PaidPlanId;
  onPlan: (plan: PaidPlanId) => void;
  activePlan: PlanId;
  /** Starter chosen while Pro runs — it takes over once paid. */
  isDowngrade: boolean;
}

export interface TermPickerProps {
  months: number;
  onMonths: (months: number) => void;
  terms: TermOption[];
  /** Extending a running plan, rather than buying a first one. */
  renewing: boolean;
  onClose: () => void;
}

export interface MethodPickerProps {
  methods: MethodInfo[];
  method: PaymentMethod;
  onMethod: (method: PaymentMethod) => void;
}

export interface BankTransferPanelProps {
  bank: BankDetails;
  bankConfigured: boolean;
  /** The open payment request, once a reference has been issued. */
  order: CheckoutPayment | null;
  plan: PaidPlanId;
  term: TermOption;
  busy: boolean;
  onStart: () => void;
  onError: (message: string) => void;
}

export interface GatewayPanelProps {
  method: MethodInfo | undefined;
  mode: 'card' | 'paypal';
  paypalClientId: string | null | undefined;
  paypalCurrency: string;
  cardFieldsEnabled: boolean;
  months: number;
  plan: PaidPlanId;
  term: TermOption;
  onPaid: () => void;
  onUseBankTransfer: () => void;
}

export interface SubscriptionDetailsProps {
  planName: string;
  currentTerm: CurrentTerm | null;
  monthlyLimit: number | null;
  cancelled: string | null;
  endsOn: string | null;
  daysLeft: number | null;
  invoicesThisMonth: number;
}

export interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  endsOn: string | null;
  busy: boolean;
  onConfirm: () => void;
}
