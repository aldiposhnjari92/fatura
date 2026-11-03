import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { dodoAmount, dodoConfig, dodoFetch, verifyDodoWebhook } from '@/lib/dodo';

export const prerender = false;

/*
  Dodo → us, signed. Only payment.succeeded changes anything: it confirms the
  payment row the checkout was opened for, which starts or extends the plan.

  Trust is layered, because this route is public:
    • the Standard Webhooks signature proves the request came from Dodo;
    • the payment is then read back from Dodo's API, so the status and amount
      acted on are Dodo's own, not whatever the body said;
    • its metadata must point at a pending card payment of the same owner, for
      the price that row was opened at.

  Dodo retries anything but a 2xx for about a day, so a delivery we cannot act
  on for good (unknown row, mismatch) is answered 200 and logged — retrying it
  would never succeed — while a failure on our side answers 500 to be retried.
  confirm_paid_payment() is idempotent, so a repeat delivery is harmless.
*/

interface DodoEvent {
  type?: string;
  data?: { payment_id?: string; payload_type?: string };
}

interface DodoPayment {
  payment_id: string;
  status: string | null;
  total_amount: number;
  tax: number | null;
  currency: string;
  metadata?: Record<string, unknown>;
}

const ok = () => new Response(null, { status: 204 });
const fail = (status: number) => new Response(null, { status });

export const POST: APIRoute = async ({ request }) => {
  const config = dodoConfig();
  if (!config) return fail(503);

  const raw = await request.text();
  if (!verifyDodoWebhook(config.webhookSecret, request.headers, raw)) return fail(401);

  let event: DodoEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return fail(400);
  }
  if (event.type !== 'payment.succeeded' || !event.data?.payment_id) return ok();

  let payment: DodoPayment;
  try {
    payment = await dodoFetch<DodoPayment>(config, `/payments/${encodeURIComponent(event.data.payment_id)}`);
  } catch {
    return fail(502);
  }
  if (payment.status !== 'succeeded') return ok();

  const paymentRowId = String(payment.metadata?.payment_id ?? '');
  const ownerId = String(payment.metadata?.owner_id ?? '');

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('[dodo] SUPABASE_SERVICE_ROLE_KEY is not set; payment left pending', payment.payment_id);
    return fail(503);
  }
  // The service role, never a session: confirm_paid_payment() is shut to everyone else.
  const admin = createClient(import.meta.env.PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row, error: readError } = await admin
    .from('payments')
    .select('id, owner_id, amount, status, method')
    .eq('id', paymentRowId)
    .maybeSingle();
  if (readError) return fail(500);

  if (
    !row ||
    row.owner_id !== ownerId ||
    row.method !== 'card' ||
    (row.status !== 'pending' && row.status !== 'confirmed')
  ) {
    console.error('[dodo] payment does not match a card payment row', { dodo: payment.payment_id, paymentRowId });
    return ok();
  }
  if (row.status === 'confirmed') return ok();

  /*
    In the product's own currency the charge must cover the row's price; the
    tax Dodo adds as Merchant of Record is on top of it. With adaptive pricing
    Dodo may charge in the buyer's currency instead, where no fixed figure can
    be compared — the session amount was set by this server either way.
  */
  if (payment.currency?.toUpperCase() === config.currency) {
    const net = Number(payment.total_amount) - (Number(payment.tax) || 0);
    if (net < dodoAmount(config, Number(row.amount))) {
      console.error('[dodo] amount below the payment price', { dodo: payment.payment_id, paymentRowId, net });
      return ok();
    }
  }

  const { error: confirmError } = await admin.rpc('confirm_paid_payment', {
    p_payment_id: row.id,
    p_provider_ref: payment.payment_id,
  });
  if (confirmError) {
    console.error('[dodo] confirm_paid_payment failed', confirmError.message);
    return fail(500);
  }
  return ok();
};
