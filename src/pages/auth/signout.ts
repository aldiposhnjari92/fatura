import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const prerender = false;

const signOut: APIRoute = async ({ cookies, request, redirect }) => {
  const supabase = createSupabaseServerClient(cookies, request.headers);
  await supabase.auth.signOut();

  // Belt and braces: drop any chunked auth cookie the helper left behind.
  for (const name of ['sb-fatura', 'sb-fatura.0', 'sb-fatura.1', 'sb-fatura-code-verifier']) {
    cookies.delete(name, { path: '/' });
  }

  return redirect('/', 303);
};

export const POST = signOut;
export const GET = signOut;
