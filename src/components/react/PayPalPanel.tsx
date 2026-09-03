import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { Label } from '@/components/ui/react/label';
import { loadPayPalSdk, type PayPalCardFields } from '@/lib/paypal-sdk';
import type { PaidPlanId } from '@/lib/plans';

/*
  The PayPal half of the checkout.

  /api/payments/paypal has always been able to open and capture an order, but
  nothing in the browser ever called it: the checkout rendered an empty mount
  point and no SDK. This component is that missing half — the buttons for a
  PayPal balance, the hosted card fields for a Visa/Mastercard.

  The amount is never sent from here. `createOrder` posts only the term and the
  tier; create_payment() prices it in SQL and the order is opened server-side
  against that row, so a tampered client can pick what it buys but not what it
  pays.
*/

type Mode = 'paypal' | 'card';

interface Props {
  clientId: string;
  /** Must match PAYPAL_CURRENCY — the currency the server puts on the order. */
  currency: string;
  /** Whether Advanced Card Payments is approved on the merchant account. */
  cardFieldsEnabled: boolean;
  mode: Mode;
  months: number;
  plan: PaidPlanId;
  /** Called after a capture completes, before the page reloads its state. */
  onPaid: () => void;
}

interface OrderRequest {
  months: number;
  plan: PaidPlanId;
}

async function postAction(body: Record<string, unknown>) {
  const response = await fetch('/api/payments/paypal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : typeof data.error === 'string'
          ? data.error
          : 'Pagesa dështoi.'
    );
  }
  return data;
}

/* The hosted fields are cross-origin iframes, so they are styled through this
   object rather than by our CSS. Kept close to the Input component's look. */
const FIELD_STYLE = {
  input: {
    'font-family':
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    'font-size': '14px',
    color: '#111827',
    padding: '0',
  },
  '.invalid': { color: '#dc2626' },
};

const FIELD_BOX =
  'border-input bg-background h-10 rounded-md border px-3 shadow-sm [&>iframe]:h-full [&>iframe]:w-full';

export default function PayPalPanel({
  clientId,
  currency,
  cardFieldsEnabled,
  mode,
  months,
  plan,
  onPaid,
}: Props) {
  const buttonsRef = React.useRef<HTMLDivElement>(null);
  const nameRef = React.useRef<HTMLDivElement>(null);
  const numberRef = React.useRef<HTMLDivElement>(null);
  const expiryRef = React.useRef<HTMLDivElement>(null);
  const cvvRef = React.useRef<HTMLDivElement>(null);
  const fieldsRef = React.useRef<PayPalCardFields | null>(null);

  const [status, setStatus] = React.useState<'loading' | 'ready' | 'ineligible' | 'error'>(
    'loading'
  );
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  /*
    The SDK captures these callbacks once, at render time. Reading the term and
    the tier out of a ref means changing either one above still opens the order
    the visitor is looking at — a closure over the props would keep buying
    whatever was selected when the buttons first mounted.
  */
  const request = React.useRef<OrderRequest>({ months, plan });
  request.current = { months, plan };

  const handlers = React.useMemo(
    () => ({
      createOrder: async () => {
        const data = await postAction({ action: 'create', ...request.current });
        return String(data.id);
      },
      onApprove: async (data: { orderID: string }) => {
        await postAction({ action: 'capture', orderId: data.orderID });
        onPaid();
      },
      onError: (err: unknown) => {
        setError(err instanceof Error ? err.message : 'Pagesa dështoi.');
      },
    }),
    [onPaid]
  );

  React.useEffect(() => {
    let cancelled = false;
    let teardown: (() => void) | undefined;

    setStatus('loading');
    setError(null);

    loadPayPalSdk({ clientId, currency, cardFields: cardFieldsEnabled })
      .then(async (paypal) => {
        if (cancelled) return;

        if (mode === 'paypal') {
          if (!paypal.Buttons) throw new Error('PayPal buttons are unavailable.');
          const buttons = paypal.Buttons({
            style: { layout: 'vertical', shape: 'pill', height: 44 },
            ...handlers,
          });
          if (buttons.isEligible && !buttons.isEligible()) {
            if (!cancelled) setStatus('ineligible');
            return;
          }
          if (!buttonsRef.current) return;
          teardown = () => {
            // close() throws if the buttons never finished rendering; a torn
            // down panel is not worth an unhandled rejection.
            try {
              buttons.close();
            } catch {
              /* already gone */
            }
          };
          await buttons.render(buttonsRef.current);
          if (!cancelled) setStatus('ready');
          return;
        }

        if (!paypal.CardFields) throw new Error('Card fields are unavailable.');
        const fields = paypal.CardFields({ style: FIELD_STYLE, ...handlers });
        if (!fields.isEligible()) {
          if (!cancelled) setStatus('ineligible');
          return;
        }
        fieldsRef.current = fields;

        const mounted = [
          fields.NumberField(),
          fields.ExpiryField(),
          fields.CVVField(),
          fields.NameField(),
        ];
        const targets = [
          numberRef.current,
          expiryRef.current,
          cvvRef.current,
          nameRef.current,
        ];
        teardown = () => {
          fieldsRef.current = null;
          for (const field of mounted) void field.close?.().catch(() => {});
        };

        for (const [index, field] of mounted.entries()) {
          const target = targets[index];
          if (target) await field.render(target);
        }
        if (!cancelled) setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'PayPal nuk u ngarkua.');
      });

    return () => {
      cancelled = true;
      teardown?.();
    };
    // Remounted when the payment method changes; the term and tier ride along
    // in `request` so switching those does not tear the SDK down.
  }, [clientId, currency, cardFieldsEnabled, mode, handlers]);

  async function submitCard() {
    if (!fieldsRef.current) return;
    setSubmitting(true);
    setError(null);
    try {
      await fieldsRef.current.submit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Karta nuk u pranua.');
    } finally {
      setSubmitting(false);
    }
  }

  const notice = error && (
    <p
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-xl border px-4 py-3 text-sm font-medium"
    >
      {error}
    </p>
  );

  if (status === 'ineligible') {
    return (
      <p className="border-warning/40 bg-warning/10 mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed">
        {mode === 'card'
          ? 'Llogaria tregtare nuk e ka ende të aprovuar pagesën me kartë (Advanced Card Payments). Përdor PayPal ose transfertën bankare.'
          : 'PayPal nuk është i disponueshëm për këtë llogari. Përdor transfertën bankare.'}
      </p>
    );
  }

  return (
    <div className="mt-4">
      {status === 'loading' && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Po ngarkohet {mode === 'card' ? 'formulari i kartës' : 'PayPal'}…
        </p>
      )}

      {/* Both trees stay mounted: the SDK renders into these nodes, so they
          have to exist before the render call, not after it. */}
      <div hidden={mode !== 'paypal' || status !== 'ready'}>
        <div ref={buttonsRef} />
      </div>

      <div
        hidden={mode !== 'card' || status !== 'ready'}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label>Numri i kartës</Label>
          <div ref={numberRef} className={FIELD_BOX} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Skadon</Label>
            <div ref={expiryRef} className={FIELD_BOX} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>CVV</Label>
            <div ref={cvvRef} className={FIELD_BOX} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Emri mbi kartë</Label>
          <div ref={nameRef} className={FIELD_BOX} />
        </div>
        <Button onClick={submitCard} disabled={submitting} className="press w-full">
          {submitting && <Loader2 className="animate-spin" />}
          Paguaj me kartë
        </Button>
      </div>

      {notice}
    </div>
  );
}
