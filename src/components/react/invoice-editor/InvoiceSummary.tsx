import { CheckCircle2, Download, Eye, Loader2, Printer, Receipt, Save, Share2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { formatALL } from '@/lib/utils';
import PaidToggle from '@/components/react/PaidToggle';
import { Button } from '@/components/ui/react/button';
import { Label } from '@/components/ui/react/label';
import { NumberInput } from '@/components/ui/react/number-input';
import EditorSection from './EditorSection';
import type { InvoiceSummaryProps } from '@/models/invoice';

const PDF_BUTTON = 'press h-auto flex-col gap-1.5 px-1 py-3 text-xs font-medium';

/** The right column: the money, whether it was paid, saving, and the PDF actions. */
export default function InvoiceSummary({
  totals,
  vatPercent,
  discount,
  onDiscount,
  invoiceId,
  isEdit,
  status,
  paidAt,
  onPaidChange,
  saving,
  onConfirm,
  onSave,
  pdf,
}: InvoiceSummaryProps) {
  const t = useTranslations();

  return (
    <EditorSection icon={Receipt} title={t('inv.summary')}>
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
                <Label htmlFor="discount" className="text-muted-foreground font-normal">
                  {t('inv.discount')}
                </Label>
              </dt>
              <dd>
                <NumberInput
                  id="discount"
                  value={discount}
                  onValueChange={onDiscount}
                  className="h-9 min-h-9 w-24 text-right tabular-nums"
                />
              </dd>
            </div>

            {vatPercent > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">
                  {t('inv.vat')} {vatPercent}%
                </dt>
                <dd className="font-medium tabular-nums">{formatALL(totals.vatAmount)}</dd>
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
        {isEdit && invoiceId && (
          <PaidToggle
            invoiceId={invoiceId}
            status={status}
            paidAt={paidAt}
            variant="panel"
            onStatusChange={onPaidChange}
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
              <Button type="button" onClick={onConfirm} disabled={saving} className="press h-11 w-full">
                {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                {t('inv.confirm')}
              </Button>
              <Button type="button" variant="outline" onClick={onSave} disabled={saving} className="press w-full">
                <Save />
                {t('inv.saveDraft')}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={onSave} disabled={saving} className="press h-11 w-full">
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {isEdit ? t('action.saveChanges') : t('inv.save')}
            </Button>
          )}
        </div>

        {/*
          Four things you can do with the finished PDF, at one weight.

          They were split across two tiers before — download as a
          full-width outline button, view and send as a pair of ghost
          buttons underneath — which implied a hierarchy none of them have
          over each other. One row also gives each a real tap target,
          which the ghost row did not on a phone.
        */}
        <div>
          <p className="text-muted-foreground mb-2 text-[11px] font-bold tracking-[0.12em] uppercase">
            {t('inv.pdfActions')}
          </p>
          <div className="grid grid-cols-4 gap-2">
            <Button type="button" variant="outline" onClick={pdf.download} disabled={pdf.busy !== null} className={PDF_BUTTON}>
              {pdf.busy === 'download' ? <Loader2 className="animate-spin" /> : <Download />}
              {t('inv.downloadShort')}
            </Button>
            <Button type="button" variant="outline" onClick={pdf.preview} disabled={pdf.busy !== null} className={PDF_BUTTON}>
              {pdf.busy === 'preview' ? <Loader2 className="animate-spin" /> : <Eye />}
              {t('inv.previewShort')}
            </Button>
            <Button type="button" variant="outline" onClick={pdf.print} disabled={pdf.busy !== null} className={PDF_BUTTON}>
              {pdf.busy === 'print' ? <Loader2 className="animate-spin" /> : <Printer />}
              {t('inv.print')}
            </Button>
            <Button type="button" variant="outline" onClick={pdf.share} disabled={pdf.busy !== null} className={PDF_BUTTON}>
              {pdf.busy === 'share' ? <Loader2 className="animate-spin" /> : <Share2 />}
              {t('inv.share')}
            </Button>
          </div>
        </div>

        <p className="text-muted-foreground text-center text-xs">{t('inv.pdfNote')}</p>
      </div>
    </EditorSection>
  );
}
