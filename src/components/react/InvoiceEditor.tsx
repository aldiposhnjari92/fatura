import * as React from 'react';
import { Plus, StickyNote, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/react/button';
import { Textarea } from '@/components/ui/react/textarea';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import { mergeProductCatalogue } from '@/lib/products';
import { computeTotals } from '@/lib/invoices';
import { addDays, toDateInput } from '@/lib/utils';
import { flashToast, notify } from '@/lib/toast';
import { startNavProgress } from '@/lib/nav-progress';
import EditorSection from './invoice-editor/EditorSection';
import InvoiceDetailsSection from './invoice-editor/InvoiceDetailsSection';
import InvoiceItemsSection from './invoice-editor/InvoiceItemsSection';
import InvoiceSummary from './invoice-editor/InvoiceSummary';
import NewClientForm from './invoice-editor/NewClientForm';
import { useInvoiceItems } from './invoice-editor/use-invoice-items';
import { useInvoicePdfActions } from './invoice-editor/use-invoice-pdf-actions';
import type { Client } from '@/models/client';
import type { InvoiceEditorProps, InvoiceStatus } from '@/models/invoice';

/*
  The invoice form. This file owns the invoice's fields and saving; the
  sections it is drawn from live in ./invoice-editor, along with the line-item
  composer (useInvoiceItems) and the PDF actions (useInvoicePdfActions).
*/
export default function InvoiceEditor({
  profile,
  clients: initialClients,
  invoice,
  suggestedNumber,
  limitReached = false,
  products = [],
}: InvoiceEditorProps) {
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
  const lines = useInvoiceItems(invoice?.items ?? []);
  const { items, effectiveItems } = lines;
  const [vatPercent, setVatPercent] = React.useState<number>(invoice?.vat_percent ?? 20);
  const [discount, setDiscount] = React.useState<number>(invoice?.discount ?? 0);
  const [status, setStatus] = React.useState<InvoiceStatus>(invoice?.status ?? 'draft');
  const [paidAt, setPaidAt] = React.useState<string | null>(invoice?.paid_at ?? null);
  const [notes, setNotes] = React.useState(invoice?.notes ?? '');

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showNewClient, setShowNewClient] = React.useState(false);

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

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  /*
    What the field suggests: the stored catalogue plus everything already on
    this invoice, so a product entered for the first time can be picked again
    straight away instead of only after the invoice is saved and reloaded.
  */
  const productOptions = React.useMemo(
    () => mergeProductCatalogue(products, items),
    [products, items]
  );

  const totals = React.useMemo(
    () => computeTotals(effectiveItems, vatPercent, discount),
    [effectiveItems, vatPercent, discount]
  );

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

  const pdf = useInvoicePdfActions({
    pdfInput,
    clientName: selectedClient?.name,
    invoiceNumber,
    validate,
    onError: fail,
    onEngineStale: () => {
      setNeedsReload(true);
      setError(null);
    },
  });

  function handleClientCreated(client: Client) {
    setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
    setClientId(client.id);
    setShowNewClient(false);
    setError(null);
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
        <EditorSection icon={Users} title={t('inv.client')} hint="Kujt i lëshohet kjo faturë">
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
              <NewClientForm
                onCreated={handleClientCreated}
                onCancel={() => setShowNewClient(false)}
                onError={fail}
              />
            )}
          </div>
        </EditorSection>

        <InvoiceDetailsSection
          invoiceNumber={invoiceNumber}
          onInvoiceNumber={setInvoiceNumber}
          status={status}
          onStatus={setStatus}
          statusLocked={isEdit && status === 'paid'}
          issueDate={issueDate}
          onIssueDate={setIssueDate}
          dueDate={dueDate}
          onDueDate={setDueDate}
          vatPercent={vatPercent}
          onVatPercent={setVatPercent}
        />

        <InvoiceItemsSection state={lines} products={productOptions} />

        {/* Notes */}
        <EditorSection icon={StickyNote} title={t('inv.notes')} hint="Shfaqen në fund të PDF-së">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('inv.notesPlaceholder')}
            rows={3}
          />
        </EditorSection>
      </div>

      {/* ------------------------- Right: totals ------------------------- */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <InvoiceSummary
          totals={totals}
          vatPercent={vatPercent}
          discount={discount}
          onDiscount={setDiscount}
          invoiceId={invoice?.id ?? null}
          isEdit={isEdit}
          status={status}
          paidAt={paidAt}
          onPaidChange={(nextStatus, nextPaidAt) => {
            // Keep the form in step: the status dropdown, its
            // paid-lock and the toast all read this state.
            setStatus(nextStatus);
            setPaidAt(nextPaidAt);
          }}
          saving={saving}
          onConfirm={handleConfirm}
          onSave={handleSaveAndClose}
          pdf={pdf}
        />
      </div>
    </div>
  );
}
