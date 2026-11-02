import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import { PLANS } from '@/lib/plans';
import type { CancelSubscriptionDialogProps } from '@/models/billing';

/** Cancelling only stops the renewal — the dialog says so before anyone commits to it. */
export default function CancelSubscriptionDialog({
  open,
  onOpenChange,
  planName,
  endsOn,
  busy,
  onConfirm,
}: CancelSubscriptionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anulo abonimin {planName}?</DialogTitle>
        </DialogHeader>

        <div className="border-primary/25 bg-accent/40 rounded-xl border px-4 py-3">
          <p className="text-sm font-medium">Nuk humbet asgjë tani</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {planName} mbetet aktiv me të gjitha veçoritë deri më{' '}
            <strong className="text-foreground">{endsOn}</strong> — koha që ke paguar
            nuk shkurtohet. Pas asaj date kthehesh te plani falas (
            {PLANS.free.invoiceLimit} fatura në muaj) dhe faturat ekzistuese mbeten të
            paprekura.
          </p>
        </div>

        <p className="text-muted-foreground text-sm">
          Mund ta rikthesh në çdo moment para asaj date.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Mbaje {planName}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Anulo abonimin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
