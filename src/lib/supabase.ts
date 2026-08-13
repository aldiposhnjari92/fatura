import { createBrowserClient } from '@supabase/ssr';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surfaces immediately in the browser console instead of a cryptic 400 later.
  console.error(
    '[Fatura.co] Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.'
  );
}

/**
 * Browser-side Supabase client. Writes the auth session into cookies (not
 * localStorage) so Astro's SSR middleware can read the same session.
 */
export const supabase = createBrowserClient(url ?? '', anonKey ?? '', {
  cookieOptions: {
    name: 'sb-fatura',
    path: '/',
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    maxAge: 60 * 60 * 24 * 365,
  },
});
