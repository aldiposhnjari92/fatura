import * as React from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  List,
  Loader2,
  Pencil,
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
import { ProductCombobox } from '@/components/ui/react/product-combobox';
import {
  mergeProductCatalogue,
  mergeProductLine,
  productLineIndex,
  type ProductSuggestion,
} from '@/lib/products';
import {
  computeTotals,
  type Client,
  type Invoice,
  type InvoiceItem,
  type InvoiceStatus,
  type Profile,
} from '@/lib/types';
import { addDays, cn, formatALL, toDateInput } from '@/lib/utils';
import {
  downloadInvoicePdf,
  invoicePdfObjectUrl,
  isPdfEngineLoadError,
  shareInvoicePdf,
} from '@/lib/pdf';
import { flashToast, notify } from '@/lib/toast';
import { startNavProgress } from '@/lib/nav-progress';

interface Props {
  profile: Profile | null;
  clients: Client[];
  invoice?: Invoice | null;
  suggestedNumber: string;
  limitReached?: boolean;
  /** Products this business has invoiced before, most-used first. */
  products?: ProductSuggestion[];
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
  products = [],
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
  const [items, setItems] = React.useState<InvoiceItem[]>(invoice?.items ?? []);
  /*
    The one row of inputs. Everything already on the invoice is a read-only
    line below it, so the form stays the same height whether the invoice has
    one product or thirty. Editing a line pulls it back up into this row.
  */
  const [draft, setDraft] = React.useState<InvoiceItem>(emptyItem);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  /* The line the last Shto landed on, highlighted briefly so a merge is seen. */
  const [flash, setFlash] = React.useState<{ index: number } | null>(null);
  const descriptionRef = React.useRef<HTMLInputElement>(null);
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

  /**
   * Move the composer's line onto the invoice.
   *
   * A product already on the invoice has its quantity raised instead of
   * opening a second identical line — the catalogue exists so nothing is
   * typed twice, and a repeat entry is a quantity change.
   */
  function commitDraft() {
    const description = draft.description.trim();
    if (!description) return;

    const line: InvoiceItem = {
      description,
      quantity: Number(draft.quantity) || 0,
      price: Number(draft.price) || 0,
    };

    if (editingIndex !== null) {
      setItems((prev) => prev.map((item, i) => (i === editingIndex ? line : item)));
      setFlash({ index: editingIndex });
    } else {
      setFlash({ index: productLineIndex(items, description) });
      setItems((prev) => mergeProductLine(prev, line));
    }

    setDraft(emptyItem());
    setEditingIndex(null);
    descriptionRef.current?.focus();
  }

  /** Pull a line back into the composer rather than making every row editable. */
  function editItem(index: number) {
    setDraft({ ...items[index] });
    setEditingIndex(index);
    descriptionRef.current?.focus();
  }

  function cancelEdit() {
    setDraft(emptyItem());
    setEditingIndex(null);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    // Keep the composer aimed at the same line it was editing.
    if (editingIndex === null) return;
    if (editingIndex === index) cancelEdit();
    else if (editingIndex > index) setEditingIndex(editingIndex - 1);
  }

  /*
    A description typed into the composer counts as a line before Shto is
    pressed, so the totals, the preview and the save all agree with what is on
    screen — forgetting to press Shto can't silently drop a product. While a
    line is being edited the list still holds its saved values, so there is
    nothing pending.
  */
  const pendingLine = React.useMemo<InvoiceItem | null>(() => {
    if (editingIndex !== null) return null;
    const description = draft.description.trim();
    if (!description) return null;
    return {
      description,
      quantity: Number(draft.quantity) || 0,
      price: Number(draft.price) || 0,
    };
  }, [draft, editingIndex]);

  /*
    What the field suggests: the stored catalogue plus everything already on
    this invoice, so a product entered for the first time can be picked again
    straight away instead of only after the invoice is saved and reloaded.
  */
  const productOptions = React.useMemo(
    () => mergeProductCatalogue(products, items),
    [products, items]
  );

  /** What the invoice would hold if it were saved right now. */
  const effectiveItems = React.useMemo(
    () => (pendingLine ? mergeProductLine(items, pendingLine) : items),
    [items, pendingLine]
  );

  const totals = React.useMemo(
    () => computeTotals(effectiveItems, vatPercent, discount),
    [effectiveItems, vatPercent, discount]
  );

