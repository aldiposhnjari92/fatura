import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isPaidPlanId } from '@/lib/plans';
import { isTermMonths } from '@/lib/payments';
import { dodoAmount, dodoConfig, dodoFetch } from '@/lib/dodo';

export const prerender = false;

/*
  POST { months, plan } -> { url }: opens a payment row and a Dodo checkout
  session for it, and hands back the hosted checkout page to send the
  customer to.

  As with PayPal, the amount comes from create_payment() — plan_monthly_price()
  × months, in SQL — and never from the request body. Nothing here activates
  a plan; the signed webhook does (see dodo-webhook.ts).
*/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface CheckoutSession {
  session_id: string;
  checkout_url: string | null;
}

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const config = dodoConfig();
  if (!config) {
    return json({ error: 'DODO_NOT_CONFIGURED', message: 'Pagesa me kartë nuk është konfiguruar.' }, 503);
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return json({ error: 'NOT_AUTHENTICATED' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'BAD_REQUEST' }, 400);
  }

  // Only the terms and tiers actually on sale, as in paypal.ts.
  const months = isTermMonths(body.months) ? Number(body.months) : 1;
  const plan = isPaidPlanId(body.plan) ? body.plan : 'pro';

  const { data: payment, error: rpcError } = await supabase.rpc('create_payment', {
    p_method: 'card',
    p_months: months,
    p_plan: plan,
  });
  if (rpcError) return json({ error: rpcError.message }, 400);
  const row = payment as { id: string; reference: string; amount: number };

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name')
    .eq('id', user.id)
    .maybeSingle();

  try {
    const session = await dodoFetch<CheckoutSession>(config, '/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        product_cart: [{ product_id: config.productId, quantity: 1, amount: dodoAmount(config, row.amount) }],
        customer: { email: user.email, name: profile?.business_name?.trim() || user.email },
        // Card first, then the wallets Dodo offers on top of it.
        allowed_payment_method_types: ['credit', 'debit', 'apple_pay', 'google_pay'],
        return_url: `${url.origin}/app/abonimi?pagesa=kthim`,
        // The webhook finds our row by these — and checks them against the row.
        metadata: { payment_id: row.id, reference: row.reference, owner_id: user.id },
      }),
    });
    if (!session.checkout_url) throw new Error('DODO_NO_CHECKOUT_URL');
    return json({ url: session.checkout_url, reference: row.reference });
  } catch {
    return json({ error: 'DODO_CREATE_FAILED', message: 'Pagesa nuk u hap. Provo sërish pas pak.' }, 502);
  }
};
