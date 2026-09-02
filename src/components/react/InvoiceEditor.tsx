import * as React from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  List,
  Loader2,
  Plus,
  Receipt,
  Save,
  Share2,
  StickyNote,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';
import PaidToggle from '@/components/react/PaidToggle';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { NumberInput } from '@/components/ui/react/number-input';
import { Label } from '@/components/ui/react/label';
import { Textarea } from '@/components/ui/react/textarea';
import { DatePicker } from '@/components/ui/react/date-picker';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import {
  computeTotals,
  type Client,
  type Invoice,
  type InvoiceItem,
  type InvoiceStatus,
  type Profile,
} from '@/lib/types';
import { addDays, formatALL, toDateInput } from '@/lib/utils';
import { downloadInvoicePdf, isPdfEngineLoadError, shareInvoicePdf } from '@/lib/pdf';
import { flashToast, notify } from '@/lib/toast';
import { startNavProgress } from '@/lib/nav-progress';

interface Props {
  profile: Profile | null;
  clients: Client[];
  invoice?: Invoice | null;
  suggestedNumber: string;
  limitReached?: boolean;
}

/*
  The app's own card — `bg-card shadow-card rounded-2xl` — rather than the
  bordered `Card` primitive this used before. Settings and the dashboard are
  built that way, and two card treatments one click apart read as an accident.
  The icon chip beside the heading is the same pair the dashboard uses, and it
  is what lets a long form be scanned for the section you came back to edit.
*/
function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card shadow-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="bg-accent text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {hint && <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{hint}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const VAT_OPTIONS = [0, 6, 20];
/* Built per render rather than at module scope: the labels are translated. */
function statusOptions(
  t: ReturnType<typeof useTranslations>
): { value: InvoiceStatus; label: string }[] {
  return [
    { value: 'draft', label: t('status.draft') },
    { value: 'unpaid', label: t('status.unpaid') },
    { value: 'paid', label: t('status.paid') },
    // No 'overdue' entry: lateness is derived from the due date, not chosen.
    // Letting someone pick it would allow the badge to contradict the dates.
  ];
}

const emptyItem = (): InvoiceItem => ({ description: '', quantity: 1, price: 0 });

