import type { SupplyPrices } from '@/models/supplier';

/*
  The form's live copy of the arithmetic the database generates per currency:
  vlera = kosto × sasia, diferenca = (shitje − kosto) × sasia.
*/

/** Cents-exact, so 0.1 × 3 shows what the database will store. */
export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const valueAll = (d: SupplyPrices) => round2(d.cost_all * d.quantity);
export const valueEur = (d: SupplyPrices) => round2(d.cost_eur * d.quantity);
export const differenceAll = (d: SupplyPrices) => round2((d.sale_price_all - d.cost_all) * d.quantity);
export const differenceEur = (d: SupplyPrices) => round2((d.sale_price_eur - d.cost_eur) * d.quantity);

/** A loss reads as one; a profit is just the number. */
export function differenceTone(n: number) {
  return n < 0 ? 'text-destructive' : n > 0 ? 'text-success' : 'text-muted-foreground';
}
