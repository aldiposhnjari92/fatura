import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/**
 * Public waitlist capture from the landing page. Accepts a plain HTML form POST
 * (so the landing page ships zero JS) and also JSON, for anything scripted.
 */
export const POST: APIRoute = async ({ request, redirect }) => {
  const contentType = request.headers.get('content-type') ?? '';
  const wantsJson = contentType.includes('application/json');

  const fail = (message: string, status = 400) =>
    wantsJson
      ? new Response(JSON.stringify({ ok: false, error: message }), {
          status,
          headers: { 'content-type': 'application/json' },
        })
      : redirect('/faleminderit?gabim=1', 303);

  try {
    let businessName = '';
    let whatsapp = '';
    let city = '';
    let honeypot = '';

    if (wantsJson) {
      const body = await request.json();
      businessName = String(body.business_name ?? '');
      whatsapp = String(body.whatsapp ?? '');
      city = String(body.city ?? '');
      honeypot = String(body.company_website ?? '');
    } else {
      const form = await request.formData();
      businessName = String(form.get('business_name') ?? '');
      whatsapp = String(form.get('whatsapp') ?? '');
      city = String(form.get('city') ?? '');
      honeypot = String(form.get('company_website') ?? '');
    }

    // Honeypot tripped — pretend it worked, store nothing.
    if (honeypot.trim()) {
      return wantsJson
        ? new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : redirect('/faleminderit', 303);
    }

    businessName = businessName.trim().slice(0, 120);
    whatsapp = whatsapp.trim().slice(0, 30);
    city = city.trim().slice(0, 60) || 'Fier';

    if (!businessName || !whatsapp) {
      return fail('Emri i biznesit dhe numri i WhatsApp-it janë të detyrueshëm.');
    }

    // Loose on purpose: Albanian numbers get written a dozen different ways.
    if (!/^[+\d][\d\s()\-.]{5,}$/.test(whatsapp)) {
      return fail('Numri i WhatsApp-it nuk duket i vlefshëm.');
    }

    if (!url || !anonKey) {
      return fail('Konfigurim i munguar i serverit.', 500);
    }

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from('waitlist_fatura').insert({
      business_name: businessName,
      whatsapp,
      city,
    });

    if (error) {
      console.error('[waitlist] insert failed:', error.message);
      return fail('Nuk u ruajt. Provo sërish.', 500);
    }

    return wantsJson
      ? new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      : redirect('/faleminderit', 303);
  } catch (error) {
    console.error('[waitlist] unexpected error:', error);
    return fail('Gabim i papritur.', 500);
  }
};
