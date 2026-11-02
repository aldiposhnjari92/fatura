import { ArrowRight, Loader2, Sparkles, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { PLANS, planOf } from '@/lib/plans';
import type { MembershipCardProps } from '@/models/billing';

/*
  The membership card — the whole point of the page for a customer who
  already pays. Ink surface with the brand teal, matching the featured
  pricing card on the marketing site.
*/
export default function MembershipCard({
  proActive,
  activePlan,
  cancelled,
  endsOn,
  daysLeft,
  periodProgress,
  monthlyLimit,
  invoicesThisMonth,
  usageRatio,
  overLimit,
  cancelBusy,
  onResume,
  onBuy,
  onCancel,
}: MembershipCardProps) {
  const active = planOf(activePlan);

  return (
    <div
      className={[
        'animate-rise relative isolate overflow-hidden rounded-2xl p-6 sm:p-8',
        // `dark` flips the tokens inside so nested primitives (Button, badges)
        // read light on the ink surface instead of dark-on-dark.
        proActive
          ? 'dark bg-ink text-mist shadow-2xl ring-1 ring-white/10'
          : 'bg-card shadow-card ring-border/60 text-foreground ring-1',
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
                onClick={onResume}
              >
                {cancelBusy ? <Loader2 className="animate-spin" /> : <Undo2 />}
                Rikthe abonimin
              </Button>
            ) : activePlan === 'starter' ? (
              <>
                <Button
                  className="bg-brand text-ink hover:bg-brand/90 press"
                  onClick={() => onBuy('pro')}
                >
                  Kalo në Pro <ArrowRight />
                </Button>
                <Button
                  variant="ghost"
                  className="text-mist/70 hover:bg-white/5 hover:text-mist"
                  onClick={() => onBuy('starter')}
                >
                  Zgjat Starter
                </Button>
              </>
            ) : (
              <Button
                className="bg-brand text-ink hover:bg-brand/90 press"
                onClick={() => onBuy()}
              >
                Zgjat abonimin <ArrowRight />
              </Button>
            )}

            {!cancelled && (
              <Button
                variant="ghost"
                className="text-mist/60 hover:bg-white/5 hover:text-mist"
                onClick={onCancel}
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
}
