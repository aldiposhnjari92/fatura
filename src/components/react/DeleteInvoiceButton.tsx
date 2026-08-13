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

interface Props {
  invoiceId: string;
  invoiceNumber: string;
}

export default function DeleteInvoiceButton({ invoiceId, invoiceNumber }: Props) {
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
      if (deleteError) throw deleteError;
      window.location.assign('/app/faturat');
    } catch (err) {
      setError((err as Error).message);
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
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
        </DialogContent>
      </Dialog>
    </>
  );
}
