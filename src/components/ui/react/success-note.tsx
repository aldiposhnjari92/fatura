import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/*
  The beat between a destructive action and its consequence.

  Deleting used to jump straight to the outcome — the row vanished, or the page
  navigated — which leaves the user to work out from the result whether the
  thing they asked for actually happened. This holds the dialog open for a
  moment on a plain confirmation instead, so the answer arrives before the
  screen changes underneath them.

  The message is passed in rather than rendered from a prop so a dialog can hand
  over its own <DialogTitle>: Radix needs a titled dialog, and the confirmation
  *is* the title once the question has been answered. `role="status"` announces
  it to a screen reader without stealing focus.
*/

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function SuccessNote({ children, className }: Props) {
  return (
    <div
      role="status"
      className={cn('flex flex-col items-center gap-3 py-4 text-center', className)}
    >
      <span className="bg-success/15 text-success animate-pop flex size-14 shrink-0 items-center justify-center rounded-full">
        <Check className="animate-check size-7" strokeWidth={2.5} aria-hidden="true" />
      </span>
      {children}
    </div>
  );
}
