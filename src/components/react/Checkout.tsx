import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { formatLongDate } from '@/lib/utils';
import { PLANS, invoiceLimitOf, planOf, quotaReached, usageRatio as quotaRatio } from '@/lib/plans';
import { termOptions } from '@/lib/payments';
import { flashToast, notify } from '@/lib/toast';
import BankTransferPanel from './checkout/BankTransferPanel';
import CancelSubscriptionDialog from './checkout/CancelSubscriptionDialog';
import GatewayPanel from './checkout/GatewayPanel';
import MembershipCard from './checkout/MembershipCard';
import SubscriptionDetails from './checkout/SubscriptionDetails';
import { MethodPicker, PlanPicker, TermPicker } from './checkout/PurchasePickers';
import type { CheckoutPayment, CheckoutProps, PaidPlanId, PaymentMethod } from '@/models/billing';

/*
  The subscription page. This file owns the purchase state and the calls that
  change the subscription; the parts it is drawn from live in ./checkout.
*/

const DAY_MS = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
}

export default function Checkout({
  methods,
  bank,
  bankConfigured,
  paypalClientId,
  paypalCurrency = 'EUR',
  cardFieldsEnabled = false,
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
}: CheckoutProps) {
  const [months, setMonths] = React.useState(initialMonths);
  const [plan, setPlan] = React.useState<PaidPlanId>(initialPlan);
  const [method, setMethod] = React.useState<PaymentMethod>('bank_transfer');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<CheckoutPayment | null>(pending);

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
      notify.success(
        'Abonimi u anulua.',
        'Mbetet aktiv deri në fund të periudhës që ke paguar.'
      );
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      notify.error('Anulimi dështoi', message);
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
      notify.success('Abonimi u rikthye.', 'Rinovimi automatik është sërish aktiv.');
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      notify.error('Rikthimi dështoi', message);
    } finally {
      setCancelBusy(false);
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
      setOrder(data as CheckoutPayment);
      notify.success(
        'Referenca e pagesës u krijua.',
        'Vendose në përshkrimin e transfertës që ta gjejmë pagesën.'
      );
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      notify.error('Pagesa nuk u nis', message);
    } finally {
      setBusy(false);
    }
  }

  /*
    A captured order has already been confirmed by confirm_paid_payment() with
    the service role. Everything this page shows about the subscription — the
    period, the plan, the history — is derived server-side, so the truthful way
    to reflect it is to re-read the page rather than to patch local state.
  */
  const onPaypalPaid = React.useCallback(() => {
    flashToast(
      'success',
      'Pagesa u krye.',
      'Plani u aktivizua menjëherë — faleminderit!'
    );
    window.location.reload();
  }, []);

  const errorBanner = error && (
    <p
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive animate-rise rounded-xl border px-4 py-3 text-sm font-medium"
    >
      {error}
    </p>
  );

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

      <PlanPicker plan={plan} onPlan={setPlan} activePlan={activePlan} isDowngrade={isDowngrade} />

      <TermPicker
        months={months}
        onMonths={setMonths}
        terms={terms}
        renewing={proActive}
        onClose={() => setBuying(false)}
      />

      <MethodPicker methods={methods} method={method} onMethod={setMethod} />

      {method === 'bank_transfer' && (
        <BankTransferPanel
          bank={bank}
          bankConfigured={bankConfigured}
          order={order}
          plan={plan}
          term={selected}
          busy={busy}
          onStart={startPayment}
          onError={setError}
        />
      )}

      {(method === 'card' || method === 'paypal') && (
        <GatewayPanel
          method={activeMethod}
          mode={method}
          paypalClientId={paypalClientId}
          paypalCurrency={paypalCurrency}
          cardFieldsEnabled={cardFieldsEnabled}
          months={months}
          plan={plan}
          term={selected}
          onPaid={onPaypalPaid}
          onUseBankTransfer={() => setMethod('bank_transfer')}
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <MembershipCard
        proActive={proActive}
        activePlan={activePlan}
        cancelled={cancelled}
        endsOn={endsOn}
        daysLeft={daysLeft}
        periodProgress={periodProgress}
        monthlyLimit={monthlyLimit}
        invoicesThisMonth={invoicesThisMonth}
        usageRatio={usageRatio}
        overLimit={overLimit}
        cancelBusy={cancelBusy}
        onResume={resumeSubscription}
        onBuy={(next) => {
          if (next) setPlan(next);
          setBuying(true);
        }}
        onCancel={() => setShowCancel(true)}
      />
      {proActive && errorBanner}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {buying ? (
            purchase
          ) : (
            <SubscriptionDetails
              planName={active.name}
              currentTerm={currentTerm}
              monthlyLimit={monthlyLimit}
              cancelled={cancelled}
              endsOn={endsOn}
              daysLeft={daysLeft}
              invoicesThisMonth={invoicesThisMonth}
            />
          )}
        </div>

        <aside className="flex flex-col gap-6">{children}</aside>
      </div>

      <CancelSubscriptionDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        planName={active.name}
        endsOn={endsOn}
        busy={cancelBusy}
        onConfirm={cancelSubscription}
      />
    </div>
  );
}
