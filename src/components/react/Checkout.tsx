import * as React from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  Sparkles,
  Undo2,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { formatALL, formatLongDate } from '@/lib/utils';
import {
  PAID_PLANS,
  PLANS,
  invoiceLimitOf,
  planOf,
  quotaReached,
  usageRatio as quotaRatio,
  type PaidPlanId,
  type PlanId,
} from '@/lib/plans';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import {
  termOptions,
  type BankDetails,
  type MethodInfo,
  type PaymentMethod,
} from '@/lib/payments';

interface PendingPayment {
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

interface Props {
  methods: MethodInfo[];
  bank: BankDetails;
  bankConfigured: boolean;
  paypalClientId: string | null;
  pending: PendingPayment | null;
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
  currentTerm?: { months: number; method: string; amount: number } | null;
  /** Term chosen on the pricing page and carried through signup. */
  initialMonths?: number;
  /** Tier chosen on the pricing page and carried through signup. */
  initialPlan?: PaidPlanId;
  /** True when the visitor arrived here straight after picking a paid plan. */
  fromSignup?: boolean;
  /** The page's side rail, slotted in so the island can own the full layout. */
  children?: React.ReactNode;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  landmark: Landmark,
  'credit-card': CreditCard,
  wallet: Wallet,
};

const DAY_MS = 86_400_000;

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Transfertë bankare',
  card: 'Kartë',
  paypal: 'PayPal',
};

function termLabel(months: number): string {
  if (months === 1) return 'Abonim mujor';
  if (months === 12) return 'Abonim vjetor';
  return `Abonim ${months}-mujor`;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
}