  // The highlight is an acknowledgement, not a state — let it fade on its own.
  React.useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 1400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const pdfInput = React.useMemo(
    () => ({
      invoice: {
        invoice_number: invoiceNumber,
        issue_date: issueDate,
        due_date: dueDate || null,
        items: effectiveItems,
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
      effectiveItems,
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
    const filled = effectiveItems.filter((i) => i.description.trim());
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

      const cleanItems = effectiveItems
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

    /*
      The tab is claimed here, synchronously, while this click is still what
      the browser considers a user gesture.

      Opening it after the PDF was built is what broke preview on phones:
      building takes a few hundred milliseconds — the jsPDF chunk has to be
      fetched on the first go — and by the time the await resolved the gesture
      had expired. Mobile popup blockers then refuse window.open without
      raising anything, so the button reported success and nothing appeared.

      `noopener` cannot come along: it makes window.open return null by spec,
      and the handle is the whole point. The opener link is cut below instead.
    */
    const tab = window.open('', '_blank');

    setBusyPdf('preview');
    try {
      if (!tab) {
        /*
          Blocked outright, or opened in a browser that hands back nothing.
          Downloading is the one thing every phone will do with a PDF, so the
          invoice still reaches the user — said plainly, not as a success.
        */
        await downloadInvoicePdf(pdfInput, selectedClient?.name);
        notify.info(t('inv.previewBlocked'), t('inv.previewBlockedDesc'));
        return;
      }

      // Something to look at while the engine loads on a slow connection.
      /* A fixed string: the invoice number is the user's own text, and this
         document is written, not templated. Nothing interpolated goes in. */
      tab.document.write(
        '<!doctype html><meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width">' +
          '<title>Fatura</title>' +
          '<body style="margin:0;padding:24px;font:14px system-ui,sans-serif">' +
          'Po përgatitet fatura…'
      );
      tab.document.close();

      const url = await invoicePdfObjectUrl(pdfInput);
      tab.location.href = url;
      try {
        tab.opener = null;
      } catch {
        // Not writable in every browser; the tab is our own blob either way.
      }

      notify.info(t('inv.previewOpened'), t('inv.previewOpenedDesc'));
      // Give the new tab time to claim the blob before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      // Never leave the placeholder sitting there after a failure.
      tab?.close();
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
          <div className="space-y-4">
            {/*
              One row of inputs, always. Each product added drops into the list
              underneath as a line of text, so an invoice with twenty products
              is twenty lines to read rather than sixty fields to scroll past.
              The row sits on the card's own ground: a panel around it would be
              a third surface inside a section that is already one.
            */}
            <div>
              <div className="grid gap-3 sm:grid-cols-[1fr_84px_124px_auto] sm:items-end sm:gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="item-description" className="text-xs">
                    {t('inv.description')}
                  </Label>
                  <ProductCombobox
                    id="item-description"
                    inputRef={descriptionRef}
                    value={draft.description}
                    onValueChange={(description) =>
                      setDraft((d) => ({ ...d, description }))
                    }
                    onEnter={commitDraft}
                    products={productOptions}
                    placeholder={t('inv.descriptionPlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:contents">
                  <div className="grid gap-1.5">
                    <Label htmlFor="item-quantity" className="text-xs">
                      {t('inv.quantity')}
                    </Label>
                    <NumberInput
                      id="item-quantity"
                      value={draft.quantity}
                      onValueChange={(quantity) => setDraft((d) => ({ ...d, quantity }))}
                      className="sm:text-right"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="item-price" className="text-xs">
                      {t('inv.price')}
                    </Label>
                    <NumberInput
                      id="item-price"
                      value={draft.price}
                      onValueChange={(price) => setDraft((d) => ({ ...d, price }))}
                      className="sm:text-right"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  {editingIndex !== null && (
                    <Button type="button" variant="ghost" onClick={cancelEdit}>
                      {t('inv.itemCancelEdit')}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={commitDraft}
                    disabled={!draft.description.trim()}
                    className="flex-1 sm:flex-none"
                  >
                    {editingIndex !== null ? (
                      <>
                        <CheckCircle2 /> {t('inv.itemSaveEdit')}
                      </>
                    ) : (
                      <>
                        <Plus /> {t('inv.addItem')}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {productOptions.length > 0 && editingIndex === null && (
                <p className="text-muted-foreground mt-2 text-xs">
                  {t('inv.productMemoryHint')}
                </p>
              )}
            </div>

            {items.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-4 py-5 text-center text-sm">
                {t('inv.itemsEmpty')}
              </p>
            ) : (
              /*
                A ledger, not a stack of cards: one line per product, hairlines
                between them, and the row height set by the icon buttons rather
                than by padding. `overflow-hidden` is what rounds the first and
                last rows, so no row carries a corner of its own.
              */
              <ul className="divide-border/60 divide-y overflow-hidden rounded-md border">
                {items.map((item, index) => {
                  const lineTotal =
                    (Number(item.quantity) || 0) * (Number(item.price) || 0);
                  return (
                    <li
                      key={index}
                      className={cn(
                        'flex items-center gap-2 py-1 pr-1 pl-3 transition-colors sm:gap-3',
                        editingIndex === index && 'bg-accent/60',
                        flash?.index === index && 'bg-primary/10'
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {item.description}
                      </span>

                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {item.quantity} × {formatALL(item.price, false)}
                      </span>

                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {formatALL(lineTotal, false)}
                      </span>

                      <span className="flex shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => editItem(index)}
                          aria-label={t('inv.itemEditAria', { n: index + 1 })}
                          className="text-muted-foreground hover:text-foreground size-8 rounded-md [&_svg]:size-3.5"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          aria-label={t('inv.itemDeleteAria', { n: index + 1 })}
                          className="text-muted-foreground hover:text-destructive size-8 rounded-md [&_svg]:size-3.5"
                        >
                          <Trash2 />
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
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
          <div className="space-y-5">
            {/*
              The money, on its own ground.

              These four lines used to run as one flat list of hairline-split
              rows straight into the buttons below, which gave the figures and
              the actions the same weight — and the total, at one step up in
              size, barely won an argument it should not have been having. The
              ledger now sits on its own tinted panel and the total is the one
              thing in the card you cannot miss.
            */}
            <div className="bg-muted/40 ring-border/50 rounded-xl p-4 ring-1">
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('inv.subtotal')}</dt>
                  <dd className="font-medium tabular-nums">{formatALL(totals.subtotal)}</dd>
                </div>

                {/*
                  The one editable figure in a column of read-only ones. It is
                  sized and aligned to sit *in* that column — the full-width
                  pill it replaces broke the rhythm of the numbers and read as
                  a form field that had wandered into a receipt.
                */}
                <div className="flex items-center justify-between gap-3">
                  <dt>
                    <Label
                      htmlFor="discount"
                      className="text-muted-foreground font-normal"
                    >
                      {t('inv.discount')}
                    </Label>
                  </dt>
                  <dd>
                    <NumberInput
                      id="discount"
                      value={discount}
                      onValueChange={setDiscount}
                      className="h-9 min-h-9 w-24 text-right tabular-nums"
                    />
                  </dd>
                </div>

                {vatPercent > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {t('inv.vat')} {vatPercent}%
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {formatALL(totals.vatAmount)}
                    </dd>
                  </div>
                )}

                <div className="border-border/60 mt-1 flex items-baseline justify-between gap-3 border-t pt-3">
                  <dt className="text-muted-foreground text-[11px] font-bold tracking-[0.12em] uppercase">
                    {t('inv.total')}
                  </dt>
                  <dd className="text-primary text-2xl font-extrabold tracking-[-0.02em] tabular-nums sm:text-[1.75rem]">
                    {formatALL(totals.total)}
                  </dd>
                </div>
              </dl>
            </div>

            {/*
              Answering "has this been paid?" is the job people come back to an
              invoice for, so it gets its own control here rather than being
              buried in the status dropdown above. Only for saved invoices —
              there is nothing to mark until the row exists.
            */}
            {isEdit && invoice?.id && (
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
            )}

            {/*
              One primary, and only one.

              A draft is not yet a real invoice: confirming is the act that
              issues it, so it takes the solid button and saving-as-draft steps
              down. Once issued there is nothing left to confirm and plain save
              leads. Either way the PDF row below stays secondary — it acts on
              a document that already exists, which is a different question
              from "commit my edits".
            */}
            <div className="space-y-2">
              {status === 'draft' ? (
                <>
                  <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={saving}
                    className="press h-11 w-full"
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
                  className="press h-11 w-full"
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  {isEdit ? t('action.saveChanges') : t('inv.save')}
                </Button>
              )}
            </div>

            {/*
              Three things you can do with the finished PDF, at one weight.

              They were split across two tiers before — download as a
              full-width outline button, view and send as a pair of ghost
              buttons underneath — which implied a hierarchy none of them have
              over each other. Three-up also gives each a real tap target,
              which the ghost row did not on a phone.
            */}
            <div>
              <p className="text-muted-foreground mb-2 text-[11px] font-bold tracking-[0.12em] uppercase">
                {t('inv.pdfActions')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownload}
                  disabled={busyPdf !== null}
                  className="press h-auto flex-col gap-1.5 px-1 py-3 text-xs font-medium"
                >
                  {busyPdf === 'download' ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Download />
                  )}
                  {t('inv.downloadShort')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={busyPdf !== null}
                  className="press h-auto flex-col gap-1.5 px-1 py-3 text-xs font-medium"
                >
                  {busyPdf === 'preview' ? <Loader2 className="animate-spin" /> : <Eye />}
                  {t('inv.previewShort')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleShare}
                  disabled={busyPdf !== null}
                  className="press h-auto flex-col gap-1.5 px-1 py-3 text-xs font-medium"
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
