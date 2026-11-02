import { PLANS } from '@/lib/plans';
import { formatALL } from '@/lib/utils';
import type { SubscriptionDetailsProps } from '@/models/billing';

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

/** What a paying customer sees instead of a checkout form: the plan they have. */
export default function SubscriptionDetails({
  planName,
  currentTerm,
  monthlyLimit,
  cancelled,
  endsOn,
  daysLeft,
  invoicesThisMonth,
}: SubscriptionDetailsProps) {
  const rows = [
    {
      k: 'Plani',
      v: planName,
      sub: currentTerm
        ? termLabel(currentTerm.months)
        : monthlyLimit === null
          ? 'Fatura të palimituara'
          : `${monthlyLimit} fatura në muaj`,
    },
    {
      k: cancelled ? 'Mbaron më' : 'Rinovohet më',
      v: endsOn ?? '—',
      sub: daysLeft !== null ? `edhe ${daysLeft} ditë` : undefined,
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
      sub: monthlyLimit === null ? 'pa limit në Pro' : `nga ${monthlyLimit} në ${planName}`,
    },
  ];

  return (
    <section className="bg-card shadow-card rounded-2xl p-6">
      <h2 className="font-semibold">Detajet e abonimit</h2>
      <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.k}>
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {row.k}
            </dt>
            <dd className="mt-1 font-semibold">{row.v}</dd>
            {row.sub && <dd className="text-muted-foreground text-sm">{row.sub}</dd>}
          </div>
        ))}
      </dl>

      <p className="text-muted-foreground mt-6 border-t pt-4 text-sm leading-relaxed">
        {cancelled
          ? 'Pas kësaj date llogaria kalon vetë në planin falas. Faturat ekzistuese mbeten të gjitha aty.'
          : `Nëse e anulon, ${planName} vazhdon deri në fund të periudhës së paguar dhe pastaj kthehesh te plani falas (${PLANS.free.invoiceLimit} fatura në muaj).`}
      </p>
    </section>
  );
}
