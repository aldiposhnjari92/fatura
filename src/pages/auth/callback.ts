import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { safeNextPath } from '@/lib/utils';

export const prerender = false;

/**
 * Landing point for the email-confirmation link. Exchanges the one-time code
 * for a session and writes the auth cookies before redirecting into the app.
 */
export const GET: APIRoute = async ({ url, cookies, request, redirect }) => {
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'));

  if (!code) {
    return redirect('/login?gabim=lidhja', 303);
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] exchange failed:', error.message);
    return redirect('/login?gabim=lidhja', 303);
  }

  return redirect(next, 303);
};
