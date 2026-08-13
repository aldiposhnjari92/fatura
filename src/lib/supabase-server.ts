import {
  createServerClient,
  type CookieOptionsWithName,
  type CookieMethodsServer,
} from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const COOKIE_OPTIONS: CookieOptionsWithName = {
  name: 'sb-fatura',
  path: '/',
  sameSite: 'lax',
  secure: import.meta.env.PROD,
  maxAge: 60 * 60 * 24 * 365,
};

/**
 * Server-side Supabase client bound to the current request's cookies, so every
 * query runs as the signed-in user and RLS does the authorisation for us.
 */
export function createSupabaseServerClient(cookies: AstroCookies, headers: Headers) {
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return parseCookieHeader(headers.get('cookie') ?? '');
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookies.set(name, value, { ...COOKIE_OPTIONS, ...options });
      });
    },
  };

  return createServerClient(url ?? '', anonKey ?? '', {
    cookieOptions: COOKIE_OPTIONS,
    cookies: cookieMethods,
  });
}

function parseCookieHeader(header: string): { name: string; value: string }[] {
  if (!header) return [];
  return header
    .split(';')
    .map((pair) => {
      const index = pair.indexOf('=');
      if (index === -1) return { name: pair.trim(), value: '' };
      return {
        name: pair.slice(0, index).trim(),
        value: decodeURIComponent(pair.slice(index + 1).trim()),
      };
    })
    .filter((c) => c.name.length > 0);
}
