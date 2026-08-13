import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { PRO_MONTHLY_ALL } from '@/lib/payments';

export const prerender = false;

/*
  PayPal Orders API. Two actions on one route:

    POST { action: 'create', months }        -> creates a PayPal order
    POST { action: 'capture', orderId, ... } -> captures it and marks the payment

  The amount is derived from `months` on the server and never read from the
  request body, so a tampered client cannot buy a year for 1 Lek. Nothing here
  runs unless PAYPAL_CLIENT_ID/PAYPAL_SECRET are configured — Albania is not a
  supported Stripe country and PayPal receiving is account-dependent, so this
  stays dormant until a working merchant account exists.
*/

const PAYPAL_API = import.meta.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function accessToken(): Promise<string | null> {
  const id = import.meta.env.PUBLIC_PAYPAL_CLIENT_ID;
  const secret = import.meta.env.PAYPAL_SECRET;
  if (!id || !secret) return null;

  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.access_token ?? null;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!import.meta.env.PUBLIC_PAYPAL_CLIENT_ID || !import.meta.env.PAYPAL_SECRET) {
    return json(
      { error: 'PAYPAL_NOT_CONFIGURED', message: 'PayPal nuk është konfiguruar.' },
      503
    );
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'NOT_AUTHENTICATED' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'BAD_REQUEST' }, 400);
  }

  const token = await accessToken();
  if (!token) return json({ error: 'PAYPAL_AUTH_FAILED' }, 502);

  // ---------- create ----------
  if (body.action === 'create') {
    const months = Math.min(Math.max(Number(body.months) || 1, 1), 24);

    // Open the payment row first: it computes and owns the amount.
    const { data: payment, error: rpcError } = await supabase.rpc('create_payment', {
      p_method: 'paypal',
      p_months: months,
    });
    if (rpcError) return json({ error: rpcError.message }, 400);

    const amount = Number((payment as Record<string, unknown>).amount);
    const reference = String((payment as Record<string, unknown>).reference);

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: reference,
            description: `Fatura.co Pro — ${months} muaj`,
            custom_id: String((payment as Record<string, unknown>).id),
            amount: {
              // PayPal has no ALL support for card processing in most accounts,
              // so the merchant account's settlement currency is used and the
              // Lek figure is kept as the source of truth in our own records.
              currency_code: import.meta.env.PAYPAL_CURRENCY ?? 'EUR',
              value: (amount / Number(import.meta.env.PAYPAL_ALL_PER_UNIT ?? 100)).toFixed(2),
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      return json({ error: 'PAYPAL_CREATE_FAILED', detail: await response.text() }, 502);
    }
    const order = await response.json();
    return json({ id: order.id, reference, amount, months });
  }

  // ---------- capture ----------
  if (body.action === 'capture') {
    const orderId = String(body.orderId ?? '');
    if (!orderId) return json({ error: 'MISSING_ORDER' }, 400);

    const response = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      }
    );
    const result = await response.json();

    if (!response.ok || result.status !== 'COMPLETED') {
      return json({ error: 'PAYPAL_CAPTURE_FAILED', detail: result }, 502);
    }

    // The payment id travelled in custom_id, so we credit exactly the row this
    // order was created for rather than trusting anything the client sends.
    const paymentId = result?.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id
      ?? result?.purchase_units?.[0]?.custom_id;

    if (!paymentId) return json({ error: 'PAYMENT_LINK_MISSING' }, 502);

    // Confirmation runs with the SERVICE ROLE, never the caller's session —
    // otherwise a user could invoke confirm_paid_payment on their own pending
    // row and grant themselves Pro without paying. The key is server-only.
    const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return json({ error: 'SERVICE_ROLE_NOT_CONFIGURED' }, 503);

    const admin = createClient(import.meta.env.PUBLIC_SUPABASE_URL, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: decideError } = await admin.rpc('confirm_paid_payment', {
      p_payment_id: paymentId,
      p_provider_ref: orderId,
    });
    if (decideError) return json({ error: decideError.message }, 400);

    return json({ ok: true, orderId });
  }

  return json({ error: 'UNKNOWN_ACTION' }, 400);
};

export const GET: APIRoute = () =>
  json({
    configured: Boolean(
      import.meta.env.PUBLIC_PAYPAL_CLIENT_ID && import.meta.env.PAYPAL_SECRET
    ),
    monthlyALL: PRO_MONTHLY_ALL,
  });
