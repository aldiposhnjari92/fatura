import * as React from 'react';
import { Loader2, Pencil, Plus, Search, Trash2, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { NumberInput } from '@/components/ui/react/number-input';
import { Label } from '@/components/ui/react/label';
import { Textarea } from '@/components/ui/react/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
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
import { cn, formatALL } from '@/lib/utils';
import type { Supplier } from '@/lib/types';

/*
  Furnitorët: each supplier is an account — what the goods are worth (vlera),
  what has been paid (pagesa), and what is left (teprica). Teprica is never
  typed: the database generates it as vlera − pagesa, and the form shows the
  same subtraction live so the number is known before saving.
*/

interface Props {
  suppliers: Supplier[];
}

interface Draft {
  id: string | null;
  name: string;
  description: string;
  value: number;
  payment: number;
}

const emptyDraft = (): Draft => ({
  id: null,
  name: '',
  description: '',
  value: 0,
  payment: 0,
});

/* How long the confirmation is held before the dialog closes itself. */
const CONFIRM_MS = 1000;

/** Teprica that is still owed reads as a warning; settled or over-paid does not. */
function balanceTone(balance: number) {
  return balance > 0 ? 'text-warning' : 'text-muted-foreground';
}

export default function SuppliersManager({ suppliers: initial }: Props) {
  const [suppliers, setSuppliers] = React.useState<Supplier[]>(initial);
  const [search, setSearch] = React.useState('');
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Supplier | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleted, setDeleted] = React.useState(false);
  const closeTimer = React.useRef<number>();

  React.useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.description]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [suppliers, search]);

  const totals = React.useMemo(
    () =>
      suppliers.reduce(
        (sum, s) => ({
          value: sum.value + s.value,
          payment: sum.payment + s.payment,
          balance: sum.balance + s.balance,
        }),
        { value: 0, payment: 0, balance: 0 }
      ),
    [suppliers]
  );

  const draftBalance = draft ? (Number(draft.value) || 0) - (Number(draft.payment) || 0) : 0;

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !draft.name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesioni skadoi. Hyr sërish.');

      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        value: Math.max(0, Math.round(Number(draft.value) || 0)),
        payment: Math.max(0, Math.round(Number(draft.payment) || 0)),
      };

      if (draft.id) {
        const { data, error: updateError } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', draft.id)
          .select()
          .single();
        if (updateError) throw updateError;
        setSuppliers((prev) =>
          prev.map((s) => (s.id === draft.id ? (data as Supplier) : s))
        );
      } else {
        const { data, error: insertError } = await supabase
          .from('suppliers')
          .insert({ ...payload, owner_id: user.id })
          .select()
          .single();
        if (insertError) throw insertError;
        setSuppliers((prev) =>
          [...prev, data as Supplier].sort((a, b) => a.name.localeCompare(b.name))
        );
      }

      notify.success(
        draft.id ? 'Furnitori u ruajt.' : 'Furnitori u shtua.',
        `${payload.name} — teprica ${formatALL(payload.value - payload.payment)}.`
      );
      setDraft(null);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      notify.error('Furnitori nuk u ruajt', message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', pendingDelete.id);
      if (deleteError) throw deleteError;
      setSuppliers((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      setDeleted(true);
      notify.success('Furnitori u fshi.', `${pendingDelete.name} u hoq nga lista.`);
      closeTimer.current = window.setTimeout(() => {
        setPendingDelete(null);
        setDeleted(false);
      }, CONFIRM_MS);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      notify.error('Furnitori nuk u fshi', message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The three sums, in the same order as the columns below. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Vlera gjithsej', amount: totals.value, tone: '' },
          { label: 'Paguar gjithsej', amount: totals.payment, tone: '' },
          { label: 'Teprica gjithsej', amount: totals.balance, tone: balanceTone(totals.balance) },
        ].map((stat) => (
          <div key={stat.label} className="bg-card shadow-card rounded-2xl px-5 py-4">
            <p className="text-muted-foreground text-xs font-medium">{stat.label}</p>
            <p className={cn('mt-1 text-xl font-semibold tabular-nums', stat.tone)}>
              {formatALL(stat.amount)}
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
            placeholder="Kërko sipas emrit ose përshkrimit…"
            className="pl-8"
          />
        </div>
        <Button onClick={() => setDraft(emptyDraft())} className="shrink-0">
          <Plus /> Furnitor i ri
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm font-medium"
        >
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card shadow-card rounded-2xl px-6 py-16 text-center">
          <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
            <Truck className="text-muted-foreground size-5" />
          </div>
          <h2 className="mt-4 text-sm font-semibold">
            {suppliers.length === 0 ? 'Ende asnjë furnitor' : 'Asnjë furnitor nuk përputhet'}
          </h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            {suppliers.length === 0
              ? 'Shto furnitorët dhe mbaj shënim sa ke paguar dhe sa ka mbetur.'
              : 'Provo një kërkim tjetër.'}
          </p>
          {suppliers.length === 0 && (
            <Button onClick={() => setDraft(emptyDraft())} className="mt-5">
              <Plus /> Shto furnitorin e parë
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card shadow-card overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Furnitori</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Vlera</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Pagesa</TableHead>
                <TableHead className="text-right">Teprica</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <p className="font-medium">{supplier.name}</p>
                    {supplier.description && (
                      <p className="text-muted-foreground max-w-[22rem] truncate text-xs">
                        {supplier.description}
                      </p>
                    )}
                    {/* Vlera and Pagesa fold under the name on a phone. */}
                    <p className="text-muted-foreground text-xs tabular-nums sm:hidden">
                      {formatALL(supplier.value, false)} − {formatALL(supplier.payment, false)}
                    </p>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatALL(supplier.value)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatALL(supplier.payment)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-semibold tabular-nums',
                      balanceTone(supplier.balance)
                    )}
                  >
                    {formatALL(supplier.balance)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Ndrysho ${supplier.name}`}
                        onClick={() =>
                          setDraft({
                            id: supplier.id,
                            name: supplier.name,
                            description: supplier.description ?? '',
                            value: supplier.value,
                            payment: supplier.payment,
                          })
                        }
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Fshi ${supplier.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDelete(supplier)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / edit */}
      <Dialog open={draft !== null} onOpenChange={(open) => !open && !saving && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Ndrysho furnitorin' : 'Furnitor i ri'}</DialogTitle>
          </DialogHeader>

          {draft && (
            <form onSubmit={handleSave} className="grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="s-name">Emri *</Label>
                <Input
                  id="s-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Agro Fier sh.p.k."
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s-description">Përshkrimi</Label>
                <Textarea
                  id="s-description"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="p.sh. Furnizim me miell dhe sheqer"
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="s-value">Vlera</Label>
                  <NumberInput
                    id="s-value"
                    value={draft.value}
                    onValueChange={(value) => setDraft({ ...draft, value })}
                    className="text-right"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="s-payment">Pagesa</Label>
                  <NumberInput
                    id="s-payment"
                    value={draft.payment}
                    onValueChange={(payment) => setDraft({ ...draft, payment })}
                    className="text-right"
                  />
                </div>

                {/* Not an input: it is the subtraction, and the database
                    stores the same one. */}
                <div className="space-y-1.5">
                  <Label htmlFor="s-balance">Teprica</Label>
                  <output
                    id="s-balance"
                    aria-live="polite"
                    className={cn(
                      'bg-muted flex h-10 items-center justify-end rounded-md px-3 text-sm font-semibold tabular-nums',
                      balanceTone(draftBalance)
                    )}
                  >
                    {formatALL(draftBalance)}
                  </output>
                </div>
              </div>
              <p className="text-muted-foreground -mt-2 text-xs">
                Teprica llogaritet vetë: Vlera − Pagesa.
              </p>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraft(null)}
                  disabled={saving}
                >
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

      {/* Delete confirm */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && !deleted && setPendingDelete(null)}
      >
        <DialogContent hideClose={deleted}>
          {deleted ? (
            <SuccessNote>
              <DialogTitle className="text-base font-semibold">
                Furnitori u fshi me sukses
              </DialogTitle>
            </SuccessNote>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Fshi {pendingDelete?.name}?</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground text-sm">
                {pendingDelete && pendingDelete.balance > 0
                  ? `Ky furnitor ka ende një tepricë prej ${formatALL(pendingDelete.balance)}. `
                  : ''}
                Furnitori fshihet përgjithmonë. Furnizimet e lidhura ruhen, por mbeten pa
                furnitor.
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
