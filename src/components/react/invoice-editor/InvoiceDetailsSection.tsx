import { FileText } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { DatePicker } from '@/components/ui/react/date-picker';
import { Input } from '@/components/ui/react/input';
import { Label } from '@/components/ui/react/label';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import EditorSection from './EditorSection';
import type { InvoiceDetailsSectionProps, InvoiceStatus } from '@/models/invoice';

const VAT_OPTIONS = [0, 6, 20];

/** Number, status, dates and VAT. */
export default function InvoiceDetailsSection({
  invoiceNumber,
  onInvoiceNumber,
  status,
  onStatus,
  statusLocked,
  issueDate,
  onIssueDate,
  dueDate,
  onDueDate,
  vatPercent,
  onVatPercent,
}: InvoiceDetailsSectionProps) {
  const t = useTranslations();
  const statusOptions: { value: InvoiceStatus; label: string }[] = [
    { value: 'draft', label: t('status.draft') },
    { value: 'unpaid', label: t('status.unpaid') },
    { value: 'paid', label: t('status.paid') },
    // No 'overdue' entry: lateness is derived from the due date, not chosen.
    // Letting someone pick it would allow the badge to contradict the dates.
  ];

  return (
    <EditorSection icon={FileText} title={t('inv.details')} hint="Numri, datat dhe TVSH-ja">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="invoice_number">{t('inv.number')} *</Label>
          <Input
            id="invoice_number"
            value={invoiceNumber}
            onChange={(e) => onInvoiceNumber(e.target.value)}
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
            onValueChange={(v) => onStatus(v as InvoiceStatus)}
            disabled={statusLocked}
            aria-label={t('inv.status')}
            searchPlaceholder={t('action.search')}
            emptyText={t('adm.noResults')}
            options={statusOptions}
          />
          {statusLocked && (
            <p className="text-muted-foreground text-xs leading-relaxed">{t('inv.paidLockedHint')}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="issue_date">{t('inv.issueDate')} *</Label>
          <DatePicker id="issue_date" value={issueDate} onChange={onIssueDate} aria-label={t('inv.issueDate')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="due_date">{t('inv.dueDate')}</Label>
          <DatePicker
            id="due_date"
            value={dueDate}
            onChange={onDueDate}
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
            onValueChange={(v) => onVatPercent(Number(v))}
            aria-label={t('inv.vat')}
            searchPlaceholder={t('action.search')}
            emptyText={t('adm.noResults')}
            options={VAT_OPTIONS.map((v) => ({ value: String(v), label: `${v}%` }))}
          />
        </div>
      </div>
    </EditorSection>
  );
}
