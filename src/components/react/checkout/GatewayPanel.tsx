import * as React from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { PLANS } from '@/lib/plans';
import { formatALL } from '@/lib/utils';
import type { GatewayPanelProps } from '@/models/billing';

/*
  Only pulled in when a visitor actually picks card or PayPal. Bank transfer is
  the path nearly everyone takes, and it has no reason to carry the SDK glue.
*/
const PayPalPanel = React.lazy(() => import('@/components/react/PayPalPanel'));

/** Card or PayPal: the SDK when the gateway is live, otherwise why it is not. */
export default function GatewayPanel({
  method,
  mode,
  paypalClientId,
  paypalCurrency,
  cardFieldsEnabled,
  months,
  plan,
  term,
  onPaid,
  onUseBankTransfer,
}: GatewayPanelProps) {
  return (
    <section className="bg-card shadow-card rounded-2xl p-6">
      <h2 className="font-semibold">{method?.label}</h2>

      {method?.available && paypalClientId ? (
        <>
          <p className="text-muted-foreground mt-2 text-sm">
            Do të paguash {formatALL(term.total)} për {term.periodLabel} · {PLANS[plan].name}.
          </p>
          {/*
            The SDK mounts here. The order is opened and captured by
            /api/payments/paypal, so the amount is never taken from the
            browser — this side sends only the term and the tier.
          */}
          <React.Suspense
            fallback={
              <p className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Po ngarkohet…
              </p>
            }
          >
            <PayPalPanel
              clientId={paypalClientId}
              currency={paypalCurrency}
              cardFieldsEnabled={cardFieldsEnabled}
              mode={mode}
              months={months}
              plan={plan}
              onPaid={onPaid}
            />
          </React.Suspense>
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
          <Button variant="outline" size="sm" className="press mt-3" onClick={onUseBankTransfer}>
            <Landmark /> Përdor transfertë bankare
          </Button>
        </div>
      )}
    </section>
  );
}
