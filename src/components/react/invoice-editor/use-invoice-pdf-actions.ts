import * as React from 'react';
import { useTranslations } from '@/lib/i18n';
import {
  downloadInvoicePdf,
  invoicePdfObjectUrl,
  isPdfEngineLoadError,
  printInvoicePdf,
  shareInvoicePdf,
} from '@/lib/pdf';
import { notify } from '@/lib/toast';
import type { InvoicePdfAction, InvoicePdfActions, InvoicePdfActionsOptions } from '@/models/invoice';

/** Download, preview, print and share the invoice as it stands on screen — saved or not. */
export function useInvoicePdfActions({
  pdfInput,
  clientName,
  invoiceNumber,
  validate,
  onError,
  onEngineStale,
}: InvoicePdfActionsOptions): InvoicePdfActions {
  const t = useTranslations();
  const [busy, setBusy] = React.useState<InvoicePdfAction | null>(null);

  /** Report a PDF failure, distinguishing "page is stale" from a real error. */
  function report(prefix: string, err: unknown) {
    if (isPdfEngineLoadError(err)) {
      onEngineStale();
      return;
    }
    onError(prefix, (err as Error).message);
  }

  /** Validation first, then the action with its own busy state and error title. */
  async function run(action: InvoicePdfAction, errorTitle: string, work: () => Promise<void>) {
    const validationError = validate();
    if (validationError) {
      onError(errorTitle, validationError);
      return;
    }
    setBusy(action);
    try {
      await work();
    } catch (err) {
      report(errorTitle, err);
    } finally {
      setBusy(null);
    }
  }

  const download = () =>
    run('download', t('inv.errPdfFailed'), async () => {
      await downloadInvoicePdf(pdfInput, clientName);
      notify.success(t('inv.pdfDownloaded'), t('inv.pdfDownloadedDesc', { number: invoiceNumber }));
    });

  const print = () => run('print', t('inv.errPrintFailed'), () => printInvoicePdf(pdfInput));

  const share = () =>
    run('share', t('inv.errShareFailed'), async () => {
      const result = await shareInvoicePdf(pdfInput, clientName);
      notify.success(
        result === 'downloaded' ? t('inv.pdfDownloaded') : t('inv.shared'),
        result === 'downloaded'
          ? t('inv.pdfDownloadedDesc', { number: invoiceNumber })
          : t('inv.sharedDesc', { number: invoiceNumber })
      );
    });

  async function preview() {
    const validationError = validate();
    if (validationError) {
      onError(t('inv.errPreviewFailed'), validationError);
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

    setBusy('preview');
    try {
      if (!tab) {
        /*
          Blocked outright, or opened in a browser that hands back nothing.
          Downloading is the one thing every phone will do with a PDF, so the
          invoice still reaches the user — said plainly, not as a success.
        */
        await downloadInvoicePdf(pdfInput, clientName);
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
      report(t('inv.errPreviewFailed'), err);
    } finally {
      setBusy(null);
    }
  }

  return { busy, download, preview, print, share };
}
