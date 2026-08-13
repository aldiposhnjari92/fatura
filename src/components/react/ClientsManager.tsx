import * as React from 'react';
import { Loader2, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { Label } from '@/components/ui/react/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import { formatALL, isValidNipt } from '@/lib/utils';
import type { Client } from '@/lib/types';

interface ClientUsage {
  count: number;
  total: number;
}

interface Props {
  clients: Client[];
  /** Per-client invoice count and billed total, aggregated server-side. */
  stats?: Record<string, ClientUsage>;
}

interface Draft {
  id: string | null;
  name: string;
  nipt: string;
  email: string;
  address: string;
}

const emptyDraft = (): Draft => ({ id: null, name: '', nipt: '', email: '', address: '' });

export default function ClientsManager({ clients: initial, stats = {} }: Props) {
  const [clients, setClients] = React.useState<Client[]>(initial);
  const [search, setSearch] = React.useState('');
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Client | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) =>
      [client.name, client.nipt, client.email, client.address]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [clients, search]);

  const niptWarning =
    draft?.nipt.trim() && !isValidNipt(draft.nipt)
      ? 'NIPT-i zakonisht ka formatin L72119451K (shkronjë, 8 shifra, shkronjë).'
      : null;

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
        nipt: draft.nipt.trim() || null,
        email: draft.email.trim() || null,
        address: draft.address.trim() || null,
      };

      if (draft.id) {
        const { data, error: updateError } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', draft.id)
          .select()
          .single();
        if (updateError) throw updateError;
        setClients((prev) => prev.map((c) => (c.id === draft.id ? (data as Client) : c)));
      } else {
        const { data, error: insertError } = await supabase
          .from('clients')
          .insert({ ...payload, owner_id: user.id })
          .select()
          .single();
        if (insertError) throw insertError;
        setClients((prev) =>
          [...prev, data as Client].sort((a, b) => a.name.localeCompare(b.name))
        );
      }

      setDraft(null);
    } catch (err) {
      setError((err as Error).message);
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
        .from('clients')
        .delete()
        .eq('id', pendingDelete.id);
      if (deleteError) throw deleteError;
      setClients((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const deleteUsage = pendingDelete ? stats[pendingDelete.id] : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-card ring-border flex flex-col gap-3 rounded-xl p-3 ring-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kërko klient, NIPT ose email…"
            className="pl-8"
          />
        </div>
        <Button onClick={() => setDraft(emptyDraft())} className="shrink-0">
          <Plus /> Klient i ri
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
        <div className="bg-card ring-border rounded-xl px-6 py-16 text-center ring-1">
          <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
            <Users className="text-muted-foreground size-5" />
          </div>
          <h2 className="mt-4 text-sm font-semibold">
            {clients.length === 0 ? 'Ende asnjë klient' : 'Asnjë klient nuk përputhet'}
          </h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            {clients.length === 0
              ? 'Ruaj klientët një herë dhe përdori në çdo faturë.'
              : 'Provo një kërkim tjetër.'}
          </p>
          {clients.length === 0 && (
            <Button onClick={() => setDraft(emptyDraft())} className="mt-5">
              <Plus /> Shto klientin e parë
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card ring-border overflow-hidden rounded-xl ring-1">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="text-muted-foreground px-5 py-3 text-left text-xs font-medium">
                    Klienti
                  </th>
                  <th className="text-muted-foreground hidden px-5 py-3 text-left text-xs font-medium md:table-cell">
                    NIPT
                  </th>
                  <th className="text-muted-foreground hidden px-5 py-3 text-left text-xs font-medium lg:table-cell">
                    Kontakt
                  </th>
                  <th className="text-muted-foreground px-5 py-3 text-right text-xs font-medium">
                    Fatura
                  </th>
                  <th className="text-muted-foreground hidden px-5 py-3 text-right text-xs font-medium sm:table-cell">
                    Faturuar
                  </th>
                  <th className="w-24 px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((client) => {
                  const usage = stats[client.id];
                  return (
                    <tr key={client.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium">{client.name}</p>
                        {client.address && (
                          <p className="text-muted-foreground max-w-[18rem] truncate text-xs">
                            {client.address}
                          </p>
                        )}
                      </td>
                      <td className="text-muted-foreground hidden px-5 py-3.5 font-mono text-xs md:table-cell">
                        {client.nipt || '—'}
                      </td>
                      <td className="text-muted-foreground hidden max-w-[16rem] truncate px-5 py-3.5 lg:table-cell">
                        {client.email || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums">
                        {usage?.count ?? 0}
                      </td>
                      <td className="hidden px-5 py-3.5 text-right font-medium tabular-nums sm:table-cell">
                        {formatALL(usage?.total ?? 0)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Ndrysho ${client.name}`}
                            onClick={() =>
                              setDraft({
                                id: client.id,
                                name: client.name,
                                nipt: client.nipt ?? '',
                                email: client.email ?? '',
                                address: client.address ?? '',
                              })
                            }
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Fshi ${client.name}`}
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setPendingDelete(client)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / edit */}
      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Ndrysho klientin' : 'Klient i ri'}</DialogTitle>
          </DialogHeader>

          {draft && (
            <form onSubmit={handleSave} className="grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Emri i klientit *</Label>
                <Input
                  id="c-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Alba Construction sh.p.k."
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-nipt">NIPT</Label>
                <Input
                  id="c-nipt"
                  value={draft.nipt}
                  onChange={(e) =>
                    setDraft({ ...draft, nipt: e.target.value.toUpperCase() })
                  }
                  placeholder="K81430022M"
                />
                {niptWarning && <p className="text-warning text-xs">{niptWarning}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="info@klienti.al"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-address">Adresa</Label>
                <Input
                  id="c-address"
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  placeholder="Rr. Jakov Xoxa, Fier"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
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
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fshi {pendingDelete?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {deleteUsage?.count
              ? `Ky klient është përdorur në ${deleteUsage.count} ${
                  deleteUsage.count === 1 ? 'faturë' : 'fatura'
                }. Faturat ruhen, por mbeten pa klient të lidhur.`
              : 'Klienti fshihet përgjithmonë.'}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
