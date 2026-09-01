import * as React from 'react';
import { Check, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { formatDate } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import { notify } from '@/lib/toast';
import { STATUS_META, displayStatus, type InvoiceStatus } from '@/lib/types';

interface Props {
  invoiceId: string;
  status: InvoiceStatus;
  paidAt?: string | null;
  /** Needed to derive the overdue badge; lateness is never stored. */
  dueDate?: string | null;
  /** `row` is the compact control used in the invoice list. */
  variant?: 'row' | 'panel';
  /**
   * Render the status badge too.
   *
   * The list used to draw the badge in Astro and the button in this island, so
   * after a click the row showed "Unpaid" next to "Mark as unpaid" until the
   * page was reloaded — two components describing the same fact from two
   * different sources. Owning both here keeps them in step.
   */
  showBadge?: boolean;
  /**
   * Told when the payment state actually changes on the server.
   *
   * Without this the component was a state island: it flipped its own copy of
   * `status` and the form around it never heard, so the status dropdown stayed
   * on "unpaid" after a successful payment — and saving would then try to write
   * that stale value back, which the database refuses.
   */
  onStatusChange?: (status: InvoiceStatus, paidAt: string | null) => void;
}

/**
 * One click to answer "has this been paid?".
 *
 * Marking an invoice paid used to mean opening it, finding the status dropdown,
 * changing it and saving the whole form — so in practice the status went stale
 * and nobody could trust the list. This writes just the payment state.
 *
 * Drafts are excluded on purpose: an invoice that was never issued cannot have
 * been paid, and offering the button there invites a nonsense record.
 */
export default function PaidToggle({
  invoiceId,
  status: initialStatus,
  paidAt: initialPaidAt = null,
  dueDate = null,
  variant = 'row',
  showBadge = false,
  onStatusChange,
}: Props) {
  const t = useTranslations();
  const [status, setStatus] = React.useState<InvoiceStatus>(initialStatus);
  const [paidAt, setPaidAt] = React.useState<string | null>(initialPaidAt);

  /*
    Follow the props when a parent owns the value. In the invoice list nothing
    else renders this row, so the props never change and this is inert; in the
    editor the parent re-renders with the new status and the two stay in step.
  */
  React.useEffect(() => setStatus(initialStatus), [initialStatus]);
  React.useEffect(() => setPaidAt(initialPaidAt), [initialPaidAt]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isPaid = status === 'paid';

  async function toggle() {
    setBusy(true);
    setError(null);

    // Optimistic: the row flips immediately, and rolls back if the write fails.
    const previous = { status, paidAt };
    setStatus(isPaid ? 'unpaid' : 'paid');
    setPaidAt(isPaid ? null : new Date().toISOString());

    try {
      const { data, error: rpcError } = await supabase.rpc('set_invoice_paid', {
        p_invoice: invoiceId,
        p_paid: !isPaid,
      });
      if (rpcError) throw rpcError;

      // Trust the server's answer over the guess above — the trigger owns
      // paid_at, so its value is the real one.
      const row = data as { status: InvoiceStatus; paid_at: string | null };
      setStatus(row.status);
      setPaidAt(row.paid_at);
      onStatusChange?.(row.status, row.paid_at);
      notify.success(
        row.status === 'paid' ? t('inv.markedPaid') : t('inv.markedUnpaid'),
        row.status === 'paid'
          ? t('inv.markedPaidDesc', { date: formatDate(row.paid_at ?? '') })
          : t('inv.markedUnpaidDesc')
      );
    } catch (err) {
      setStatus(previous.status);
      setPaidAt(previous.paidAt);
      const message = (err as Error).message;
      setError(message || t('inv.markPaidFailed'));
      notify.error(t('inv.markPaidFailed'), message || t('common.unexpectedError'));
    } finally {
      setBusy(false);
    }
  }

  const shown = displayStatus(status, dueDate);
  const meta = STATUS_META[shown] ?? STATUS_META.draft;

  const badge = showBadge ? (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.className}`}
    >
      {t(`status.${shown}` as 'status.draft')}
    </span>
  ) : null;

  // A draft was never issued, so it cannot have been paid — badge only.
  if (status === 'draft') return badge;

  /*
    Paid is terminal. The database refuses to move an invoice off 'paid'
    (sync_invoice_paid_at), so offering a button that is guaranteed to fail
    would be a lie — the state is shown, not offered.
  */
  if (isPaid) {
    if (variant === 'panel') {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm font-medium">
              {t('inv.payment')}
            </span>
            <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-900 dark:bg-brand/20 dark:text-brand">
              {paidAt ? t('inv.paidOn', { date: formatDate(paidAt) }) : t('inv.paidLocked')}
            </span>
          </div>
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs leading-relaxed">
            <Lock className="mt-0.5 size-3 shrink-0" />
            {t('inv.paidLockedHint')}
          </p>
        </div>
      );
    }

    return showBadge ? (
      <span className="flex items-center justify-end gap-2">
        {badge}
        <Lock
          className="text-muted-foreground size-3.5 shrink-0"
          aria-label={t('inv.paidLockedHint')}
        />
      </span>
    ) : (
      <span
        className="text-muted-foreground inline-flex items-center gap-1.5 text-xs"
        title={t('inv.paidLockedHint')}
      >
        <Lock className="size-3.5" />
        {paidAt ? t('inv.paidOn', { date: formatDate(paidAt) }) : t('inv.paidLocked')}
      </span>
    );
  }

  if (variant === 'panel') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm font-medium">
            {t('inv.payment')}
          </span>
          <span
            className={[
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              isPaid
                ? 'bg-teal-100 text-teal-900 dark:bg-brand/20 dark:text-brand'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
            ].join(' ')}
          >
            {isPaid && paidAt
              ? t('inv.paidOn', { date: formatDate(paidAt) })
              : t('inv.notPaidYet')}
          </span>
        </div>

        <Button
          type="button"
          variant="default"
          onClick={toggle}
          disabled={busy}
          className="press w-full"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Check />}
          {t('inv.markPaid')}
        </Button>

        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </div>
    );
  }

  const button = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={toggle}
      disabled={busy}
      title={error ?? undefined}
      aria-label={t('inv.markPaid')}
      className={[
        'press whitespace-nowrap',
        error ? 'border-destructive text-destructive' : '',
      ].join(' ')}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Check />}
      <span className="hidden sm:inline">{t('inv.markPaid')}</span>
    </Button>
  );

  if (!showBadge) return button;

  return (
    <span className="flex items-center justify-end gap-2">
      {badge}
      {button}
    </span>
  );
}
