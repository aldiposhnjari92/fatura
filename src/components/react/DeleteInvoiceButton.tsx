import * as React from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
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
import { startNavProgress } from '@/lib/nav-progress';

/* How long the confirmation is held before the list takes over. */
const CONFIRM_MS = 1000;

interface Props {
  invoiceId: string;
  invoiceNumber: string;
}

export default function DeleteInvoiceButton({ invoiceId, invoiceNumber }: Props) {
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const timer = React.useRef<number>();

  // The navigation is on a timer, so it has to be dropped if this unmounts
  // first — otherwise the tab is sent to the list from a page that is gone.
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
      if (deleteError) throw deleteError;
      /*
        The invoice this page is showing no longer exists, so the dialog cannot
        simply close — it holds the confirmation and then hands over to the
        list, which is what replaces it on screen.
      */
      setDone(true);
      // The list is what replaces this page, so that is where the
      // confirmation has to land.
      flashToast(
        'success',
        'Fatura u fshi.',
        `Fatura ${invoiceNumber} u hoq përgjithmonë.`
      );
      timer.current = window.setTimeout(
        () => {
          startNavProgress();
          window.location.assign('/app/faturat');
        },
        CONFIRM_MS
      );
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      notify.error('Fatura nuk u fshi', message);
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 /> Fshi
      </Button>

      {/* Once it is gone there is nothing left to cancel, so the dialog stops
          taking dismissals for the second it is showing the confirmation. */}
      <Dialog open={open} onOpenChange={(next) => !done && setOpen(next)}>
        <DialogContent hideClose={done}>
          {done ? (
            <SuccessNote>
              <DialogTitle className="text-base font-semibold">
                Fatura u fshi me sukses
              </DialogTitle>
            </SuccessNote>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Fshi faturën {invoiceNumber}?</DialogTitle>
                <DialogDescription>
                  Ky veprim është i pakthyeshëm. Fatura dhe të dhënat e saj fshihen
                  përgjithmonë.
                </DialogDescription>
              </DialogHeader>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
                  Anulo
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting && <Loader2 className="animate-spin" />}
                  Po, fshije
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
