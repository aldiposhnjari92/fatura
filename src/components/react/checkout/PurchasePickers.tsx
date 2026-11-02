import { CreditCard, Landmark, Wallet, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import {
  RadioGroup,
  RadioGroupCard,
  RadioGroupCardIndicator,
} from '@/components/ui/react/radio-group';
import { PAID_PLANS, PLANS } from '@/lib/plans';
import { formatALL } from '@/lib/utils';
import type {
  MethodPickerProps,
  PaidPlanId,
  PaymentMethod,
  PlanPickerProps,
  TermPickerProps,
} from '@/models/billing';

/* The three choices of a purchase: which plan, for how long, paid how. */

export function PlanPicker({ plan, onPlan, activePlan, isDowngrade }: PlanPickerProps) {
  return (
    <section className="bg-card shadow-card rounded-2xl p-6">
      <h2 className="font-semibold">Zgjidh planin</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        I njëjti dokument në të dyja planet. Ndryshon vetëm sa fatura mund të lëshosh
        në muaj.
      </p>

      <RadioGroup
        value={plan}
        onValueChange={(value) => onPlan(value as PaidPlanId)}
        aria-label="Plani"
        className="mt-5 grid gap-3 sm:grid-cols-2"
      >
        {PAID_PLANS.map((option) => {
          const limit = option.invoiceLimit;
          return (
            <RadioGroupCard key={option.id} value={option.id}>
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{option.name}</span>
                <RadioGroupCardIndicator />
              </span>
              <span className="mt-2 block text-lg font-bold tabular-nums">
                {formatALL(option.monthlyALL)}
                <span className="text-muted-foreground text-xs font-medium">/muaj</span>
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                {limit === null ? 'Fatura të palimituara' : `${limit} fatura në muaj`}
              </span>
              {activePlan === option.id && (
                <span className="bg-secondary text-secondary-foreground absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold">
                  Plani yt
                </span>
              )}
            </RadioGroupCard>
          );
        })}
      </RadioGroup>

      {isDowngrade && (
        <p className="border-warning/40 bg-warning/10 mt-4 rounded-lg border px-3 py-2 text-xs leading-relaxed">
          Ke Pro aktiv. Nëse paguan për Starter, llogaria kalon në Starter (
          {PLANS.starter.invoiceLimit} fatura në muaj) sapo të konfirmohet pagesa, dhe
          koha e re i shtohet asaj ekzistuese.
        </p>
      )}
    </section>
  );
}

export function TermPicker({ months, onMonths, terms, renewing, onClose }: TermPickerProps) {
  return (
    <section className="bg-card shadow-card rounded-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">
            {renewing ? 'Sa gjatë do ta zgjatësh?' : 'Zgjidh kohëzgjatjen'}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {renewing
              ? 'Koha e re i shtohet asaj që ke — nuk humbet asnjë ditë.'
              : 'Mujor ose vjetor — një transfertë e vetme. Anulo kur të duash.'}
          </p>
        </div>
        {renewing && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground -mr-1 shrink-0 rounded-lg"
            aria-label="Mbyll"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Two terms — monthly or yearly — side by side at every width. */}
      <RadioGroup
        value={String(months)}
        onValueChange={(value) => onMonths(Number(value))}
        aria-label="Kohëzgjatja"
        className="mt-5 grid grid-cols-2 gap-3"
      >
        {terms.map((option) => (
          <RadioGroupCard key={option.months} value={String(option.months)}>
            {option.best && (
              <span className="bg-brand text-ink absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm">
                Më i mirë
              </span>
            )}
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{option.label}</span>
              <RadioGroupCardIndicator />
            </span>
            <span className="mt-2 block text-lg font-bold tabular-nums">
              {formatALL(option.total)}
            </span>
            {option.note && (
              <span className="text-muted-foreground mt-0.5 block text-xs">{option.note}</span>
            )}
          </RadioGroupCard>
        ))}
      </RadioGroup>
    </section>
  );
}

const ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  'credit-card': CreditCard,
  wallet: Wallet,
};

export function MethodPicker({ methods, method, onMethod }: MethodPickerProps) {
  return (
    <section className="bg-card shadow-card rounded-2xl p-6">
      <h2 className="font-semibold">Mënyra e pagesës</h2>
      <RadioGroup
        value={method}
        onValueChange={(value) => onMethod(value as PaymentMethod)}
        aria-label="Mënyra e pagesës"
        className="mt-5 flex flex-col gap-3"
      >
        {methods.map((m) => {
          const Icon = ICONS[m.icon] ?? Landmark;
          return (
            <RadioGroupCard
              key={m.id}
              value={m.id}
              disabled={!m.available}
              className="flex items-start gap-3"
            >
              <span className="bg-muted text-muted-foreground group-data-[state=checked]/radio-card:bg-primary group-data-[state=checked]/radio-card:text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors">
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
                <span className="text-muted-foreground mt-0.5 block text-sm">{m.description}</span>
              </span>
            </RadioGroupCard>
          );
        })}
      </RadioGroup>
    </section>
  );
}
