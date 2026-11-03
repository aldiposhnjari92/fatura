import * as React from 'react';
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  MoreHorizontal,
  Printer,
  Share2,
  SquarePen,
  Trash2,
} from 'lucide-react';
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
import { flashToast, notify } from '@/lib/toast';
import { useTranslations } from '@/lib/i18n';
import { startNavProgress } from '@/lib/nav-progress';
import { INVOICE_STATUS_EVENT } from '@/components/react/PaidToggle';
import { useInvoiceFiles } from '@/components/react/use-invoice-files';
import type { InvoiceRowActionsProps, InvoiceStatusEvent } from '@/models/invoice';

/* The row's own actions, so the common ones stop costing a page load. */

export default function InvoiceRowActions({
  invoiceId,
  invoiceNumber,
  status: initialStatus,
  allowExcel = true,
}: InvoiceRowActionsProps) {
  const t = useTranslations();
  const [status, setStatus] = React.useState(initialStatus);

  // The paid toggle is a separate island in the same row; it announces the
  // change so "Ndrysho" locks the moment the invoice is marked paid.
  React.useEffect(() => {
    function onStatus(event: Event) {
      const { detail } = event as InvoiceStatusEvent;
      if (detail.invoiceId === invoiceId) setStatus(detail.status);
    }
    window.addEventListener(INVOICE_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(INVOICE_STATUS_EVENT, onStatus);
  }, [invoiceId]);

  /** Paid is final: no edit — see 0019/0020. It can still be deleted. */
  const locked = status === 'paid';
  const { busy, download, print, excel, share } = useInvoiceFiles(invoiceId, invoiceNumber);
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleted, setDeleted] = React.useState(false);
  const timer = React.useRef<number>();

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

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
          {locked ? (
            // Disabled items take no pointer events, so the reason is written
            // into the item itself rather than left to a tooltip nobody sees.
            <DropdownMenuItem disabled className="items-start">
              <Lock className="mt-0.5" />
              <span className="flex flex-col">
                {t('action.edit')}
                <span className="text-muted-foreground text-xs">{t('inv.paidNoEdit')}</span>
              </span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <a href={`/app/faturat/${invoiceId}`}>
                <SquarePen /> {t('action.edit')}
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => void download()} disabled={busy !== null}>
            <Download /> {t('inv.downloadPdf')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void print()} disabled={busy !== null}>
            <Printer /> {t('inv.print')}
          </DropdownMenuItem>
          {allowExcel && (
            <DropdownMenuItem onSelect={() => void excel()} disabled={busy !== null}>
              <FileSpreadsheet /> {t('inv.downloadExcel')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => void share()} disabled={busy !== null}>
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