export default function InvoiceEditor({
  profile,
  clients: initialClients,
  invoice,
  suggestedNumber,
  limitReached = false,
}: Props) {
  const t = useTranslations();
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
  const [paidAt, setPaidAt] = React.useState<string | null>(invoice?.paid_at ?? null);
  const [notes, setNotes] = React.useState(invoice?.notes ?? '');

  const [saving, setSaving] = React.useState(false);
  const [busyPdf, setBusyPdf] = React.useState<'download' | 'share' | 'preview' | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);

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

  /**
   * Surface a failure in both places: the banner keeps it on screen next to the
   * form, the toast says it happened now. The title names the action that
   * failed, so the raw message is free to be the detail under it.
   */
  function fail(title: string, detail: string) {
    setError(`${title}: ${detail}`);
    notify.error(title, detail);
  }

  /** Report a PDF failure, distinguishing "page is stale" from a real error. */
  function reportPdfError(prefix: string, err: unknown) {
    if (isPdfEngineLoadError(err)) {
      setNeedsReload(true);
      setError(null);
      return;
    }
    fail(prefix, (err as Error).message);
  }

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

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
      profile,
      selectedClient,
    ]
  );

  function validate(): string | null {
    if (!invoiceNumber.trim()) return t('inv.errNumberRequired');
    if (!clientId) return t('inv.errClientRequired');
    if (!issueDate) return t('inv.errIssueDateRequired');
    const filled = items.filter((i) => i.description.trim());
    if (filled.length === 0) return t('inv.errNoItems');
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
      if (!user) throw new Error(t('inv.errSessionExpired'));

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
      notify.success(
        t('inv.clientAdded'),
        t('inv.clientAddedDesc', { name: (data as Client).name })
      );
    } catch (err) {
      fail(t('inv.errClientTitle'), (err as Error).message);
    } finally {
      setCreatingClient(false);
    }
  }

  /**
   * `statusOverride` is what "Konfirmo faturën" uses: it issues the invoice in
   * the same write that saves it, rather than making the user remember to
   * change the status dropdown first and then save.
   */
  async function handleSave(statusOverride?: InvoiceStatus): Promise<string | null> {
    const validationError = validate();
    if (validationError) {
      fail(t('inv.errSaveTitle'), validationError);
      return null;
    }

    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t('inv.errSessionExpired'));

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
        status: statusOverride ?? status,
        notes: notes.trim() || null,
      };

      if (isEdit && invoice) {
        const { error: updateError } = await supabase
          .from('invoices')
          .update(payload)
          .eq('id', invoice.id);
        if (updateError) throw updateError;
        if (statusOverride) setStatus(statusOverride);
        notify.success(
          statusOverride ? t('inv.confirmed') : t('inv.saved'),
          statusOverride
            ? t('inv.confirmedDesc', { number: invoiceNumber })
            : t('inv.savedDesc', { number: invoiceNumber })
        );
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
            t('inv.errNumberTaken', { number: invoiceNumber })
          );
        }
        // Raised by the enforce_invoice_quota trigger — the cap is enforced in
        // the database now, so this fires even if the UI thought it was fine.
        // One message for both tiers: what differs is only the number.
        if (/(FREE|STARTER)_PLAN_LIMIT_REACHED/.test(insertError.message)) {
          throw new Error(
            t('inv.errQuota')
          );
        }
        throw insertError;
      }

      if (statusOverride) setStatus(statusOverride);
      // Both callers navigate to the new invoice from here, so the message has
      // to be handed to that page rather than raised on this one.
      flashToast(
        'success',
        statusOverride ? t('inv.confirmed') : t('inv.created'),
        statusOverride
          ? t('inv.confirmedDesc', { number: invoiceNumber })
          : t('inv.createdDesc', { number: invoiceNumber })
      );
      return (data as { id: string }).id;
    } catch (err) {
      fail(t('inv.errSaveTitle'), (err as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  /*
    Saving a new invoice ends on the invoice's own page, which is a second wait
    on top of the insert the user just watched. `handleSave` has already
    cleared `saving` by the time it returns, so the button is put back into its
    spinning state rather than going idle for the length of the page load.
  */
  function leaveFor(href: string) {
    setSaving(true);
    startNavProgress();
    window.location.assign(href);
  }

  async function handleSaveAndClose() {
    const id = await handleSave();
    if (id && !isEdit) leaveFor(`/app/faturat/${id}`);
  }

  /*
    Confirming issues the invoice: it stops being a draft and starts counting
    as money owed. 'unpaid' is the issued-but-not-yet-settled state; marking it
    paid stays a separate, deliberate act via the status dropdown.
  */
  async function handleConfirm() {
    const id = await handleSave('unpaid');
    if (id && !isEdit) leaveFor(`/app/faturat/${id}`);
  }

  async function handleDownload() {
    const validationError = validate();
    if (validationError) {
      fail(t('inv.errPdfFailed'), validationError);
      return;
    }
    setBusyPdf('download');
    try {
      await downloadInvoicePdf(pdfInput, selectedClient?.name);
      notify.success(
        t('inv.pdfDownloaded'),
        t('inv.pdfDownloadedDesc', { number: invoiceNumber })
      );
    } catch (err) {
      reportPdfError(t('inv.errPdfFailed'), err);
    } finally {
      setBusyPdf(null);
    }
  }

  async function handleShare() {
    const validationError = validate();
    if (validationError) {
      fail(t('inv.errShareFailed'), validationError);
      return;
    }
    setBusyPdf('share');
    try {
      const result = await shareInvoicePdf(pdfInput, selectedClient?.name);
      notify.success(
        result === 'downloaded' ? t('inv.pdfDownloaded') : t('inv.shared'),
        result === 'downloaded'
          ? t('inv.pdfDownloadedDesc', { number: invoiceNumber })
          : t('inv.sharedDesc', { number: invoiceNumber })
      );
    } catch (err) {
      reportPdfError(t('inv.errShareFailed'), err);
    } finally {
      setBusyPdf(null);
    }
  }

  async function handlePreview() {
    const validationError = validate();
    if (validationError) {
      fail(t('inv.errPreviewFailed'), validationError);
      return;
    }
    setBusyPdf('preview');
    try {
      const { invoicePdfObjectUrl } = await import('@/lib/pdf');
      const url = await invoicePdfObjectUrl(pdfInput);
      window.open(url, '_blank', 'noopener');
      notify.info(t('inv.previewOpened'), t('inv.previewOpenedDesc'));
      // Give the new tab time to claim the blob before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      reportPdfError(t('inv.errPreviewFailed'), err);
    } finally {
      setBusyPdf(null);
    }
  }

  const profileIncomplete = !profile?.business_name || !profile?.nipt;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* ------------------------- Left: the form ------------------------- */}
      <div className="space-y-5">
        {needsReload && (
          <div
            role="alert"
            className="border-warning/40 bg-warning/10 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
          >
            <span className="font-medium">
              {t('inv.staleReload')}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => window.location.reload()}
              className="shrink-0"
            >
              {t('inv.reloadPage')}
            </Button>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm font-medium"
          >
            {error}
          </p>
        )}

        {limitReached && !isEdit && (
          <p className="border-warning/40 bg-warning/10 rounded-xl border px-4 py-3 text-sm font-medium">
            {t('inv.warnLimitReached')}
          </p>
        )}

        {profileIncomplete && (
          <p className="border-warning/40 bg-warning/10 rounded-xl border px-4 py-3 text-sm">
            {t('inv.warnProfileIncomplete')}{' '}
            <a href="/app/cilesimet" className="font-semibold underline">
              {t('inv.warnProfileLink')}
            </a>{' '}
            {t('inv.warnProfileTail')}
          </p>
        )}

        {/* Client */}
        <Section icon={Users} title={t('inv.client')} hint="Kujt i lëshohet kjo faturë">
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              {/*
                Searchable: this is the one list in the form that grows without
                limit, and scrolling a hundred clients to find one is the thing
                that makes invoicing slow. The VAT number is searchable too,
                because that is often what a business remembers.
              */}
              <SearchableSelect
                value={clientId}
                onValueChange={setClientId}
                aria-label={t('inv.client')}
                className="flex-1"
                placeholder={t('inv.clientPlaceholder')}
                searchPlaceholder={t('cli.searchPlaceholder')}
                emptyText={t('adm.noResults')}
                options={clients.map((client) => ({
                  value: client.id,
                  label: client.name,
                  hint: client.nipt ? `NIPT: ${client.nipt}` : undefined,
                }))}
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewClient((v) => !v)}
                className="h-10 shrink-0"
              >
                <Plus /> {t('cli.new')}
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
                  <Label htmlFor="nc-name">{t('inv.clientNameLabel')} *</Label>
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
                  <Label htmlFor="nc-nipt">{t('cli.nipt')}</Label>
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
                  <Label htmlFor="nc-email">{t('cli.email')}</Label>
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
                  <Label htmlFor="nc-address">{t('cli.address')}</Label>
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
                    {t('inv.saveClient')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewClient(false)}
                  >
                    {t('action.cancel')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Section>

        {/* Invoice meta */}
        <Section icon={FileText} title={t('inv.details')} hint="Numri, datat dhe TVSH-ja">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invoice_number">{t('inv.number')} *</Label>
              <Input
                id="invoice_number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">{t('inv.status')}</Label>
              {/*
                A paid invoice is final in the database, so the control is
                disabled rather than left enabled to fail on save. The hint
                below says why, so a locked field never looks like a bug.
              */}
              <SearchableSelect
                id="status"
                value={status}
                onValueChange={(v) => setStatus(v as InvoiceStatus)}
                disabled={isEdit && status === 'paid'}
                aria-label={t('inv.status')}
                searchPlaceholder={t('action.search')}
                emptyText={t('adm.noResults')}
                options={statusOptions(t).map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
              />
              {isEdit && status === 'paid' && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t('inv.paidLockedHint')}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue_date">{t('inv.issueDate')} *</Label>
              <DatePicker
                id="issue_date"
                value={issueDate}
                onChange={setIssueDate}
                aria-label={t('inv.issueDate')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due_date">{t('inv.dueDate')}</Label>
              <DatePicker
                id="due_date"
                value={dueDate}
                onChange={setDueDate}
                placeholder={t('inv.noDueDate')}
                clearable
                aria-label={t('inv.dueDate')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vat">{t('inv.vat')}</Label>
              <SearchableSelect
                id="vat"
                value={String(vatPercent)}
                onValueChange={(v) => setVatPercent(Number(v))}
                aria-label={t('inv.vat')}
                searchPlaceholder={t('action.search')}
                emptyText={t('adm.noResults')}
                options={VAT_OPTIONS.map((v) => ({
                  value: String(v),
                  label: `${v}%`,
                }))}
              />
            </div>
          </div>
        </Section>

        {/* Items */}
        <Section icon={List} title={t('inv.items')} hint="Çfarë po faturon">
          <div className="space-y-3">
            {/* Column headers, desktop only */}
            <div className="hidden gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[1fr_80px_120px_110px_40px]">
              <span>{t('inv.description')}</span>
              <span className="text-right">{t('inv.quantity')}</span>
              <span className="text-right">{t('inv.price')}</span>
              <span className="text-right">{t('inv.amount')}</span>
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
                    placeholder={t('inv.descriptionPlaceholder')}
                    aria-label={t('inv.itemDescriptionAria', { n: index + 1 })}
                  />

                  <div className="grid grid-cols-2 gap-2 sm:contents">
                    <NumberInput
                      value={item.quantity}
                      onValueChange={(quantity) => updateItem(index, { quantity })}
                      className="sm:text-right"
                      aria-label={t('inv.itemQtyAria', { n: index + 1 })}
                    />
                    <NumberInput
                      value={item.price}
                      onValueChange={(price) => updateItem(index, { price })}
                      className="sm:text-right"
                      aria-label={t('inv.itemPriceAria', { n: index + 1 })}
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
                    aria-label={t('inv.itemDeleteAria', { n: index + 1 })}
                    className="justify-self-end text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}

            <Button type="button" variant="outline" onClick={addItem} className="w-full">
              <Plus /> {t('inv.addItem')}
            </Button>
          </div>
        </Section>

        {/* Notes */}
        <Section icon={StickyNote} title={t('inv.notes')} hint="Shfaqen në fund të PDF-së">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('inv.notesPlaceholder')}
            rows={3}
          />
        </Section>
      </div>

      {/* ------------------------- Right: totals ------------------------- */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Section icon={Receipt} title={t('inv.summary')}>
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('inv.subtotal')}</dt>
                <dd className="font-medium tabular-nums">{formatALL(totals.subtotal)}</dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">
                  <Label htmlFor="discount" className="font-normal text-muted-foreground">
                    {t('inv.discount')}
                  </Label>
                </dt>
                <dd>
                  <NumberInput
                    id="discount"
                    value={discount}
                    onValueChange={setDiscount}
                    className="w-28 text-right"
                  />
                </dd>
              </div>

              {vatPercent > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t('inv.vat')} {vatPercent}%</dt>
                  <dd className="font-medium tabular-nums">
                    {formatALL(totals.vatAmount)}
                  </dd>
                </div>
              )}

              <div className="flex justify-between border-t pt-3 text-lg">
                <dt className="font-bold">{t('inv.total')}</dt>
                <dd className="font-extrabold tabular-nums text-primary">
                  {formatALL(totals.total)}
                </dd>
              </div>
            </dl>

            {/*
              Answering "has this been paid?" is the job people come back to an
              invoice for, so it gets its own control here rather than being
              buried in the status dropdown above. Only for saved invoices —
              there is nothing to mark until the row exists.
            */}
            {isEdit && invoice?.id && (
              <div className="border-t pt-4">
                <PaidToggle
                  invoiceId={invoice.id}
                  status={status}
                  paidAt={paidAt}
                  variant="panel"
                  onStatusChange={(nextStatus, nextPaidAt) => {
                    // Keep the form in step: the status dropdown, its
                    // paid-lock and the toast all read this state.
                    setStatus(nextStatus);
                    setPaidAt(nextPaidAt);
                  }}
                />
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              {/*
                A draft is not yet a real invoice. Confirming is the act that
                issues it, so it gets the primary button and saving-as-draft
                steps down to secondary. Once issued, there is nothing left to
                confirm and plain save takes the lead again.
              */}
              {status === 'draft' ? (
                <>
                  <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={saving}
                    className="press w-full"
                  >
                    {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                    {t('inv.confirm')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveAndClose}
                    disabled={saving}
                    className="press w-full"
                  >
                    <Save />
                    {t('inv.saveDraft')}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={handleSaveAndClose}
                  disabled={saving}
                  className="press w-full"
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  {isEdit ? t('action.saveChanges') : t('inv.save')}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={handleDownload}
                disabled={busyPdf !== null}
                className="w-full"
              >
                {busyPdf === 'download' ? <Loader2 className="animate-spin" /> : <Download />}
                {t('inv.downloadPdf')}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlePreview}
                  disabled={busyPdf !== null}
                >
                  {busyPdf === 'preview' ? <Loader2 className="animate-spin" /> : <Eye />}
                  {t('inv.preview')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleShare}
                  disabled={busyPdf !== null}
                >
                  {busyPdf === 'share' ? <Loader2 className="animate-spin" /> : <Share2 />}
                  {t('inv.share')}
                </Button>
              </div>
            </div>

            <p className="text-muted-foreground text-center text-xs">
              {t('inv.pdfNote')}
            </p>
          </div>
        </Section>
      </div>

    </div>
  );
}
