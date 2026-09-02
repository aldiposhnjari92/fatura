import * as React from 'react';
import { Download, Loader2, MoreHorizontal, Share2, SquarePen, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/react/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import { SuccessNote } from '@/components/ui/react/success-note';
import {
  downloadInvoicePdf,
  isPdfEngineLoadError,
  shareInvoicePdf,
  type InvoicePdfInput,
} from '@/lib/pdf';
import { flashToast, notify } from '@/lib/toast';
import { useTranslations } from '@/lib/i18n';
import { startNavProgress } from '@/lib/nav-progress';
import type { Client, Profile } from '@/lib/types';

/*
  The row's own actions, so the common ones stop costing a page load.

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

interface Props {
  invoiceId: string;
  invoiceNumber: string;
}

export default function InvoiceRowActions({ invoiceId, invoiceNumber }: Props) {
  const t = useTranslations();
  const [busy, setBusy] = React.useState<'download' | 'share' | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleted, setDeleted] = React.useState(false);
  const timer = React.useRef<number>();

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

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

  async function handleDownload() {
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

  async function handleShare() {
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

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
      if (error) throw error;
      setDeleted(true);
      /*
        The row is server-rendered, and so are the status counts and the money
        strip above it — every one of them is now wrong. Reloading is the only
        honest way to put the page back in step, so the confirmation is handed
        to the page that comes back.
      */
      flashToast('success', 'Fatura u fshi.', `Fatura ${invoiceNumber} u hoq përgjithmonë.`);
      timer.current = window.setTimeout(() => {
        startNavProgress();
        window.location.reload();
      }, 900);
    } catch (err) {
      notify.error('Fatura nuk u fshi', (err as Error).message);
      setDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-8"
            aria-label={`Veprime për faturën ${invoiceNumber}`}
          >
            {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <a href={`/app/faturat/${invoiceId}`}>
              <SquarePen /> {t('action.edit')}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleDownload()} disabled={busy !== null}>
            <Download /> {t('inv.downloadPdf')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleShare()} disabled={busy !== null}>
            <Share2 /> {t('inv.share')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={() => setConfirming(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 /> {t('action.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Once it is gone there is nothing left to cancel, so the dialog stops
          offering the choice and just reports. */}
      <Dialog
        open={confirming}
        onOpenChange={(next) => !next && !deleting && !deleted && setConfirming(false)}
      >
        <DialogContent className="sm:max-w-md">
          {deleted ? (
            <SuccessNote>
              <DialogTitle className="text-base font-semibold">
                {t('inv.deleted')}
              </DialogTitle>
            </SuccessNote>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t('inv.deleteConfirm')}</DialogTitle>
                <DialogDescription>
                  {invoiceNumber} — {t('inv.deleteWarning')}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                >
                  {t('action.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting && <Loader2 className="animate-spin" />}
                  {t('action.delete')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
