import * as React from 'react';
import { supabase } from '@/lib/supabase';
import {
  downloadInvoicePdf,
  isPdfEngineLoadError,
  shareInvoicePdf,
  type InvoicePdfInput,
} from '@/lib/pdf';
import { exportInvoiceToExcel } from '@/lib/excel';
import { notify } from '@/lib/toast';
import { useTranslations } from '@/lib/i18n';
import type { Client, Profile } from '@/lib/types';

/*
  PDF, Excel and share for one saved invoice, by id — shared by the list's row
  menu and the paid invoice's detail view.

  The list deliberately does not select `items` — the whole point of that query
  is to not drag every invoice's line items across the wire to render a table
  that never shows them. A PDF needs them, so this fetches the one invoice it
  was asked about, at the moment it is asked, and no sooner.

  The profile is the same for every row, so it is fetched once per page and
  shared: twenty-five rows each carrying a copy of the business address in the
  server-rendered HTML would cost more than the request does.
*/

let profileRequest: Promise<Partial<Profile> | null> | null = null;

function loadProfile(): Promise<Partial<Profile> | null> {
  if (!profileRequest) {
    profileRequest = (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('business_name, nipt, address, city, phone, logo_url')
        .eq('id', user.id)
        .maybeSingle();
      return (data as Partial<Profile>) ?? null;
    })();
  }
  return profileRequest;
}

export type InvoiceFileAction = 'download' | 'excel' | 'share';

export function useInvoiceFiles(invoiceId: string, invoiceNumber: string) {
  const t = useTranslations();
  const [busy, setBusy] = React.useState<InvoiceFileAction | null>(null);

  async function pdfInput(): Promise<{ input: InvoicePdfInput; clientName: string | null }> {
    const [invoiceResult, profile] = await Promise.all([
      supabase
        .from('invoices')
        .select(
          'invoice_number, issue_date, due_date, items, vat_percent, discount, status, notes, clients(name, nipt, address, email)'
        )
        .eq('id', invoiceId)
        .single(),
      loadProfile(),
    ]);

    if (invoiceResult.error) throw invoiceResult.error;
    const row = invoiceResult.data as unknown as InvoicePdfInput['invoice'] & {
      clients: Partial<Client> | null;
    };
    return {
      input: { invoice: row, profile, client: row.clients ?? null },
      clientName: row.clients?.name ?? null,
    };
  }

  /** The PDF chunk failing to load means the page is stale, not broken. */
  function reportPdfError(title: string, err: unknown) {
    notify.error(
      title,
      isPdfEngineLoadError(err) ? t('inv.staleReload') : (err as Error).message
    );
  }

  async function download() {
    setBusy('download');
    try {
      const { input, clientName } = await pdfInput();
      await downloadInvoicePdf(input, clientName);
      notify.success(
        t('inv.pdfDownloaded'),
        t('inv.pdfDownloadedDesc', { number: invoiceNumber })
      );
    } catch (err) {
      reportPdfError(t('inv.errPdfFailed'), err);
    } finally {
      setBusy(null);
    }
  }

  async function excel() {
    setBusy('excel');
    try {
      await exportInvoiceToExcel(supabase, invoiceId);
      notify.success(
        t('xls.invoiceExported'),
        t('xls.invoiceExportedDesc', { number: invoiceNumber })
      );
    } catch (err) {
      notify.error(t('xls.errExport'), (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy('share');
    try {
      const { input, clientName } = await pdfInput();
      const result = await shareInvoicePdf(input, clientName);
      notify.success(
        result === 'downloaded' ? t('inv.pdfDownloaded') : t('inv.shared'),
        result === 'downloaded'
          ? t('inv.pdfDownloadedDesc', { number: invoiceNumber })
          : t('inv.sharedDesc', { number: invoiceNumber })
      );
    } catch (err) {
      reportPdfError(t('inv.errShareFailed'), err);
    } finally {
      setBusy(null);
    }
  }

  return { busy, download, excel, share };
}
