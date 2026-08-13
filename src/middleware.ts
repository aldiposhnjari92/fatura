import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { Profile } from '@/lib/types';

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
  const csp = [
    "default-src 'self'",
    // Astro emits small inline hydration bootstrappers.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // blob: is the generated PDF preview; data: covers inlined logos.
    "img-src 'self' data: blob: https://*.supabase.co",
    `connect-src 'self' ${supabaseOrigin}`,
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
  const { cookies, request, url, locals, redirect } = context;

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

  const supabase = createSupabaseServerClient(cookies, request.headers);
  locals.supabase = supabase;
  locals.user = null;
  locals.profile = null;
  locals.invoicesThisMonth = 0;

  // getUser() revalidates the JWT against Supabase — never trust getSession()
  // alone for an authorization decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  locals.user = user ?? null;

  if (isProtected && !user) {
    const returnTo = encodeURIComponent(url.pathname + url.search);
    return withHeaders(redirect(`/login?next=${returnTo}`, 302));
  }

  if (isAuthRoute && user) {
    return withHeaders(redirect('/app', 302));
  }

  if (user) {
    // One RPC for the profile *and* the month's invoice count. Previously this
    // was two queries here plus a third in AppLayout, on every single request.
    const { data: bootstrap } = await supabase.rpc('app_bootstrap');

    locals.profile = (bootstrap?.profile as Profile) ?? null;
    locals.invoicesThisMonth = Number(bootstrap?.invoices_this_month ?? 0);

    // The admin panel is gated here as well as in the database. The RPCs it
    // calls each re-check is_admin(), so this is defence in depth, not the
    // only check — a UI-only guard is exactly the mistake the invoice quota
    // taught us not to repeat.
    if (
      (isAdminArea || url.pathname.startsWith('/app/admin')) &&
      !locals.profile?.is_admin
    ) {
      return withHeaders(redirect('/app', 302));
    }

    /*
      An admin's home is the console, so /app sends them there. `?klient=1` is
      the deliberate escape hatch: admins usually also run a business of their
      own, and without it their invoices would be unreachable — and the console's
      "back to the app" link would bounce straight back here in a loop.
      Only the /app *root* redirects; /app/faturat and friends stay reachable.
    */
    if (
      locals.profile?.is_admin &&
      url.pathname === '/app' &&
      !url.searchParams.has('klient')
    ) {
      return withHeaders(redirect('/admin', 302));
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
