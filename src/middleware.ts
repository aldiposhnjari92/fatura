import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { Profile } from '@/lib/types';
import { invoiceLimitOf, isPaidPlanId, isPlanId, type PlanId } from '@/lib/plans';

const PROTECTED_PREFIX = '/app';
const ADMIN_PREFIX = '/admin';
const AUTH_ROUTES = ['/login', '/regjistrohu'];

/**
 * Sent on every response. The CSP is deliberately strict about where scripts
 * and connections may go: Supabase for data, self for everything else.
 * `'unsafe-inline'` on style-src is required by Astro's inlined critical CSS
 * and by the inline `style` attributes the hero/gradients use.
 */
function securityHeaders(supabaseOrigin: string): Record<string, string> {
  /*
    Realtime opens a WebSocket to the same host over wss://. Browsers do not
    accept a wss: connection against an https: source expression, so the scheme
    must be listed explicitly — without it the CSP silently blocks the
    subscription and the activity feed never goes live.
  */
  const supabaseSocket = supabaseOrigin.replace(/^https:/, 'wss:');

  const csp = [
    "default-src 'self'",
    // Astro emits small inline hydration bootstrappers.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // blob: is the generated PDF preview; data: covers inlined logos.
    "img-src 'self' data: blob: https://*.supabase.co",
    `connect-src 'self' ${supabaseOrigin} ${supabaseSocket}`.trim(),
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  };
}

