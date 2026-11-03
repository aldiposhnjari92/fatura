import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { NumberInput } from '@/components/ui/react/number-input';
import { Label } from '@/components/ui/react/label';
import { DatePicker } from '@/components/ui/react/date-picker';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import { cn, formatALL, formatEUR } from '@/lib/utils';
import { differenceAll, differenceEur, differenceTone, valueAll, valueEur } from './supply-math';
import type { MoneyFieldProps, SupplyFormDialogProps, SupplyTotalRowProps } from '@/models/supplier';

/*
  Add or edit one supply. The header and the buttons stay put while the
  fields scroll between them, so a long form on a short screen never hides
  the title or "Ruaj". Each price is entered once per currency, side by side,
  and what they add up to is summed up in one panel underneath.
*/

export default function SupplyFormDialog({
  draft,
  onChange,
  suppliers,
  saving,
  error,
  onSubmit,
  onClose,
}: SupplyFormDialogProps) {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <DialogTitle>{draft?.id ? 'Ndrysho furnizimin' : 'Furnizim i ri'}</DialogTitle>
          <DialogDescription>
            Çmimet jepen për një copë, në Lekë dhe në Euro. Vlera dhe diferenca llogariten vetë.
          </DialogDescription>
        </DialogHeader>

        {draft && (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid flex-1 gap-5 overflow-y-auto px-6 py-5">
              <div className="space-y-1.5">
                <Label htmlFor="sp-product">Emri i produktit *</Label>
                <Input
                  id="sp-product"
                  value={draft.product_name}
                  onChange={(e) => onChange({ ...draft, product_name: e.target.value })}
                  placeholder="Emri, modeli ose madhësia e produktit"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label>Furnitori *</Label>
                <SearchableSelect
                  value={draft.supplier_id}
                  onValueChange={(supplier_id) => onChange({ ...draft, supplier_id })}
                  aria-label="Furnitori"
                  placeholder="Zgjidh furnitorin"
                  searchPlaceholder="Kërko furnitor…"
                  emptyText="Asnjë rezultat"
                  options={suppliers.map((s) => ({
                    value: s.id,
                    label: s.name,
                    hint: s.description ?? undefined,
                  }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sp-date">Data</Label>
                  <DatePicker
                    id="sp-date"
                    value={draft.supply_date}
                    onChange={(supply_date) => onChange({ ...draft, supply_date })}
                    aria-label="Data e furnizimit"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sp-qty">Sasia (copë)</Label>
                  <NumberInput
                    id="sp-qty"
                    value={draft.quantity}
                    onValueChange={(quantity) => onChange({ ...draft, quantity })}
                    className="text-right"
                  />
                </div>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-sm leading-none font-medium">Kosto për copë</legend>
                <div className="grid grid-cols-2 gap-4">
                  <MoneyField
                    id="sp-cost-all"
                    label="Kosto për copë në Lekë"
                    currency="Lekë"
                    value={draft.cost_all}
                    onValueChange={(cost_all) => onChange({ ...draft, cost_all })}
                  />
                  <MoneyField
                    id="sp-cost-eur"
                    label="Kosto për copë në Euro"
                    currency="€"
                    value={draft.cost_eur}
                    onValueChange={(cost_eur) => onChange({ ...draft, cost_eur })}
                    decimal
                  />
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-1.5 text-sm leading-none font-medium">Çmimi i shitjes për copë</legend>
                <div className="grid grid-cols-2 gap-4">
                  <MoneyField
                    id="sp-sale-all"
                    label="Çmimi i shitjes për copë në Lekë"
                    currency="Lekë"
                    value={draft.sale_price_all}
                    onValueChange={(sale_price_all) => onChange({ ...draft, sale_price_all })}
                  />
                  <MoneyField
                    id="sp-sale-eur"
                    label="Çmimi i shitjes për copë në Euro"
                    currency="€"
                    value={draft.sale_price_eur}
                    onValueChange={(sale_price_eur) => onChange({ ...draft, sale_price_eur })}
                    decimal
                  />
                </div>
              </fieldset>

              <section aria-label="Llogaritja" className="bg-muted/60 divide-y rounded-xl border">
                <TotalRow label="Vlera" formula="kosto × sasia" all={valueAll(draft)} eur={valueEur(draft)} />
                <TotalRow
                  label="Diferenca"
                  formula="(shitje − kosto) × sasia"
                  all={differenceAll(draft)}
                  eur={differenceEur(draft)}
                  signed
                />
              </section>

              {error && (
                <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                Anulo
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Ruaj
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A price with its currency shown inside the field, so the label can say what it is once. */
function MoneyField({ id, label, currency, value, onValueChange, decimal }: MoneyFieldProps) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm"
      >
        {currency}
      </span>
      <NumberInput
        id={id}
        aria-label={label}
        value={value}
        onValueChange={onValueChange}
        decimal={decimal}
        className="pl-12 text-right tabular-nums"
      />
    </div>
  );
}

/** One line of the summary: what it is and how it is worked out, then both currencies. */
function TotalRow({ label, formula, all, eur, signed = false }: SupplyTotalRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{formula}</p>
      </div>
      <div className="flex items-baseline gap-4 text-right tabular-nums">
        <output className={cn('text-sm font-semibold whitespace-nowrap', signed && differenceTone(all))}>
          {formatALL(all)}
        </output>
        <output className={cn('text-sm font-semibold whitespace-nowrap', signed && differenceTone(eur))}>
          {formatEUR(eur)}
        </output>
      </div>
    </div>
  );
}
