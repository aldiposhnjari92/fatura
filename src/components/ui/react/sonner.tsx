import * as React from 'react';
import { Toaster as Sonner } from 'sonner';
import { CircleAlert, CircleCheck, Info, Loader2, TriangleAlert } from 'lucide-react';
import { consumeFlashToast } from '@/lib/toast';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/*
  Action feedback, top right.

  Every write the user makes — an invoice created, a PDF shared, a client
  deleted — answers here, in the same place, and every toast says the same three
  things: what happened (the title), what it means (the description), and how to
  dismiss it. The outcome is carried by the border and the icon, both in the
  status colour, so the four kinds are told apart before the text is read.

  `unstyled` is load-bearing, not a preference. Tailwind v4 emits utilities
  inside `@layer utilities`; sonner injects its stylesheet unlayered, and an
  unlayered declaration beats a layered one whatever the specificity — so the
  default skin silently won every conflict and the toasts came out grey. Turning
  it off drops exactly one rule, the `[data-styled="true"]` block holding
  padding/background/border/radius, and leaves sonner's positioning, icon slot
  and close button intact. Those last two still read sonner's own variables,
  which is why the palette is handed over as `--normal-*` below rather than as
  classes that would lose the same fight.

  The app is a multi-page one, so an action that navigates — saving a new
  invoice, deleting the one on screen — cannot toast and then leave: the
  document that owns the toast is torn down. Those hand the message to
  `flashToast` instead, and this picks it up on the far side.
*/
function Toaster(props: ToasterProps) {
  React.useEffect(() => {
    consumeFlashToast();
  }, []);

  return (
    <Sonner
      position="top-right"
      offset={16}
      gap={10}
      visibleToasts={4}
      duration={5000}
      closeButton
      className="toaster group"
      style={
        {
          // Sonner hangs the close button off the top-left corner by default.
          '--toast-close-button-start': 'unset',
          '--toast-close-button-end': '0',
          '--toast-close-button-transform': 'translate(-35%, 35%)',
          // Read by the close button, which sonner still styles itself.
          '--normal-bg': 'var(--popover)',
          '--normal-border': 'var(--border)',
          '--normal-text': 'var(--muted-foreground)',
          '--gray2': 'var(--muted)',
          '--gray5': 'var(--border)',
        } as React.CSSProperties
      }
      icons={{
        success: <CircleCheck className="text-success size-4.5" aria-hidden="true" />,
        error: <CircleAlert className="text-destructive size-4.5" aria-hidden="true" />,
        warning: <TriangleAlert className="text-warning size-4.5" aria-hidden="true" />,
        info: <Info className="text-primary size-4.5" aria-hidden="true" />,
        loading: (
          <Loader2 className="text-muted-foreground size-4.5 animate-spin" aria-hidden="true" />
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          // The whole skin, since `unstyled` removed sonner's. `pr-9` is the
          // room the close button sits in.
          toast:
            'group toast bg-popover text-foreground border-border flex w-full items-start gap-2.5 rounded-xl border p-4 pr-9 text-sm shadow-lg',
          icon: 'mt-0.5 mr-0 shrink-0',
          content: 'flex flex-col gap-1',
          title: 'text-sm font-semibold leading-snug',
          description: 'text-muted-foreground text-xs leading-relaxed',
          actionButton:
            'bg-primary text-primary-foreground rounded-md px-2 text-xs font-medium',
          cancelButton:
            'bg-muted text-muted-foreground rounded-md px-2 text-xs font-medium',
          /*
            The border is the status. Marked important because sonner applies
            `default` alongside the type class, so this and the neutral
            `border-border` above are two utilities of equal weight in the same
            layer — without it the winner is whichever Tailwind happened to emit
            last.
          */
          success: 'border-success/50!',
          error: 'border-destructive/50!',
          warning: 'border-warning/50!',
          info: 'border-primary/50!',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
export default Toaster;
