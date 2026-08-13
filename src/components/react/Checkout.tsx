import * as React from 'react';
import {
  Building2,
  Check,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { formatALL } from '@/lib/utils';
import {
  PLAN_OPTIONS,
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
  created_at: string;
}

interface Props {
  methods: MethodInfo[];
  bank: BankDetails;
  bankConfigured: boolean;
  paypalClientId: string | null;
  pending: PendingPayment | null;
  proActive: boolean;
  proUntil: string | null;
  /** Term chosen on the pricing page and carried through signup. */
  initialMonths?: number;
  /** True when the visitor arrived here straight after picking Pro. */
  fromSignup?: boolean;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  landmark: Landmark,
  'credit-card': CreditCard,
  wallet: Wallet,
};

export default function Checkout({
  methods,
  bank,
  bankConfigured,
  paypalClientId,
  pending,
  proActive,
  proUntil,
  initialMonths = 1,
  fromSignup = false,
}: Props) {
  const [months, setMonths] = React.useState(initialMonths);
  const [method, setMethod] = React.useState<PaymentMethod>('bank_transfer');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<PendingPayment | null>(pending);

  const selected = PLAN_OPTIONS.find((o) => o.months === months) ?? PLAN_OPTIONS[0];
  const activeMethod = methods.find((m) => m.id === method);

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
      });
      if (rpcError) throw rpcError;
      setOrder(data as PendingPayment);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (proActive) {
    return (
      <div className="bg-card ring-border rounded-xl p-6 ring-1">
        <div className="flex items-start gap-3">
          <span className="bg-brand/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
            <Check className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Plani Pro është aktiv</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {proUntil
                ? `I vlefshëm deri më ${new Date(proUntil).toLocaleDateString('sq-AL')}.`
                : 'Fatura të palimituara.'}{' '}
              Mund ta zgjatësh në çdo moment — koha e re i shtohet asaj ekzistuese.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {fromSignup && (
        <div className="border-primary/25 bg-accent/40 rounded-xl border px-4 py-3">
          <p className="text-sm font-semibold">Llogaria u krijua ✓</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Plani Pro aktivizohet pasi të konfirmohet pagesa. Deri atëherë llogaria punon
            me planin falas — asnjë faturë nuk humbet.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm font-medium"
        >
          {error}
        </p>
      )}

      {/* Term */}
      <section className="bg-card ring-border rounded-xl p-5 ring-1">
        <h2 className="text-sm font-semibold">Zgjidh kohëzgjatjen</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PLAN_OPTIONS.map((option) => (
            <button
              key={option.months}
              type="button"
              onClick={() => setMonths(option.months)}
              aria-pressed={months === option.months}
              className={[
                'relative rounded-xl border p-4 text-left transition-colors',
                months === option.months
                  ? 'border-primary bg-accent/50'
                  : 'hover:bg-muted/60',
              ].join(' ')}
            >
              {option.best && (
                <span className="bg-brand text-ink absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold">
                  Më i mirë
                </span>
              )}
              <p className="text-sm font-semibold">{option.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {formatALL(option.total)}
              </p>
              {option.note && (
                <p className="text-muted-foreground mt-0.5 text-xs">{option.note}</p>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Method */}
      <section className="bg-card ring-border rounded-xl p-5 ring-1">
        <h2 className="text-sm font-semibold">Mënyra e pagesës</h2>
        <div className="mt-4 flex flex-col gap-3">
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
                  'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                  !m.available && 'cursor-not-allowed opacity-55',
                  isSelected && m.available
                    ? 'border-primary bg-accent/50'
                    : m.available && 'hover:bg-muted/60',
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
        <section className="bg-card ring-border rounded-xl p-5 ring-1">
          <h2 className="text-sm font-semibold">Të dhënat e transfertës</h2>

          {!bankConfigured && (
            <p className="border-warning/40 bg-warning/10 mt-3 rounded-lg border px-3 py-2 text-xs">
              Llogaria bankare nuk është konfiguruar ende (shih <code>BANK_IBAN</code> në
              .env). Të dhënat më poshtë janë shembull.
            </p>
          )}

          {!order ? (
            <>
              <p className="text-muted-foreground mt-3 text-sm">
                Shtyp më poshtë për të marrë një referencë unike. Vendose atë në
                përshkrimin e transfertës që ta gjejmë pagesën tënde.
              </p>
              <Button onClick={startPayment} disabled={busy} className="mt-4">
                {busy && <Loader2 className="animate-spin" />}
                Merr referencën e pagesës
              </Button>
            </>
          ) : (
            <>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                {[
                  { k: 'Përfituesi', v: bank.beneficiary },
                  { k: 'Banka', v: bank.bank },
                  { k: 'IBAN', v: bank.iban, mono: true, copyKey: 'iban' },
                  { k: 'SWIFT', v: bank.swift, mono: true },
                  {
                    k: 'Shuma',
                    v: formatALL(order.amount),
                    strong: true,
                  },
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
                          className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1 transition-colors"
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

              <div className="bg-muted/60 mt-4 rounded-lg p-3">
                <p className="text-xs leading-relaxed">
                  <strong>Pas transfertës</strong> nuk ka nevojë të bësh gjë tjetër. Sapo
                  ta shohim pagesën me referencën <code>{order.reference}</code>,
                  aktivizojmë Pro-n dhe të njoftojmë me email — zakonisht brenda 24 orëve
                  pune.
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* Card / PayPal */}
      {(method === 'card' || method === 'paypal') && (
        <section className="bg-card ring-border rounded-xl p-5 ring-1">
          <h2 className="text-sm font-semibold">{activeMethod?.label}</h2>

          {activeMethod?.available && paypalClientId ? (
            <>
              <p className="text-muted-foreground mt-2 text-sm">
                Do të paguash {formatALL(selected.total)} për {selected.label}.
              </p>
              {/* Mount point for the PayPal SDK buttons; the order is created
                  and captured by /api/payments/paypal/* so the amount is never
                  taken from the browser. */}
              <div id="paypal-buttons" className="mt-4" data-months={months} />
            </>
          ) : (
            <div className="border-warning/40 bg-warning/10 mt-3 rounded-lg border px-4 py-3">
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
                className="mt-3"
                onClick={() => setMethod('bank_transfer')}
              >
                <Landmark /> Përdor transfertë bankare
              </Button>
            </div>
          )}
        </section>
      )}

      {order && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Building2 className="size-4 shrink-0" />
          Kërkesa <code className="font-mono">{order.reference}</code> është në pritje.
        </p>
      )}
    </div>
  );
}
