import * as React from 'react';
import { Loader2, Plus, Trash2, Download, Share2, Save, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { Label } from '@/components/ui/react/label';
import { Textarea } from '@/components/ui/react/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/react/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/react/select';
import { DatePicker } from '@/components/ui/react/date-picker';
import {
  computeTotals,
  type Client,
  type Invoice,
  type InvoiceItem,
  type InvoiceLanguage,
  type InvoiceStatus,
  type Profile,
} from '@/lib/types';
import { addDays, formatALL, toDateInput } from '@/lib/utils';
import { downloadInvoicePdf, isPdfEngineLoadError, shareInvoicePdf } from '@/lib/pdf';

interface Props {
  profile: Profile | null;
  clients: Client[];
  invoice?: Invoice | null;
  suggestedNumber: string;
  limitReached?: boolean;
}

const VAT_OPTIONS = [0, 6, 20];
const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'unpaid', label: 'E papaguar' },
  { value: 'paid', label: 'E paguar' },
  { value: 'overdue', label: 'E vonuar' },
];

const emptyItem = (): InvoiceItem => ({ description: '', quantity: 1, price: 0 });

/** Keeps a numeric input usable: empty string while typing, 0 when read. */
function toInt(value: string): number {
  const n = Number.parseInt(value.replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export default function InvoiceEditor({
  profile,
  clients: initialClients,
  invoice,
  suggestedNumber,
  limitReached = false,
}: Props) {
  const isEdit = Boolean(invoice?.id);

  const [clients, setClients] = React.useState<Client[]>(initialClients);
  const [clientId, setClientId] = React.useState<string>(invoice?.client_id ?? '');
  const [invoiceNumber, setInvoiceNumber] = React.useState(
    invoice?.invoice_number ?? suggestedNumber
  );
  const [issueDate, setIssueDate] = React.useState(
    invoice?.issue_date ? toDateInput(invoice.issue_date) : toDateInput()
  );
  const [dueDate, setDueDate] = React.useState(
    invoice?.due_date ? toDateInput(invoice.due_date) : addDays(new Date(), 15)
  );
  const [items, setItems] = React.useState<InvoiceItem[]>(
    invoice?.items?.length ? invoice.items : [emptyItem()]
  );
  const [vatPercent, setVatPercent] = React.useState<number>(invoice?.vat_percent ?? 20);
  const [discount, setDiscount] = React.useState<number>(invoice?.discount ?? 0);
  const [status, setStatus] = React.useState<InvoiceStatus>(invoice?.status ?? 'draft');
  const [language, setLanguage] = React.useState<InvoiceLanguage>(
    invoice?.language ?? 'sq'
  );
  const [notes, setNotes] = React.useState(invoice?.notes ?? '');

  const [saving, setSaving] = React.useState(false);
  const [busyPdf, setBusyPdf] = React.useState<'download' | 'share' | 'preview' | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  // Inline "new client" form, so a first invoice never dead-ends.
  const [showNewClient, setShowNewClient] = React.useState(false);
  const [newClient, setNewClient] = React.useState({
    name: '',
    nipt: '',
    email: '',
    address: '',
  });
  const [creatingClient, setCreatingClient] = React.useState(false);

  const totals = React.useMemo(
    () => computeTotals(items, vatPercent, discount),
    [items, vatPercent, discount]
  );

  // Set when the PDF chunk can't be fetched — the page is stale, not broken.
  const [needsReload, setNeedsReload] = React.useState(false);

  /** Report a PDF failure, distinguishing "page is stale" from a real error. */
  function reportPdfError(prefix: string, err: unknown) {
    if (isPdfEngineLoadError(err)) {
      setNeedsReload(true);
      setError(null);
      return;
    }
    setError(`${prefix}: ${(err as Error).message}`);
  }

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const pdfInput = React.useMemo(
    () => ({
      invoice: {
        invoice_number: invoiceNumber,
        issue_date: issueDate,
        due_date: dueDate || null,
        items,
        vat_percent: vatPercent,
        discount,
        status,
        notes,
        language,
      },
      profile,
      client: selectedClient,
    }),
    [
      invoiceNumber,
      issueDate,
      dueDate,
      items,
      vatPercent,
      discount,
      status,
      notes,
      language,
      profile,
      selectedClient,
    ]
  );

  function validate(): string | null {
    if (!invoiceNumber.trim()) return 'Numri i faturës është i detyrueshëm.';
    if (!clientId) return 'Zgjidh një klient për faturën.';
    if (!issueDate) return 'Data e lëshimit është e detyrueshme.';
    const filled = items.filter((i) => i.description.trim());
    if (filled.length === 0) return 'Shto të paktën një artikull me përshkrim.';
    return null;
  }

  async function handleCreateClient(event: React.FormEvent) {
    event.preventDefault();
    if (!newClient.name.trim()) return;

    setCreatingClient(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesioni skadoi. Hyr sërish.');

      const { data, error: insertError } = await supabase
        .from('clients')
        .insert({
          owner_id: user.id,
          name: newClient.name.trim(),
          nipt: newClient.nipt.trim() || null,
          email: newClient.email.trim() || null,
          address: newClient.address.trim() || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setClients((prev) => [...prev, data as Client].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId((data as Client).id);
      setShowNewClient(false);
      setNewClient({ name: '', nipt: '', email: '', address: '' });
      setToast('Klienti u shtua.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingClient(false);
    }
  }

  async function handleSave(): Promise<string | null> {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return null;
    }

    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesioni skadoi. Hyr sërish.');

      const cleanItems = items
        .filter((item) => item.description.trim())
        .map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity) || 0,
          price: Number(item.price) || 0,
        }));

      const payload = {
        owner_id: user.id,
        client_id: clientId,
        invoice_number: invoiceNumber.trim(),
        issue_date: issueDate,
        due_date: dueDate || null,
        items: cleanItems,
        subtotal: totals.subtotal,
        vat_percent: vatPercent,
        discount: totals.discount,
        total: totals.total,
        status,
        notes: notes.trim() || null,
        language,
      };

      if (isEdit && invoice) {
        const { error: updateError } = await supabase
          .from('invoices')
          .update(payload)
          .eq('id', invoice.id);
        if (updateError) throw updateError;
        setToast('Fatura u ruajt.');
        return invoice.id;
      }

      const { data, error: insertError } = await supabase
        .from('invoices')
        .insert(payload)
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error(
            `Numri "${invoiceNumber}" është përdorur tashmë. Ndrysho numrin e faturës.`
          );
        }
        // Raised by the enforce_invoice_quota trigger — the cap is enforced in
        // the database now, so this fires even if the UI thought it was fine.
        if (/FREE_PLAN_LIMIT_REACHED/.test(insertError.message)) {
          throw new Error(
            'Ke arritur limitin e planit falas për këtë muaj. Kalo në Pro për fatura të palimituara.'
          );
        }
        throw insertError;
      }

      setToast('Fatura u krijua.');
      return (data as { id: string }).id;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndClose() {
    const id = await handleSave();
    if (id && !isEdit) window.location.assign(`/app/faturat/${id}`);
  }

  async function handleDownload() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusyPdf('download');
    try {
      await downloadInvoicePdf(pdfInput, selectedClient?.name);
    } catch (err) {
      reportPdfError('PDF-ja dështoi', err);
    } finally {
      setBusyPdf(null);
    }
  }

  async function handleShare() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusyPdf('share');
    try {
      const result = await shareInvoicePdf(pdfInput, selectedClient?.name);
      if (result === 'downloaded') setToast('PDF-ja u shkarkua.');
    } catch (err) {
      reportPdfError('Ndarja dështoi', err);
    } finally {
      setBusyPdf(null);
    }
  }

  async function handlePreview() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusyPdf('preview');
    try {
      const { invoicePdfObjectUrl } = await import('@/lib/pdf');
      const url = await invoicePdfObjectUrl(pdfInput);
      window.open(url, '_blank', 'noopener');
      // Give the new tab time to claim the blob before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      reportPdfError('Parapamja dështoi', err);
    } finally {
      setBusyPdf(null);
    }
  }

  const profileIncomplete = !profile?.business_name || !profile?.nipt;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* ------------------------- Left: the form ------------------------- */}
      <div className="space-y-6">
        {needsReload && (
          <div
            role="alert"
            className="border-warning/40 bg-warning/10 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
          >
            <span className="font-medium">
              Faqja u përditësua ndërkohë. Rifreskoje për të shkarkuar PDF-në.
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => window.location.reload()}
              className="shrink-0"
            >
              Rifresko faqen
            </Button>
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

        {limitReached && !isEdit && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            Ke arritur limitin e planit falas për këtë muaj. Mund ta shkarkosh PDF-në, por
            ruajtja do të dështojë derisa të kalosh në Pro.
          </p>
        )}

        {profileIncomplete && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            Të dhënat e biznesit janë të paplota.{' '}
            <a href="/app/cilesimet" className="font-semibold underline">
              Plotëso NIPT-in dhe logon
            </a>{' '}
            që fatura të dalë profesionale.
          </p>
        )}

        {/* Client */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Klienti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-10" aria-label="Zgjidh klientin">
                  <SelectValue placeholder="Zgjidh klientin…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <div className="text-muted-foreground px-2 py-3 text-sm">
                      Ende asnjë klient — shto një më poshtë.
                    </div>
                  ) : (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                        {client.nipt ? ` · ${client.nipt}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewClient((v) => !v)}
                className="h-10 shrink-0"
              >
                <Plus /> Klient i ri
              </Button>
            </div>

            {selectedClient && !showNewClient && (
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="font-semibold">{selectedClient.name}</p>
                {selectedClient.nipt && (
                  <p className="text-muted-foreground">NIPT: {selectedClient.nipt}</p>
                )}
                {selectedClient.address && (
                  <p className="text-muted-foreground">{selectedClient.address}</p>
                )}
                {selectedClient.email && (
                  <p className="text-muted-foreground">{selectedClient.email}</p>
                )}
              </div>
            )}

            {showNewClient && (
              <form
                onSubmit={handleCreateClient}
                className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2"
              >
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nc-name">Emri i klientit *</Label>
                  <Input
                    id="nc-name"
                    value={newClient.name}
                    onChange={(e) =>
                      setNewClient((c) => ({ ...c, name: e.target.value }))
                    }
                    placeholder="Alba Construction sh.p.k."
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc-nipt">NIPT</Label>
                  <Input
                    id="nc-nipt"
                    value={newClient.nipt}
                    onChange={(e) =>
                      setNewClient((c) => ({ ...c, nipt: e.target.value.toUpperCase() }))
                    }
                    placeholder="K81430022M"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc-email">Email</Label>
                  <Input
                    id="nc-email"
                    type="email"
                    value={newClient.email}
                    onChange={(e) =>
                      setNewClient((c) => ({ ...c, email: e.target.value }))
                    }
                    placeholder="info@klienti.al"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nc-address">Adresa</Label>
                  <Input
                    id="nc-address"
                    value={newClient.address}
                    onChange={(e) =>
                      setNewClient((c) => ({ ...c, address: e.target.value }))
                    }
                    placeholder="Rr. Jakov Xoxa, Fier"
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={creatingClient} size="sm">
                    {creatingClient && <Loader2 className="animate-spin" />}
                    Ruaj klientin
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewClient(false)}
                  >
                    Anulo
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Invoice meta */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Të dhënat e faturës</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invoice_number">Numri i faturës *</Label>
              <Input
                id="invoice_number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Statusi</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as InvoiceStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue_date">Data e lëshimit *</Label>
              <DatePicker
                id="issue_date"
                value={issueDate}
                onChange={setIssueDate}
                aria-label="Data e lëshimit"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due_date">Afati i pagesës</Label>
              <DatePicker
                id="due_date"
                value={dueDate}
                onChange={setDueDate}
                placeholder="Pa afat"
                clearable
                aria-label="Afati i pagesës"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="language">Gjuha e faturës</Label>
              <Select
                value={language}
                onValueChange={(v) => setLanguage(v as InvoiceLanguage)}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sq">Shqip</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vat">TVSH</Label>
              <Select
                value={String(vatPercent)}
                onValueChange={(v) => setVatPercent(Number(v))}
              >
                <SelectTrigger id="vat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAT_OPTIONS.map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {v}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Artikujt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Column headers, desktop only */}
            <div className="hidden gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[1fr_80px_120px_110px_40px]">
              <span>Përshkrimi</span>
              <span className="text-right">Sasia</span>
              <span className="text-right">Çmimi</span>
              <span className="text-right">Vlera</span>
              <span />
            </div>

            {items.map((item, index) => {
              const lineTotal =
                (Number(item.quantity) || 0) * (Number(item.price) || 0);
              return (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_80px_120px_110px_40px] sm:items-center sm:border-0 sm:p-0"
                >
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder="Përshkrimi i shërbimit ose produktit"
                    aria-label={`Përshkrimi i artikullit ${index + 1}`}
                  />

                  <div className="grid grid-cols-2 gap-2 sm:contents">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, { quantity: toInt(e.target.value) })
                      }
                      className="sm:text-right"
                      aria-label={`Sasia e artikullit ${index + 1}`}
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={item.price}
                      onChange={(e) => updateItem(index, { price: toInt(e.target.value) })}
                      className="sm:text-right"
                      aria-label={`Çmimi i artikullit ${index + 1}`}
                    />
                  </div>

                  <p className="text-right text-sm font-semibold tabular-nums">
                    {formatALL(lineTotal, false)}
                  </p>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    aria-label={`Fshi artikullin ${index + 1}`}
                    className="justify-self-end text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}

            <Button type="button" variant="outline" onClick={addItem} className="w-full">
              <Plus /> Shto artikull
            </Button>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Shënime</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="p.sh. Pagesa kryhet me transfertë bankare në llogarinë ..."
              rows={3}
            />
          </CardContent>
        </Card>
      </div>

      {/* ------------------------- Right: totals ------------------------- */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Përmbledhje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Nëntotali</dt>
                <dd className="font-medium tabular-nums">{formatALL(totals.subtotal)}</dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">
                  <Label htmlFor="discount" className="font-normal text-muted-foreground">
                    Zbritje
                  </Label>
                </dt>
                <dd>
                  <Input
                    id="discount"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(toInt(e.target.value))}
                    className="h-8 w-28 text-right"
                  />
                </dd>
              </div>

              {vatPercent > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">TVSH {vatPercent}%</dt>
                  <dd className="font-medium tabular-nums">
                    {formatALL(totals.vatAmount)}
                  </dd>
                </div>
              )}

              <div className="flex justify-between border-t pt-3 text-lg">
                <dt className="font-bold">TOTALI</dt>
                <dd className="font-extrabold tabular-nums text-primary">
                  {formatALL(totals.total)}
                </dd>
              </div>
            </dl>

            <div className="space-y-2 border-t pt-4">
              <Button
                type="button"
                onClick={handleSaveAndClose}
                disabled={saving}
                className="w-full"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {isEdit ? 'Ruaj ndryshimet' : 'Ruaj faturën'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleDownload}
                disabled={busyPdf !== null}
                className="w-full"
              >
                {busyPdf === 'download' ? <Loader2 className="animate-spin" /> : <Download />}
                Shkarko PDF
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlePreview}
                  disabled={busyPdf !== null}
                >
                  {busyPdf === 'preview' ? <Loader2 className="animate-spin" /> : <Eye />}
                  Parapamje
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleShare}
                  disabled={busyPdf !== null}
                >
                  {busyPdf === 'share' ? <Loader2 className="animate-spin" /> : <Share2 />}
                  Dërgo
                </Button>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              PDF-ja krijohet në telefonin tënd. Asnjë të dhënë nuk shkon te ndonjë server
              i tretë.
            </p>
          </CardContent>
        </Card>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg md:bottom-6"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
