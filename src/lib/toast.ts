import { toast } from 'sonner';

/*
  One entry point for action feedback.

  Components call `notify.success(title, description)` rather than sonner
  directly, so the four statuses stay a closed set and the wording is the only
  thing a call site decides. Both halves are required: the title is what
  happened, the description is what it means for the user — a toast that only
  restates the button they just pressed is not worth the interruption.

  `flashToast` exists because this is a multi-page app: a handler that saves and
  then navigates would otherwise raise a toast in a document that is about to be
  discarded. It parks the message in sessionStorage — not localStorage, which
  would leak the message into every other tab — and the Toaster on the next page
  consumes it on mount.
*/

export type ToastStatus = 'success' | 'error' | 'warning' | 'info';

const FLASH_KEY = 'fatura:flash-toast';

export const notify = {
  success: (title: string, description: string) => toast.success(title, { description }),
  error: (title: string, description: string) => toast.error(title, { description }),
  warning: (title: string, description: string) => toast.warning(title, { description }),
  info: (title: string, description: string) => toast.info(title, { description }),
};

/** Show this on the page we are about to navigate to, not on this one. */
export function flashToast(status: ToastStatus, title: string, description: string) {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ status, title, description }));
  } catch {
    // Private browsing, or storage full. A missing confirmation is not worth
    // failing the navigation it was attached to.
  }
}

/** Drain whatever the previous page left behind. Called once, by the Toaster. */
export function consumeFlashToast() {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(FLASH_KEY);
    if (raw) sessionStorage.removeItem(FLASH_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  try {
    const { status, title, description } = JSON.parse(raw) as {
      status: ToastStatus;
      title: string;
      description: string;
    };
    if (title && status in notify) notify[status](title, description ?? '');
  } catch {
    // Malformed entry — it has already been cleared, so nothing to do.
  }
}

export { toast };