export const onRequest = defineMiddleware(async (context, next) => {
  /*
    `request` is deliberately not destructured. On a prerendered route
    `context.request` is a getter that warns the moment it is touched, and
    destructuring touches it for every page — including the static marketing
    ones that never look at a header. Reached lazily below instead, only on
    paths that genuinely render per request.
  */
  const { cookies, url, locals, redirect } = context;

  const isAdminArea = url.pathname.startsWith(ADMIN_PREFIX);
  const isProtected = url.pathname.startsWith(PROTECTED_PREFIX) || isAdminArea;
  const isAuthRoute = AUTH_ROUTES.includes(url.pathname);

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';

  const withHeaders = (response: Response) => {
    for (const [key, value] of Object.entries(securityHeaders(supabaseOrigin))) {
      response.headers.set(key, value);
    }
    return response;
  };

  // Static marketing pages must stay free of a Supabase round-trip. Bail out
  // before touching request.headers, which does not exist while prerendering.
  if (!isProtected && !isAuthRoute) {
    return withHeaders(await next());
  }

  const supabase = createSupabaseServerClient(cookies, context.request.headers);
  locals.supabase = supabase;
  locals.user = null;
  locals.profile = null;
  locals.invoicesThisMonth = 0;
  locals.plan = 'free';
  locals.invoiceLimit = invoiceLimitOf('free');

  /*
    Never trust getSession() alone for an authorization decision — but
    getUser() is not the only safe option, and it costs a network round-trip to
    the auth server on *every* request (measured: ~90ms, on top of the ~100ms
    the bootstrap RPC already costs).

    getClaims() verifies the access token's signature and expiry locally
    against the project's published JWKS, which is fetched once and then cached
    in the process — measured at ~1ms warm. That is a real cryptographic
    verification, not a decode: a forged or tampered token fails it.

    What it cannot see is revocation between issue and expiry. That is covered
    anyway, because every subsequent query runs under the same token: PostgREST
    validates it independently and RLS scopes the rows, so a deleted or banned
    user gets nothing back and `profile` comes out null below.

    The getUser() fallback is what refreshes an expired access token and
    rewrites the cookies, so a returning visitor is not silently signed out. It
    is also cheap when there is no session at all — supabase-js answers from
    storage without going to the network.
  */
  let user: App.Locals['user'] = null;

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claims?.sub) {
    user = { id: claims.sub, email: (claims.email as string) ?? null };
  } else {
    const {
      data: { user: refreshed },
    } = await supabase.auth.getUser();
    user = refreshed ? { id: refreshed.id, email: refreshed.email ?? null } : null;
  }

  locals.user = user;

  if (isProtected && !user) {
    const returnTo = encodeURIComponent(url.pathname + url.search);
    return withHeaders(redirect(`/login?next=${returnTo}`, 302));
  }

  if (isAuthRoute && user) {
    /*
      Someone already signed in has no use for /login or /regjistrohu — but do
      not throw away why they came. The pricing cards link to
      /regjistrohu?plan=starter|pro&muaj=N, so an existing customer clicking
      "upgrade" was being dumped on the dashboard with their choice discarded.
      Carry the intent to the checkout instead.

      This is the catch-all: it also covers bookmarks, cached marketing pages
      and the back button, not just the links we control.
    */
    const wantedPlan = url.searchParams.get('plan');
    if (isPaidPlanId(wantedPlan)) {
      const requested = Number.parseInt(url.searchParams.get('muaj') ?? '', 10);
      const months = [1, 6, 12].includes(requested) ? requested : 1;
      return withHeaders(
        redirect(`/app/abonimi?plan=${wantedPlan}&muaj=${months}`, 302)
      );
    }

    const rawNext = url.searchParams.get('next') ?? '';
    const safeNext =
      rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/app';
    return withHeaders(redirect(safeNext, 302));
  }

  if (user) {
    // One RPC for the profile *and* the month's invoice count. Previously this
    // was two queries here plus a third in AppLayout, on every single request.
    const { data: bootstrap } = await supabase.rpc('app_bootstrap');

    locals.profile = (bootstrap?.profile as Profile) ?? null;
    locals.invoicesThisMonth = Number(bootstrap?.invoices_this_month ?? 0);

    /*
      The tier comes from active_plan() rather than profiles.plan, so an expired
      subscription reads as free here exactly as it does in the quota trigger.
      `invoice_limit` is null on Pro — unlimited — which is why it is carried
      through as null instead of being flattened to a number.
    */
    const activePlan: PlanId = isPlanId(bootstrap?.plan) ? bootstrap.plan : 'free';
    locals.plan = activePlan;
    locals.invoiceLimit =
      bootstrap?.invoice_limit === null || bootstrap?.invoice_limit === undefined
        ? invoiceLimitOf(activePlan)
        : Number(bootstrap.invoice_limit);

    // The admin panel is gated here as well as in the database. The RPCs it
    // calls each re-check is_admin(), so this is defence in depth, not the
    // only check — a UI-only guard is exactly the mistake the invoice quota
    // taught us not to repeat.
    /*
      Console access has two tiers now. A manager may enter, but only reaches
      the invoice-activity page; every other console route is admin-only. The
      RPCs behind each page re-check the caller's role in the database, so this
      is defence in depth rather than the only gate.
    */
    const isAdmin = Boolean(locals.profile?.is_admin);
    const isManager = Boolean(locals.profile?.is_manager) || isAdmin;
    const MANAGER_ROUTES = ['/admin/faturat', '/admin/aktiviteti'];

    if (isAdminArea || url.pathname.startsWith('/app/admin')) {
      if (!isManager) {
        return withHeaders(redirect('/app', 302));
      }
      if (!isAdmin && !MANAGER_ROUTES.includes(url.pathname)) {
        return withHeaders(redirect('/admin/faturat', 302));
      }
    }

    /*
      An admin's home is the console, so /app sends them there. `?klient=1` is
      the deliberate escape hatch: admins usually also run a business of their
      own, and without it their invoices would be unreachable — and the console's
      "back to the app" link would bounce straight back here in a loop.
      Only the /app *root* redirects; /app/faturat and friends stay reachable.
    */
    if (
      (locals.profile?.is_admin || locals.profile?.is_manager) &&
      url.pathname === '/app' &&
      !url.searchParams.has('klient')
    ) {
      return withHeaders(
        redirect(locals.profile?.is_admin ? '/admin' : '/admin/faturat', 302)
      );
    }

    // A brand-new user must finish onboarding before anything else works.
    const needsOnboarding = !locals.profile?.business_name;
    const onboardingPath = '/app/cilesimet';
    if (
      !isAdminArea &&
      !locals.profile?.is_admin &&
      isProtected &&
      needsOnboarding &&
      url.pathname !== onboardingPath
    ) {
      return withHeaders(redirect(`${onboardingPath}?welcome=1`, 302));
    }
  }

  return withHeaders(await next());
});
