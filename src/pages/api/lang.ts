import type { APIRoute } from 'astro';
import { LANG_COOKIE, isSelectableLang } from '@/lib/i18n';

export const prerender = false;

/**
 * Persist the interface language and return the visitor to where they were.
 *
 * A plain form POST rather than a fetch, so the switcher keeps working without
 * JavaScript. The redirect target is taken from the request but validated: only
 * same-site paths are allowed, so this cannot be used as an open redirect.
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const requested = String(form.get('lang') ?? '');
  const rawNext = String(form.get('next') ?? '/');

  if (isSelectableLang(requested)) {
    cookies.set(LANG_COOKIE, requested, {
      path: '/',
      httpOnly: false, // read by the marketing pages' inline script too
      sameSite: 'lax',
      secure: import.meta.env.PROD,
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // `//evil.com` is a valid pathname to the parser but a cross-origin redirect
  // to the browser — reject anything that is not a single-slash local path.
  const safeNext = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  return redirect(safeNext, 303);
};
