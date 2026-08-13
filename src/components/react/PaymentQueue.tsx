import * as React from 'react';
import { Check, Loader2, Landmark, CreditCard, Wallet, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { formatALL, formatDate } from '@/lib/utils';

interface PendingPayment {
  id: string;
  reference: string;
  method: string;
  amount: number;
  months: number;
  created_at: string;
  provider_ref: string | null;
  business_name: string | null;
  city: string | null;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bank_transfer: Landmark,
  card: CreditCard,
  paypal: Wallet,
};
const LABELS: Record<string, string> = {
  bank_transfer: 'Transfertë',
  card: 'Kartë',
  paypal: 'PayPal',
};

export default function PaymentQueue({ initial }: { initial: PendingPayment[] }) {
  const [rows, setRows] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function decide(id: string, approve: boolean) {
    if (
      approve &&
      !confirm('Konfirmo që pagesa ka mbërritur në llogari. Kjo aktivizon Pro-n.')
    ) {
      return;
    }
    setBusy(id);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('admin_decide_payment', {
        p_payment_id: id,
        p_approve: approve,
      });
      if (rpcError) throw rpcError;
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground px-5 py-10 text-center text-sm">
        Asnjë pagesë në pritje.
      </p>
    );
  }

  return (
    <div>
      {error && (
        <p className="border-destructive/30 bg-destructive/10 text-destructive mx-5 mt-4 rounded-lg border px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <ul className="divide-y">
        {rows.map((row) => {
          const Icon = ICONS[row.method] ?? Landmark;
          return (
            <li key={row.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {row.business_name ?? (
                    <span className="text-muted-foreground italic">pa emër</span>
                  )}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  <code className="font-mono">{row.reference}</code> ·{' '}
                  {LABELS[row.method] ?? row.method} · {row.months} muaj ·{' '}
                  {formatDate(row.created_at)}
                </p>
              </div>

              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {formatALL(row.amount)}
              </p>

              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === row.id}
                  onClick={() => decide(row.id, false)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X /> Refuzo
                </Button>
                <Button
                  size="sm"
                  disabled={busy === row.id}
                  onClick={() => decide(row.id, true)}
                >
                  {busy === row.id ? <Loader2 className="animate-spin" /> : <Check />}
                  Konfirmo
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
