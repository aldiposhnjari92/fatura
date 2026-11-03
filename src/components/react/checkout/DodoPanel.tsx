import * as React from 'react';
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { PLANS } from '@/lib/plans';
import { notify } from '@/lib/toast';
import { formatALL } from '@/lib/utils';
import type { DodoPanelProps } from '@/models/billing';

/*
  Card payment through Dodo Payments. One button: the server opens the
  payment row and a checkout session (/api/payments/dodo), and the browser
  goes to Dodo's hosted page — card details never touch this app. The plan
  activates when Dodo's webhook confirms the payment, which Abonimi waits
  for when the customer comes back (see use-dodo-return.ts).
*/

export default function DodoPanel({ months, plan, term }: DodoPanelProps) {
  const [busy, setBusy] = React.useState(false);

  async function pay() {
    setBusy(true);
    try {
      const response = await fetch('/api/payments/dodo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ months, plan }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.message ?? 'Pagesa nuk u hap. Provo sërish pas pak.');
      // Stays busy: the page is leaving for Dodo's checkout.
      window.location.assign(data.url);
    } catch (err) {
      notify.error('Pagesa nuk u hap', (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <Button size="lg" className="press w-full sm:w-auto sm:self-start" disabled={busy} onClick={pay}>
        {busy ? <Loader2 className="animate-spin" /> : <CreditCard />}
        Paguaj {formatALL(term.total)}
      </Button>
      <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Do të kalosh në faqen e sigurt të Dodo Payments për {PLANS[plan].name}, {term.periodLabel}. Mund
        të shtohet TVSH-ja e vendit tënd. Plani aktivizohet sapo të konfirmohet pagesa.
      </p>
    </div>
  );
}