export default function Checkout({
  methods,
  bank,
  bankConfigured,
  paypalClientId,
  pending,
  activePlan,
  proActive,
  proUntil,
  cancelledAt = null,
  periodStart = null,
  invoicesThisMonth = 0,
  currentTerm = null,
  initialMonths = 1,
  initialPlan = 'pro',
  fromSignup = false,
  children,
}: Props) {
  const [months, setMonths] = React.useState(initialMonths);
  const [plan, setPlan] = React.useState<PaidPlanId>(initialPlan);
  const [method, setMethod] = React.useState<PaymentMethod>('bank_transfer');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<PendingPayment | null>(pending);

  const [cancelled, setCancelled] = React.useState<string | null>(cancelledAt);
  const [showCancel, setShowCancel] = React.useState(false);
  const [cancelBusy, setCancelBusy] = React.useState(false);

  /*
    A Pro customer lands on the status card, not on a checkout form — being
    sold something you already own is the main thing that made the old page
    feel wrong. The purchase flow is still one click away for renewals.
  */
  const [buying, setBuying] = React.useState(!proActive || Boolean(pending));

  const terms = React.useMemo(() => termOptions(plan), [plan]);
  const selected = terms.find((o) => o.months === months) ?? terms[0];
  const activeMethod = methods.find((m) => m.id === method);
  const endsOn = proUntil ? formatLongDate(proUntil) : null;

  const active = planOf(activePlan);
  const chosen = PLANS[plan];
  /*
    Buying Starter while Pro is still running is a downgrade the moment the
    payment clears — confirm_paid_payment() takes the plan from the payment.
    Say so here rather than letting someone discover it after the transfer.
  */
  const isDowngrade = activePlan === 'pro' && plan === 'starter';

  // Rendered only after mount so the server and client never disagree on "now".
  const [today, setToday] = React.useState<Date | null>(null);
  React.useEffect(() => setToday(new Date()), []);

  const daysLeft = today && proUntil ? daysBetween(today, new Date(proUntil)) : null;

  /* Fraction of the paid period already used. Null when we cannot know it. */
  const periodProgress = React.useMemo(() => {
    if (!today || !proUntil || !periodStart) return null;
    const start = new Date(periodStart).getTime();
    const end = new Date(proUntil).getTime();
    if (!(end > start)) return null;
    const ratio = (today.getTime() - start) / (end - start);
    return Math.min(1, Math.max(0, ratio));
  }, [today, proUntil, periodStart]);

  /* The meter follows the tier in force: 5 on free, 30 on Starter, hidden on Pro. */
  const monthlyLimit = invoiceLimitOf(activePlan);
  const usageRatio = quotaRatio(activePlan, invoicesThisMonth);
  const overLimit = quotaReached(activePlan, invoicesThisMonth);

  /** Cancelling never revokes anything — it only stops the renewal. */
  async function cancelSubscription() {
    setCancelBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('cancel_subscription');
      if (rpcError) throw rpcError;
      setCancelled((data as { cancelled_at: string }).cancelled_at);
      setShowCancel(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelBusy(false);
    }
  }

  async function resumeSubscription() {
    setCancelBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('resume_subscription');
      if (rpcError) throw rpcError;
      setCancelled(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelBusy(false);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError('Kopjimi dështoi. Zgjidhe dhe kopjoje manualisht.');
    }
  }

  /** The server computes the amount — the client only asks for a method+term. */
  async function startPayment() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('create_payment', {
        p_method: method,
        p_months: months,
        p_plan: plan,
      });
      if (rpcError) throw rpcError;
      setOrder(data as PendingPayment);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const errorBanner = error && (
    <p
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive animate-rise rounded-xl border px-4 py-3 text-sm font-medium"
    >
      {error}
    </p>
  );

  /* ================================================================
     The membership card — the whole point of the page for a customer
     who already pays. Ink surface with the brand teal, matching the
     featured pricing card on the marketing site.
     ================================================================ */
  const hero = (
    <div
      className={[
        'animate-rise relative isolate overflow-hidden rounded-2xl p-6 sm:p-8',
        // `dark` flips the tokens inside so nested primitives (Button, badges)
        // read light on the ink surface instead of dark-on-dark.
        proActive
          ? 'dark bg-ink text-mist shadow-2xl ring-1 ring-white/10'
          : 'bg-card ring-border text-foreground ring-1',
      ].join(' ')}
    >
      {proActive && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-px right-12 left-12 h-px bg-gradient-to-r from-transparent via-[#00ADB5] to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-16 -z-10 size-64 rounded-full bg-[#00ADB5]/20 blur-3xl"
          />
        </>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={[
              'flex size-11 shrink-0 items-center justify-center rounded-xl',
              proActive ? 'bg-brand text-ink' : 'bg-accent text-primary',
            ].join(' ')}
          >
            <Sparkles className="size-5" />
          </span>
          <div>
            <p
              className={[
                'text-[11px] font-bold tracking-[0.16em] uppercase',
                proActive ? 'text-brand' : 'text-muted-foreground',
              ].join(' ')}
            >
              Plani yt
            </p>
            <p className="text-2xl font-semibold tracking-tight">
              {proActive ? active.name : PLANS.free.name}
            </p>
          </div>
        </div>

        <span
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold',
            !proActive
              ? 'bg-secondary text-secondary-foreground'
              : cancelled
                ? 'bg-amber-400/20 text-amber-200'
                : 'bg-brand/20 text-brand',
          ].join(' ')}
        >
          {!proActive ? 'Aktiv' : cancelled ? 'Nuk rinovohet' : 'Aktiv'}
        </span>
      </div>

      {proActive ? (
        <>
          <p
            className={[
              'mt-6 max-w-xl text-sm leading-relaxed',
              cancelled ? 'text-mist/75' : 'text-mist/70',
            ].join(' ')}
          >
            {cancelled ? (
              <>
                Abonimi nuk do të rinovohet. Vazhdon me të gjitha veçoritë e planit{' '}
                {active.name} deri më <strong className="text-mist">{endsOn}</strong>,
                pastaj llogaria kalon vetë në planin falas. Asnjë faturë nuk fshihet.
              </>
            ) : (
              <>
                {monthlyLimit === null
                  ? 'Fatura të palimituara dhe mbështetje me përparësi.'
                  : `${monthlyLimit} fatura në muaj, me të gjitha veçoritë e dokumentit.`}{' '}
                Rinovohet më <strong className="text-mist">{endsOn}</strong>.
              </>
            )}
          </p>

          {daysLeft !== null && (
            <div className="mt-7">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-mist text-sm font-medium">
                  <span className="text-2xl font-bold tabular-nums">{daysLeft}</span>{' '}
                  <span className="text-mist/60">
                    {/* "ditë" is invariant after a numeral in Albanian. */}
                    ditë {cancelled ? 'të mbetura' : 'deri në rinovim'}
                  </span>
                </p>
                {endsOn && <p className="text-mist/45 text-xs">{endsOn}</p>}
              </div>

              {periodProgress !== null && (
                <div
                  className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(periodProgress * 100)}
                  aria-label="Periudha e paguar"
                >
                  <div
                    className={[
                      'bar-fill h-full rounded-full',
                      cancelled ? 'bg-amber-300' : 'bg-brand',
                    ].join(' ')}
                    style={{ width: `${Math.max(2, periodProgress * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Starter is paid but still capped, so the meter belongs here too. */}
          {monthlyLimit !== null && (
            <div className="mt-7">
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <p className="text-mist font-medium">
                  <span className="text-2xl font-bold tabular-nums">
                    {invoicesThisMonth}
                  </span>
                  <span className="text-mist/60"> nga {monthlyLimit} fatura këtë muaj</span>
                </p>
                {overLimit && (
                  <span className="text-xs font-semibold text-amber-300">
                    Kuota u mbush
                  </span>
                )}
              </div>

              <div
                className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={monthlyLimit}
                aria-valuenow={invoicesThisMonth}
                aria-label="Fatura të përdorura këtë muaj"
              >
                <div
                  className={[
                    'bar-fill h-full rounded-full',
                    overLimit ? 'bg-amber-300' : 'bg-brand',
                  ].join(' ')}
                  style={{ width: `${Math.max(2, usageRatio * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {cancelled ? (
              <Button
                className="bg-brand text-ink hover:bg-brand/90 press"
                disabled={cancelBusy}
                onClick={resumeSubscription}
              >
                {cancelBusy ? <Loader2 className="animate-spin" /> : <Undo2 />}
                Rikthe abonimin
              </Button>
            ) : activePlan === 'starter' ? (
              <>
                <Button
                  className="bg-brand text-ink hover:bg-brand/90 press"
                  onClick={() => {
                    setPlan('pro');
                    setBuying(true);
                  }}
                >
                  Kalo në Pro <ArrowRight />
                </Button>
                <Button
                  variant="ghost"
                  className="text-mist/70 hover:bg-white/5 hover:text-mist"
                  onClick={() => {
                    setPlan('starter');
                    setBuying(true);
                  }}
                >
                  Zgjat Starter
                </Button>
              </>
            ) : (
              <Button
                className="bg-brand text-ink hover:bg-brand/90 press"
                onClick={() => setBuying(true)}
              >
                Zgjat abonimin <ArrowRight />
              </Button>
            )}

            {!cancelled && (
              <Button
                variant="ghost"
                className="text-mist/60 hover:bg-white/5 hover:text-mist"
                onClick={() => setShowCancel(true)}
              >
                Anulo abonimin
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground mt-6 max-w-xl text-sm leading-relaxed">
            Plani falas mbulon {PLANS.free.invoiceLimit} fatura në muaj me të gjitha
            veçoritë e dokumentit — logo, NIPT, TVSH dhe PDF i gatshëm.
          </p>

          <div className="mt-7">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <p className="font-medium">
                <span className="text-2xl font-bold tabular-nums">
                  {invoicesThisMonth}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  nga {monthlyLimit} fatura këtë muaj
                </span>
              </p>
              {overLimit && (
                <span className="text-warning text-xs font-semibold">Kuota u mbush</span>
              )}
            </div>

            <div
              className="bg-secondary mt-3 h-1.5 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={monthlyLimit ?? 0}
              aria-valuenow={invoicesThisMonth}
              aria-label="Fatura të përdorura këtë muaj"
            >
              <div
                className={[
                  'bar-fill h-full rounded-full',
                  overLimit ? 'bg-warning' : 'bg-primary',
                ].join(' ')}
                style={{ width: `${Math.max(2, usageRatio * 100)}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );

  /* ================================================================ */

  const purchase = (
    <div className="flex flex-col gap-5">
      {fromSignup && !proActive && (
        <div className="border-primary/25 bg-accent/40 animate-rise rounded-xl border px-4 py-3">
          <p className="text-sm font-semibold">Llogaria u krijua ✓</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Plani {chosen.name} aktivizohet pasi të konfirmohet pagesa. Deri atëherë
            llogaria punon me planin falas — asnjë faturë nuk humbet.
          </p>
        </div>
      )}

      {errorBanner}

      {/* Plan */}
      <section className="bg-card ring-border rounded-2xl p-5 ring-1 sm:p-6">
        <h2 className="font-semibold">Zgjidh planin</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          I njëjti dokument në të dyja planet. Ndryshon vetëm sa fatura mund të lëshosh
          në muaj.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {PAID_PLANS.map((option) => {
            const isSelected = plan === option.id;
            const limit = option.invoiceLimit;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setPlan(option.id as PaidPlanId)}
                aria-pressed={isSelected}
                className={[
                  'press relative rounded-xl border p-4 text-left',
                  isSelected
                    ? 'border-primary bg-accent/50 ring-primary/25 ring-2'
                    : 'hover:border-input hover:bg-muted/50',
                ].join(' ')}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{option.name}</span>
                  <span
                    className={[
                      'flex size-4 shrink-0 items-center justify-center rounded-full border',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input',
                    ].join(' ')}
                  >
                    {isSelected && <Check className="size-2.5" strokeWidth={3.5} />}
                  </span>
                </span>
                <span className="mt-2 block text-lg font-bold tabular-nums">
                  {formatALL(option.monthlyALL)}
                  <span className="text-muted-foreground text-xs font-medium">/muaj</span>
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {limit === null ? 'Fatura të palimituara' : `${limit} fatura në muaj`}
                </span>
                {activePlan === option.id && (
                  <span className="bg-secondary text-secondary-foreground absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    Plani yt
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isDowngrade && (
          <p className="border-warning/40 bg-warning/10 mt-4 rounded-lg border px-3 py-2 text-xs leading-relaxed">
            Ke Pro aktiv. Nëse paguan për Starter, llogaria kalon në Starter (
            {PLANS.starter.invoiceLimit} fatura në muaj) sapo të konfirmohet pagesa, dhe
            koha e re i shtohet asaj ekzistuese.
          </p>
        )}
      </section>

      {/* Term */}
      <section className="bg-card ring-border rounded-2xl p-5 ring-1 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">
              {proActive ? 'Sa gjatë do ta zgjatësh?' : 'Zgjidh kohëzgjatjen'}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {proActive
                ? 'Koha e re i shtohet asaj që ke — nuk humbet asnjë ditë.'
                : 'Paguaj një herë për disa muaj — një transfertë e vetme. Anulo kur të duash.'}
            </p>
          </div>
          {proActive && (
            <button
              type="button"
              onClick={() => setBuying(false)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground -mr-1 shrink-0 rounded-lg p-2"
              aria-label="Mbyll"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Four terms: two rows on a phone, one row once the column is wide. */}
        <div className="mt-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
          {terms.map((option) => {
            const isSelected = months === option.months;
            return (
              <button
                key={option.months}
                type="button"
                onClick={() => setMonths(option.months)}
                aria-pressed={isSelected}
                className={[
                  'press relative rounded-xl border p-4 text-left',
                  isSelected
                    ? 'border-primary bg-accent/50 ring-primary/25 ring-2'
                    : 'hover:border-input hover:bg-muted/50',
                ].join(' ')}
              >
                {option.best && (
                  <span className="bg-brand text-ink absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm">
                    Më i mirë
                  </span>
                )}
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span
                    className={[
                      'flex size-4 shrink-0 items-center justify-center rounded-full border',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input',
                    ].join(' ')}
                  >
                    {isSelected && <Check className="size-2.5" strokeWidth={3.5} />}
                  </span>
                </span>
                <span className="mt-2 block text-lg font-bold tabular-nums">
                  {formatALL(option.total)}
                </span>
                {option.note && (
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {option.note}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Method */}
      <section className="bg-card ring-border rounded-2xl p-5 ring-1 sm:p-6">
        <h2 className="font-semibold">Mënyra e pagesës</h2>
        <div className="mt-5 flex flex-col gap-3">
          {methods.map((m) => {
            const Icon = ICONS[m.icon] ?? Landmark;
            const isSelected = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={!m.available}
                onClick={() => setMethod(m.id)}
                aria-pressed={isSelected}
                className={[
                  'press flex items-start gap-3 rounded-xl border p-4 text-left',
                  !m.available && 'cursor-not-allowed opacity-55',
                  isSelected && m.available
                    ? 'border-primary bg-accent/50 ring-primary/25 ring-2'
                    : m.available && 'hover:border-input hover:bg-muted/50',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span
                  className={[
                    'flex size-10 shrink-0 items-center justify-center rounded-lg',
                    isSelected && m.available
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  <Icon className="size-[1.1rem]" />
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{m.label}</span>
                    {!m.available && (
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        {m.unavailableReason ?? 'Së shpejti'}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-sm">
                    {m.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Bank transfer instructions */}
      {method === 'bank_transfer' && (
        <section className="bg-card ring-border rounded-2xl p-5 ring-1 sm:p-6">
          <h2 className="font-semibold">Të dhënat e transfertës</h2>

          {!bankConfigured && (
            <p className="border-warning/40 bg-warning/10 mt-3 rounded-lg border px-3 py-2 text-xs">
              Llogaria bankare nuk është konfiguruar ende (shih <code>BANK_IBAN</code> në
              .env). Të dhënat më poshtë janë shembull.
            </p>
          )}

          {!order ? (
            <>
              <div className="bg-muted/50 mt-4 flex items-center justify-between gap-4 rounded-xl px-4 py-3">
                <span className="text-muted-foreground text-sm">
                  {selected.label} · {chosen.name}
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {formatALL(selected.total)}
                </span>
              </div>
              <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                Shtyp më poshtë për të marrë një referencë unike. Vendose atë në
                përshkrimin e transfertës që ta gjejmë pagesën tënde.
              </p>
              <Button onClick={startPayment} disabled={busy} className="press mt-4">
                {busy && <Loader2 className="animate-spin" />}
                Merr referencën e pagesës
              </Button>
            </>
          ) : (
            <div className="animate-rise">
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                {[
                  { k: 'Përfituesi', v: bank.beneficiary },
                  { k: 'Banka', v: bank.bank },
                  { k: 'IBAN', v: bank.iban, mono: true, copyKey: 'iban' },
                  { k: 'SWIFT', v: bank.swift, mono: true },
                  { k: 'Shuma', v: formatALL(order.amount), strong: true },
                  {
                    k: 'Përshkrimi (i detyrueshëm)',
                    v: order.reference,
                    mono: true,
                    strong: true,
                    copyKey: 'ref',
                  },
                ].map((row) => (
                  <div
                    key={row.k}
                    className="flex items-center justify-between gap-3 border-b pb-2 last:border-0"
                  >
                    <dt className="text-muted-foreground shrink-0">{row.k}</dt>
                    <dd className="flex min-w-0 items-center gap-2">
                      <span
                        className={[
                          'truncate',
                          row.mono && 'font-mono text-xs',
                          row.strong && 'font-semibold',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {row.v}
                      </span>
                      {row.copyKey && (
                        <button
                          type="button"
                          onClick={() => copy(String(row.v), row.copyKey!)}
                          className="text-muted-foreground hover:text-foreground press shrink-0 rounded p-1"
                          aria-label={`Kopjo ${row.k}`}
                        >
                          {copied === row.copyKey ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              {/*
                create_payment() hands back the open bank request instead of
                issuing a second reference, so the tier and term shown here can
                differ from what is selected above. Say which one is waiting
                rather than letting the amount look wrong.
              */}
              {order.plan && order.plan !== plan && (
                <p className="border-warning/40 bg-warning/10 mt-4 rounded-lg border px-3 py-2 text-xs leading-relaxed">
                  Ke tashmë një kërkesë të hapur për planin{' '}
                  <strong>{planOf(order.plan).name}</strong>. Kjo referencë vlen për atë
                  plan — përfundoje ose na shkruaj nëse do ta ndryshosh.
                </p>
              )}

              <div className="bg-muted/60 mt-4 rounded-xl p-4">
                <p className="text-xs leading-relaxed">
                  <strong>Pas transfertës</strong> nuk ka nevojë të bësh gjë tjetër. Sapo
                  ta shohim pagesën me referencën{' '}
                  <code className="font-mono">{order.reference}</code>, aktivizojmë planin{' '}
                  {planOf(order.plan ?? plan).name} dhe të njoftojmë me email — zakonisht
                  brenda 24 orëve pune.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Card / PayPal */}
      {(method === 'card' || method === 'paypal') && (
        <section className="bg-card ring-border rounded-2xl p-5 ring-1 sm:p-6">
          <h2 className="font-semibold">{activeMethod?.label}</h2>

          {activeMethod?.available && paypalClientId ? (
            <>
              <p className="text-muted-foreground mt-2 text-sm">
                Do të paguash {formatALL(selected.total)} për {selected.label} ·{' '}
                {chosen.name}.
              </p>
              {/* Mount point for the PayPal SDK buttons; the order is created
                  and captured by /api/payments/paypal/* so the amount is never
                  taken from the browser. */}
              <div
                id="paypal-buttons"
                className="mt-4"
                data-months={months}
                data-plan={plan}
              />
            </>
          ) : (
            <div className="border-warning/40 bg-warning/10 mt-3 rounded-xl border px-4 py-3">
              <p className="text-sm font-medium">Kjo mënyrë nuk është aktive ende</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Stripe nuk mbulon Shqipërinë si vend tregtari dhe PayPal ka kufizime për
                marrjen e pagesave nga llogaritë shqiptare. Sapo të lidhet një llogari
                tregtare (bankë vendase ose PayPal Business), kjo mënyrë aktivizohet pa
                ndryshime të tjera. Deri atëherë, përdor transfertën bankare.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="press mt-3"
                onClick={() => setMethod('bank_transfer')}
              >
                <Landmark /> Përdor transfertë bankare
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {hero}
      {proActive && errorBanner}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {buying ? (
            purchase
          ) : (
            <section className="bg-card ring-border rounded-2xl p-5 ring-1 sm:p-6">
              <h2 className="font-semibold">Detajet e abonimit</h2>
              <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {[
                  {
                    k: 'Plani',
                    v: active.name,
                    sub: currentTerm
                      ? termLabel(currentTerm.months)
                      : monthlyLimit === null
                        ? 'Fatura të palimituara'
                        : `${monthlyLimit} fatura në muaj`,
                  },
                  {
                    k: cancelled ? 'Mbaron më' : 'Rinovohet më',
                    v: endsOn ?? '—',
                    sub:
                      daysLeft !== null
                        ? `edhe ${daysLeft} ditë`
                        : undefined,
                  },
                  {
                    k: 'Mënyra e pagesës',
                    v: currentTerm
                      ? (METHOD_LABELS[currentTerm.method] ?? currentTerm.method)
                      : 'Aktivizuar nga ekipi',
                    sub: currentTerm ? formatALL(currentTerm.amount) : undefined,
                  },
                  {
                    k: 'Fatura këtë muaj',
                    v: String(invoicesThisMonth),
                    sub:
                      monthlyLimit === null
                        ? 'pa limit në Pro'
                        : `nga ${monthlyLimit} në ${active.name}`,
                  },
                ].map((row) => (
                  <div key={row.k}>
                    <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {row.k}
                    </dt>
                    <dd className="mt-1 font-semibold">{row.v}</dd>
                    {row.sub && (
                      <dd className="text-muted-foreground text-sm">{row.sub}</dd>
                    )}
                  </div>
                ))}
              </dl>

              <p className="text-muted-foreground mt-6 border-t pt-4 text-sm leading-relaxed">
                {cancelled
                  ? 'Pas kësaj date llogaria kalon vetë në planin falas. Faturat ekzistuese mbeten të gjitha aty.'
                  : `Nëse e anulon, ${active.name} vazhdon deri në fund të periudhës së paguar dhe pastaj kthehesh te plani falas (${PLANS.free.invoiceLimit} fatura në muaj).`}
              </p>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6">{children}</aside>
      </div>

      {/* Cancel confirmation */}
      <Dialog
        open={showCancel}
        onOpenChange={(o) => !o && !cancelBusy && setShowCancel(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anulo abonimin {active.name}?</DialogTitle>
          </DialogHeader>

          <div className="border-primary/25 bg-accent/40 rounded-xl border px-4 py-3">
            <p className="text-sm font-medium">Nuk humbet asgjë tani</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {active.name} mbetet aktiv me të gjitha veçoritë deri më{' '}
              <strong className="text-foreground">{endsOn}</strong> — koha që ke paguar
              nuk shkurtohet. Pas asaj date kthehesh te plani falas (
              {PLANS.free.invoiceLimit} fatura në muaj) dhe faturat ekzistuese mbeten të
              paprekura.
            </p>
          </div>

          <p className="text-muted-foreground text-sm">
            Mund ta rikthesh në çdo moment para asaj date.
          </p>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCancel(false)}
              disabled={cancelBusy}
            >
              Mbaje {active.name}
            </Button>
            <Button
              variant="destructive"
              onClick={cancelSubscription}
              disabled={cancelBusy}
            >
              {cancelBusy && <Loader2 className="animate-spin" />}
              Anulo abonimin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
