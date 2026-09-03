/**
 * Loader for the PayPal JS SDK.
 *
 * The checkout used to render an empty `<div id="paypal-buttons">` and stop
 * there — the SDK was never fetched and nothing was ever mounted into it, so
 * even a fully credentialled merchant account produced a panel with no way to
 * pay. This is the missing half.
 *
 * The script is a singleton: PayPal keys its runtime off the query string it
 * was loaded with, so a second <script> with different params does not
 * reconfigure the first — it fights with it. One promise, cached, and every
 * caller waits on the same load.
 */

export interface PayPalSdkOptions {
  clientId: string;
  /** Must match the `currency_code` the server puts on the order. */
  currency: string;
  /** Ask for the hosted card fields as well as the buttons. */
  cardFields: boolean;
}

/* The SDK's own surface is far wider than this; typed to what is actually called. */
export interface PayPalNamespace {
  Buttons?: (options: Record<string, unknown>) => {
    render: (target: HTMLElement) => Promise<void>;
    close: () => void;
    isEligible?: () => boolean;
  };
  CardFields?: (options: Record<string, unknown>) => PayPalCardFields;
}

export interface PayPalCardFields {
  isEligible: () => boolean;
  submit: () => Promise<void>;
  NameField: (options?: Record<string, unknown>) => PayPalCardField;
  NumberField: (options?: Record<string, unknown>) => PayPalCardField;
  ExpiryField: (options?: Record<string, unknown>) => PayPalCardField;
  CVVField: (options?: Record<string, unknown>) => PayPalCardField;
}

export interface PayPalCardField {
  render: (target: HTMLElement | string) => Promise<void>;
  close?: () => Promise<void>;
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

let pending: Promise<PayPalNamespace> | null = null;
let loadedKey: string | null = null;

function sdkUrl({ clientId, currency, cardFields }: PayPalSdkOptions): string {
  const params = new URLSearchParams({
    'client-id': clientId,
    currency,
    intent: 'capture',
    components: cardFields ? 'buttons,card-fields' : 'buttons',
    // Nothing here sells subscriptions through PayPal's own billing plans, and
    // the funding sources we cannot settle only add dead buttons to the sheet.
    'disable-funding': 'credit,paylater',
  });
  return `https://www.paypal.com/sdk/js?${params.toString()}`;
}

/**
 * Resolves with `window.paypal`. Rejects if the script fails to load — which
 * on this integration usually means a wrong client id or a blocked network,
 * both of which the caller surfaces rather than retrying.
 */
export function loadPayPalSdk(options: PayPalSdkOptions): Promise<PayPalNamespace> {
  const key = sdkUrl(options);

  // A second call asking for different params would silently get the first
  // load's configuration; say so rather than paying in the wrong currency.
  if (pending && loadedKey !== key) {
    return Promise.reject(
      new Error('PayPal SDK already loaded with different options on this page.')
    );
  }
  if (pending) return pending;

  loadedKey = key;
  pending = new Promise<PayPalNamespace>((resolve, reject) => {
    if (window.paypal) {
      resolve(window.paypal);
      return;
    }

    const script = document.createElement('script');
    script.src = key;
    script.async = true;
    script.onload = () => {
      if (window.paypal) resolve(window.paypal);
      else reject(new Error('PayPal SDK loaded but exposed no global.'));
    };
    script.onerror = () => {
      // Let a later attempt retry from scratch instead of caching the failure.
      pending = null;
      loadedKey = null;
      script.remove();
      reject(new Error('PayPal SDK could not be loaded.'));
    };
    document.head.appendChild(script);
  });

  return pending;
}
