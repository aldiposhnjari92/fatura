import { createHmac, timingSafeEqual } from 'node:crypto';

/*
  Dodo Payments — card, Apple Pay and Google Pay for the subscription, server
  side only. Dodo is the Merchant of Record: it sells the plan to the customer,
  adds any sales tax on top, and pays the business out.

  How a payment goes:
    1. /api/payments/dodo opens our payment row (create_payment(), which owns
       the price) and a Dodo checkout session for exactly that amount, using
       one "pay what you want" product so prices live only in this app.
    2. The customer pays on Dodo's hosted page and comes back to Abonimi.
    3. Dodo sends payment.succeeded to /api/payments/dodo-webhook. That,
       never the browser coming back, is what activates the plan.

  Every setting is read by its literal name — the build only replaces
  `import.meta.env.FOO` it can see — with process.env first, for values
  changed in the hosting dashboard without a rebuild. Nothing runs until the
  API key, webhook secret and product id are all set.
*/

export interface DodoConfig {
  apiKey: string;
  webhookSecret: string;
  productId: string;
  baseUrl: string;
  /** The currency the Dodo product is priced in. */
  currency: string;
  /** How many Lek make one unit of `currency` — the plans are priced in Lek. */
  allPerUnit: number;
}

export function dodoConfig(): DodoConfig | null {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY ?? import.meta.env.DODO_PAYMENTS_API_KEY;
  const webhookSecret = process.env.DODO_WEBHOOK_SECRET ?? import.meta.env.DODO_WEBHOOK_SECRET;
  const productId = process.env.DODO_PRODUCT_ID ?? import.meta.env.DODO_PRODUCT_ID;
  if (!apiKey || !webhookSecret || !productId) return null;

  const live = (process.env.DODO_ENV ?? import.meta.env.DODO_ENV) === 'live';
  return {
    apiKey,
    webhookSecret,
    productId,
    baseUrl: live ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com',
    currency: String(process.env.DODO_CURRENCY ?? import.meta.env.DODO_CURRENCY ?? 'EUR').toUpperCase(),
    allPerUnit: Number(process.env.DODO_ALL_PER_UNIT ?? import.meta.env.DODO_ALL_PER_UNIT ?? 100),
  };
}

/** The checkout amount for a payment of `amountALL` Lek, in the currency's smallest unit (cents). */
export function dodoAmount(config: DodoConfig, amountALL: number): number {
  return Math.round((amountALL / config.allPerUnit) * 100);
}

export async function dodoFetch<T>(config: DodoConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    // Logged, not returned: Dodo's error bodies can name account details.
    console.error(`[dodo] ${init.method ?? 'GET'} ${path} failed:`, response.status, await response.text());
    throw new Error('DODO_REQUEST_FAILED');
  }
  return (await response.json()) as T;
}

/** How old a webhook may be before it is refused as a replay — the Standard Webhooks default. */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Standard Webhooks verification, which Dodo follows: an HMAC-SHA256 over
 * "id.timestamp.body", keyed with the base64 part of the `whsec_` secret, and
 * compared in constant time against every "v1,…" signature in the header.
 * `body` must be the raw request text — re-serialised JSON would not match.
 */
export function verifyDodoWebhook(secret: string, headers: Headers, body: string): boolean {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatures = headers.get('webhook-signature');
  if (!id || !timestamp || !signatures) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();

  return signatures.split(' ').some((entry) => {
    const [version, signature] = entry.split(',');
    if (version !== 'v1' || !signature) return false;
    const given = Buffer.from(signature, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
