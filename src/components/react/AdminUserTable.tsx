import * as React from 'react';
import {
  BadgeCheck,
  ChevronDown,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import { Input } from '@/components/ui/react/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/react/dropdown-menu';
import { formatALL, formatDate } from '@/lib/utils';

export interface AdminUserRow {
  id: string;
  email: string;
  business_name: string | null;
  city: string | null;
  nipt: string | null;
  is_pro: boolean;
  is_admin: boolean;
  pro_until: string | null;
  created_at: string;
  invoice_count: number;
  client_count: number;
  invoiced_total: number;
  paid_total: number;
  last_invoice_at: string | null;
}

interface Props {
  rows: AdminUserRow[];
  currentAdminId: string;
}

function proActive(row: AdminUserRow) {
  return row.is_pro && (!row.pro_until || new Date(row.pro_until) > new Date());
}

interface DeletePreview {
  id: string;
  business_name: string | null;
  email: string;
  is_admin: boolean;
  is_self: boolean;
  pro_active: boolean;
  pro_until: string | null;
  invoices: number;
  clients: number;
  payments: number;
  paid_total: number;
  last_payment_at: string | null;
  other_admins: number;
}

export default function AdminUserTable({ rows: initial, currentAdminId }: Props) {
  const [preview, setPreview] = React.useState<DeletePreview | null>(null);
  const [previewing, setPreviewing] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [rows, setRows] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  async function run(
    id: string,
    fn: string,
    args: Record<string, unknown>,
    patch: (row: AdminUserRow, data: any) => AdminUserRow,
    message: string
  ) {
    setBusy(id);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(fn, args);
      if (rpcError) throw rpcError;
      setRows((prev) => prev.map((r) => (r.id === id ? patch(r, data) : r)));
      setToast(message);
    } catch (err) {
      const raw = (err as Error).message;
      setError(
        /CANNOT_DEMOTE_SELF/.test(raw)
          ? 'Nuk mund të heqësh vetes të drejtat e adminit.'
          : /LAST_ADMIN/.test(raw)
            ? 'Duhet të mbetet të paktën një admin.'
            : raw
      );
    } finally {
      setBusy(null);
    }
  }

  const grantPro = (row: AdminUserRow, months: number) =>
    run(
      row.id,
      'admin_set_pro',
      { p_user: row.id, p_months: months, p_revoke: false },
      (r, d) => ({ ...r, is_pro: true, pro_until: d?.pro_until ?? r.pro_until }),
      `Pro u aktivizua për ${months} muaj.`
    );

  const revokePro = (row: AdminUserRow) =>
    run(
      row.id,
      'admin_set_pro',
      { p_user: row.id, p_months: 1, p_revoke: true },
      (r) => ({ ...r, is_pro: false, pro_until: null }),
      'Pro u hoq.'
    );

  const setAdmin = (row: AdminUserRow, value: boolean) =>
    run(
      row.id,
      'admin_set_admin',
      { p_user: row.id, p_is_admin: value },
      (r) => ({ ...r, is_admin: value }),
      value ? 'U bë admin.' : 'Të drejtat e adminit u hoqën.'
    );

  async function openDelete(row: AdminUserRow) {
    setPreviewing(row.id);
    setError(null);
    setConfirmText('');
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_user_delete_preview', {
        p_user: row.id,
      });
      if (rpcError) throw rpcError;
      setPreview(data as DeletePreview);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPreviewing(null);
    }
  }

  async function confirmDelete() {
    if (!preview) return;
    setDeleting(true);
    setError(null);
    try {
      // The database refuses this without the acknowledgement when the account
      // has paid — the dialog is the explanation, not the enforcement.
      const { error: rpcError } = await supabase.rpc('admin_delete_user', {
        p_user: preview.id,
        p_acknowledge_paid: true,
      });
      if (rpcError) throw rpcError;
      setRows((prev) => prev.filter((r) => r.id !== preview.id));
      setToast(`${preview.business_name ?? preview.email} u fshi.`);
      setPreview(null);
    } catch (err) {
      const raw = (err as Error).message;
      setError(
        /CANNOT_DELETE_SELF/.test(raw)
          ? 'Nuk mund të fshish llogarinë tënde.'
          : /LAST_ADMIN/.test(raw)
            ? 'Duhet të mbetet të paktën një admin.'
            : raw
      );
    } finally {
      setDeleting(false);
    }
  }

  const hasPaid = Boolean(preview && (preview.pro_active || preview.payments > 0));
  // A paying customer needs the name typed out; a free one just needs a click.
  const requiredText = preview?.business_name?.trim() || preview?.email || '';
  const canDelete =
    !!preview && !preview.is_self && (!hasPaid || confirmText.trim() === requiredText);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground px-5 py-14 text-center text-sm">
        Asnjë biznes nuk përputhet me filtrat.
      </p>
    );
  }

  return (
    <div className="relative">
      {error && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive mx-5 mt-4 rounded-lg border px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="text-muted-foreground px-5 py-3 text-left text-xs font-medium">
                Biznesi
              </th>
              <th className="text-muted-foreground hidden px-5 py-3 text-left text-xs font-medium lg:table-cell">
                Kontakt
              </th>
              <th className="text-muted-foreground px-5 py-3 text-left text-xs font-medium">
                Plani
              </th>
              <th className="text-muted-foreground px-5 py-3 text-right text-xs font-medium">
                Fatura
              </th>
              <th className="text-muted-foreground hidden px-5 py-3 text-right text-xs font-medium md:table-cell">
                Paguar
              </th>
              <th className="text-muted-foreground hidden px-5 py-3 text-right text-xs font-medium xl:table-cell">
                Regjistruar
              </th>
              <th className="w-14 px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const isPro = proActive(row);
              return (
                <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="max-w-[14rem] truncate font-medium">
                        {row.business_name ?? (
                          <span className="text-muted-foreground italic">pa emër</span>
                        )}
                      </span>
                      {row.is_admin && (
                        <span
                          className="bg-ink text-brand rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                          title="Administrator"
                        >
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {row.city ?? '—'}
                      {row.nipt ? ` · ${row.nipt}` : ''}
                    </p>
                  </td>

                  <td className="text-muted-foreground hidden max-w-[15rem] truncate px-5 py-3.5 lg:table-cell">
                    {row.email}
                  </td>

                  <td className="px-5 py-3.5">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[11px] font-bold',
                        isPro ? 'bg-brand/15 text-primary' : 'bg-muted text-muted-foreground',
                      ].join(' ')}
                    >
                      {isPro ? 'PRO' : 'FALAS'}
                    </span>
                    {isPro && row.pro_until && (
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        deri {formatDate(row.pro_until)}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-right tabular-nums">
                    {row.invoice_count}
                    <span className="text-muted-foreground"> / {row.client_count} kl.</span>
                  </td>

                  <td className="hidden px-5 py-3.5 text-right font-medium tabular-nums md:table-cell">
                    {formatALL(row.paid_total)}
                  </td>

                  <td className="text-muted-foreground hidden px-5 py-3.5 text-right xl:table-cell">
                    {formatDate(row.created_at)}
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={busy === row.id}>
                          {busy === row.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <ChevronDown />
                          )}
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="truncate text-xs">
                          {row.business_name ?? row.email}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {[1, 3, 12].map((m) => (
                          <DropdownMenuItem key={m} onSelect={() => grantPro(row, m)}>
                            <Sparkles /> Jep Pro — {m} muaj
                          </DropdownMenuItem>
                        ))}

                        {isPro && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => revokePro(row)}
                          >
                            <X /> Hiq Pro
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          disabled={row.id === currentAdminId || previewing === row.id}
                          className="text-destructive focus:text-destructive"
                          onSelect={(event) => {
                            event.preventDefault();
                            openDelete(row);
                          }}
                        >
                          <Trash2 /> Fshi biznesin
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {row.is_admin ? (
                          <DropdownMenuItem
                            disabled={row.id === currentAdminId}
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setAdmin(row, false)}
                          >
                            <ShieldOff /> Hiq adminin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => setAdmin(row, true)}>
                            <ShieldCheck /> Bëje admin
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => !open && !deleting && setPreview(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Fshi {preview?.business_name ?? preview?.email}?
            </DialogTitle>
          </DialogHeader>

          {preview && (
            <div className="flex flex-col gap-4">
              {/* The alert the admin must not miss */}
              {hasPaid && (
                <div className="border-destructive/40 bg-destructive/10 rounded-lg border p-4">
                  <div className="flex items-start gap-2.5">
                    <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-destructive text-sm font-semibold">
                        Ky biznes ka paguar
                      </p>
                      <ul className="text-foreground/85 mt-2 flex flex-col gap-1 text-sm">
                        {preview.pro_active && (
                          <li>
                            Abonim <strong>Pro aktiv</strong>
                            {preview.pro_until
                              ? ` deri më ${formatDate(preview.pro_until)}`
                              : ''}
                          </li>
                        )}
                        {preview.payments > 0 && (
                          <li>
                            {preview.payments}{' '}
                            {preview.payments === 1 ? 'pagesë e konfirmuar' : 'pagesa të konfirmuara'}
                            {' · '}
                            <strong>{formatALL(preview.paid_total)}</strong>
                            {preview.last_payment_at
                              ? ` (e fundit ${formatDate(preview.last_payment_at)})`
                              : ''}
                          </li>
                        )}
                      </ul>
                      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                        Fshirja nuk e rimburson pagesën dhe historiku i saj humbet. Nëse
                        klienti thjesht do të ndalojë abonimin, përdor “Hiq Pro”.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-muted/60 rounded-lg p-4">
                <p className="text-sm font-medium">Do të fshihen përgjithmonë:</p>
                <ul className="text-muted-foreground mt-2 flex flex-col gap-1 text-sm">
                  <li>
                    {preview.invoices} {preview.invoices === 1 ? 'faturë' : 'fatura'}
                  </li>
                  <li>
                    {preview.clients} {preview.clients === 1 ? 'klient' : 'klientë'}
                  </li>
                  <li>llogaria dhe të gjitha të dhënat e biznesit</li>
                </ul>
                <p className="text-muted-foreground mt-2 text-xs">
                  {preview.email}
                  {preview.is_admin ? ' · ky përdorues është admin' : ''}
                </p>
              </div>

              {hasPaid && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirm-name" className="text-sm font-medium">
                    Shkruaj “{requiredText}” për të konfirmuar
                  </label>
                  <Input
                    id="confirm-name"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={requiredText}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={deleting}>
              Anulo
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={!canDelete || deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Fshi përgjithmonë
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <div
          role="status"
          className="bg-foreground text-background fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg"
        >
          <BadgeCheck className="size-4" /> {toast}
        </div>
      )}
    </div>
  );
}
