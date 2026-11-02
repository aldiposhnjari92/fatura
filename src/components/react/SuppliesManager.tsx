import * as React from 'react';
import { Loader2, PackageOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/react/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/react/table';
import { SuccessNote } from '@/components/ui/react/success-note';
import { notify } from '@/lib/toast';
import { cn, formatALL, formatDate, formatEUR, toDateInput } from '@/lib/utils';
import SupplyFormDialog from './supplies/SupplyFormDialog';
import { differenceTone, round2, valueAll, valueEur } from './supplies/supply-math';
import type { SuppliesManagerProps, Supply, SupplyDraft } from '@/models/supplier';

/*
  Furnizimet: one product per delivery — what came in, from whom, how many
  pieces, what one cost and what it sells for.

  Kosto and çmimi i shitjes are each recorded twice, in Lekë and in Euro,
  typed in by hand; there is no exchange rate here. Each currency is its own
  column of arithmetic and the two are never added together.

  Vlera and Diferenca are never typed. The database generates them per
  currency (kosto × sasia, and (shitje − kosto) × sasia), and the form shows
  the same arithmetic live so the numbers are known before saving.
*/

const emptyDraft = (): SupplyDraft => ({
  id: null,
  product_name: '',
  supplier_id: '',
  supply_date: toDateInput(),
  quantity: 0,
  cost_all: 0,
  cost_eur: 0,
  sale_price_all: 0,
  sale_price_eur: 0,
});

const CONFIRM_MS = 1000;

export default function SuppliesManager({ supplies: initial, suppliers }: SuppliesManagerProps) {
  const [supplies, setSupplies] = React.useState<Supply[]>(initial);
  const [search, setSearch] = React.useState('');
  const [draft, setDraft] = React.useState<SupplyDraft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Supply | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleted, setDeleted] = React.useState(false);
  const closeTimer = React.useRef<number>();

  React.useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const supplierName = React.useMemo(() => {
    const names = new Map(suppliers.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? (names.get(id) ?? null) : null);
  }, [suppliers]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return supplies;
    return supplies.filter((supply) =>
      [supply.product_name, supplierName(supply.supplier_id)]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [supplies, search, supplierName]);

  const totals = React.useMemo(
    () =>
      supplies.reduce(
        (sum, s) => ({
          valueAll: sum.valueAll + (Number(s.value_all) || 0),
          valueEur: sum.valueEur + (Number(s.value_eur) || 0),
          differenceAll: sum.differenceAll + (Number(s.difference_all) || 0),
          differenceEur: sum.differenceEur + (Number(s.difference_eur) || 0),
        }),
        { valueAll: 0, valueEur: 0, differenceAll: 0, differenceEur: 0 }
      ),
    [supplies]
  );

  function openEdit(supply: Supply) {
    setDraft({
      id: supply.id,
      product_name: supply.product_name,
      supplier_id: supply.supplier_id ?? '',
      supply_date: supply.supply_date,
      quantity: Number(supply.quantity) || 0,
      cost_all: Number(supply.cost_all) || 0,
      cost_eur: Number(supply.cost_eur) || 0,
      sale_price_all: Number(supply.sale_price_all) || 0,
      sale_price_eur: Number(supply.sale_price_eur) || 0,
    });
    setError(null);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;

    if (!draft.product_name.trim()) {
      setError('Shkruaj emrin e produktit.');
      return;
    }
    if (!draft.supplier_id) {
      setError('Zgjidh furnitorin.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesioni skadoi. Hyr sërish.');

      const payload = {
        product_name: draft.product_name.trim(),
        supplier_id: draft.supplier_id,
        supply_date: draft.supply_date,
        quantity: Math.max(0, Math.round(draft.quantity)),
        cost_all: Math.max(0, round2(draft.cost_all)),
        cost_eur: Math.max(0, round2(draft.cost_eur)),
        sale_price_all: Math.max(0, round2(draft.sale_price_all)),
        sale_price_eur: Math.max(0, round2(draft.sale_price_eur)),
      };

      const byDate = (a: Supply, b: Supply) =>
        b.supply_date.localeCompare(a.supply_date) || b.created_at.localeCompare(a.created_at);

      if (draft.id) {
        const { data, error: updateError } = await supabase
          .from('supplies')
          .update(payload)
          .eq('id', draft.id)
          .select()
          .single();
        if (updateError) throw updateError;
        setSupplies((prev) =>
          prev.map((s) => (s.id === draft.id ? (data as Supply) : s)).sort(byDate)
        );
      } else {
        const { data, error: insertError } = await supabase
          .from('supplies')
          .insert({ ...payload, owner_id: user.id })
          .select()
          .single();
        if (insertError) throw insertError;
        setSupplies((prev) => [data as Supply, ...prev].sort(byDate));
      }

      notify.success(
        draft.id ? 'Furnizimi u ruajt.' : 'Furnizimi u shtua.',
        `${payload.product_name} — vlera ${formatALL(valueAll(payload))} · ${formatEUR(valueEur(payload))}`
      );
      setDraft(null);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      notify.error('Furnizimi nuk u ruajt', message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('supplies')
        .delete()
        .eq('id', pendingDelete.id);
      if (deleteError) throw deleteError;
      setSupplies((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      setDeleted(true);
      notify.success('Furnizimi u fshi.', `${pendingDelete.product_name} u hoq nga lista.`);
      closeTimer.current = window.setTimeout(() => {
        setPendingDelete(null);
        setDeleted(false);
      }, CONFIRM_MS);
    } catch (err) {
      notify.error('Furnizimi nuk u fshi', (err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Vlera gjithsej · Lekë', amount: formatALL(totals.valueAll), tone: '' },
          { label: 'Vlera gjithsej · Euro', amount: formatEUR(totals.valueEur), tone: '' },
          {
            label: 'Diferenca gjithsej · Lekë',
            amount: formatALL(totals.differenceAll),
            tone: differenceTone(totals.differenceAll),
          },
          {
            label: 'Diferenca gjithsej · Euro',
            amount: formatEUR(totals.differenceEur),
            tone: differenceTone(totals.differenceEur),
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-card shadow-card rounded-2xl px-5 py-4">
            <p className="text-muted-foreground text-xs font-medium">{stat.label}</p>
            <p className={cn('mt-1 text-xl font-semibold tabular-nums', stat.tone)}>
              {stat.amount}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-card shadow-card flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kërko produkt ose furnitor…"
            className="pl-8"
          />
        </div>
        <Button
          onClick={() => {
            setDraft(emptyDraft());
            setError(null);
          }}
          className="shrink-0"
          disabled={suppliers.length === 0}
        >
          <Plus /> Furnizim i ri
        </Button>
      </div>

      {suppliers.length === 0 && (
        <p className="border-warning/40 bg-warning/10 rounded-lg border px-4 py-3 text-sm">
          Shto një furnitor te{' '}
          <a href="/app/furnitoret" className="font-medium underline underline-offset-2">
            Furnitorët
          </a>{' '}
          përpara se të regjistrosh furnizimin e parë.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card shadow-card rounded-2xl px-6 py-16 text-center">
          <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
            <PackageOpen className="text-muted-foreground size-5" />
          </div>
          <h2 className="mt-4 text-sm font-semibold">
            {supplies.length === 0 ? 'Ende asnjë furnizim' : 'Asnjë furnizim nuk përputhet'}
          </h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            {supplies.length === 0
              ? 'Regjistro çdo produkt që blen: sa copë, me çfarë kostoje dhe me sa e shet.'
              : 'Provo një kërkim tjetër.'}
          </p>
        </div>
      ) : (
        <div className="bg-card shadow-card overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produkti</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Sasia</TableHead>
                <TableHead className="hidden text-right xl:table-cell">Kosto</TableHead>
                <TableHead className="text-right">Vlera</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Çmimi i shitjes</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Diferenca</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((supply) => {
                const diffAll = Number(supply.difference_all) || 0;
                const diffEur = Number(supply.difference_eur) || 0;
                return (
                  <TableRow key={supply.id}>
                    <TableCell>
                      <p className="font-medium">{supply.product_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {supplierName(supply.supplier_id) ?? (
                          <span className="italic">Pa furnitor</span>
                        )}
                        <span className="md:hidden"> · {formatDate(supply.supply_date)}</span>
                        <span className="sm:hidden"> · {supply.quantity} copë</span>
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {formatDate(supply.supply_date)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {supply.quantity}{' '}
                      <span className="text-muted-foreground text-xs">copë</span>
                    </TableCell>
                    {/* Both currencies stacked: Lekë on top, Euro under it. */}
                    <TableCell className="hidden text-right tabular-nums xl:table-cell">
                      <p>{formatALL(Number(supply.cost_all))}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatEUR(Number(supply.cost_eur))}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <p className="font-medium">{formatALL(Number(supply.value_all))}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatEUR(Number(supply.value_eur))}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">
                      <p>{formatALL(Number(supply.sale_price_all))}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatEUR(Number(supply.sale_price_eur))}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      <p className={cn('font-medium', differenceTone(diffAll))}>
                        {formatALL(diffAll)}
                      </p>
                      <p className={cn('text-xs', differenceTone(diffEur))}>
                        {formatEUR(diffEur)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Ndrysho ${supply.product_name}`}
                          onClick={() => openEdit(supply)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Fshi ${supply.product_name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setPendingDelete(supply)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / edit */}
      <SupplyFormDialog
        draft={draft}
        onChange={setDraft}
        suppliers={suppliers}
        saving={saving}
        error={error}
        onSubmit={handleSave}
        onClose={() => setDraft(null)}
      />

      {/* Delete confirm */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && !deleted && setPendingDelete(null)}
      >
        <DialogContent hideClose={deleted}>
          {deleted ? (
            <SuccessNote>
              <DialogTitle className="text-base font-semibold">
                Furnizimi u fshi me sukses
              </DialogTitle>
            </SuccessNote>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Fshi {pendingDelete?.product_name}?</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground text-sm">
                {pendingDelete &&
                  `${supplierName(pendingDelete.supplier_id) ?? 'Pa furnitor'} · ${
                    pendingDelete.quantity
                  } copë · ${formatALL(Number(pendingDelete.value_all))}`}{' '}
                — ky veprim nuk kthehet mbrapsht.
              </p>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setPendingDelete(null)}
                  disabled={deleting}
                >
                  Anulo
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting && <Loader2 className="animate-spin" />}
                  Po, fshije
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
