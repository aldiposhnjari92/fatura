import * as React from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { PLANS, planOf } from '@/lib/plans';
import { notify } from '@/lib/toast';
import { formatALL } from '@/lib/utils';
import type { BankTransferPanelProps } from '@/models/billing';

/** Bank transfer: first a reference is issued, then the account details to pay into. */
export default function BankTransferPanel({
  bank,
  bankConfigured,
  order,
  plan,
  term,
  busy,
  onStart,
  onError,
}: BankTransferPanelProps) {
  const [copied, setCopied] = React.useState<string | null>(null);
  const chosen = PLANS[plan];

  /** `label` is the row's own name — the toast says which field was copied. */
  async function copy(text: string, key: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      notify.success('U kopjua.', `${label} u ruajt në kujtesën e pajisjes.`);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      onError('Kopjimi dështoi. Zgjidhe dhe kopjoje manualisht.');
      notify.error('Kopjimi dështoi', 'Zgjidhe tekstin dhe kopjoje manualisht.');
    }
  }

  return (
    <section className="bg-card shadow-card rounded-2xl p-6">
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
              {term.label} · {chosen.name}
            </span>
            <span className="text-lg font-bold tabular-nums">{formatALL(term.total)}</span>
          </div>
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Shtyp më poshtë për të marrë një referencë unike. Vendose atë në
            përshkrimin e transfertës që ta gjejmë pagesën tënde.
          </p>
          <Button onClick={onStart} disabled={busy} className="press mt-4">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => copy(String(row.v), row.copyKey!, row.k)}
                      className="text-muted-foreground hover:text-foreground press size-7 shrink-0 rounded"
                      aria-label={`Kopjo ${row.k}`}
                    >
                      {copied === row.copyKey ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
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
  );
}
