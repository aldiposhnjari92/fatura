import type { APIRoute } from 'astro';
import { applyInvoiceSearch, matchingClientIds, normalizeQuery } from '@/lib/search';
import { displayStatus } from '@/lib/types';
import type { Client, InvoiceWithClient } from '@/lib/types';
import { formatALL, formatDate } from '@/lib/utils';

export const prerender = false;

/*
  Instant-search backend for the shell's field.

  It lives under /app rather than /api on purpose: the middleware only builds a
  Supabase client for the protected prefixes, so an endpoint at /api would have
  no session and no RLS context. Here it is authenticated by exactly the same
  gate as every other app route, and reads through the caller's own client — a
  request for someone else's invoice returns nothing because the policy says so,
  not because this file remembered to filter.

  Rows come back pre-formatted. The dropdown is a list of labels, and rendering
  money and dates on the server keeps a second copy of that formatting (and the
  sq-AL Intl data behind it) out of the client bundle.
*/

/** Per category. The dropdown shows a handful and links to the full page. */
const LIMIT = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // Per-user data behind a session cookie: never store it anywhere shared.
      'cache-control': 'private, no-store',
    },
  });

export const GET: APIRoute = async ({ url, locals }) => {
  const { supabase, user } = locals;

  // The middleware redirects unauthenticated traffic, so this is belt-and-braces
  // for the case where an endpoint is reached before that gate is in force.
  if (!supabase || !user) return json({ error: 'unauthorized' }, 401);

  const q = normalizeQuery(url.searchParams.get('q'));
  if (!q) return json({ q: '', invoices: [], clients: [], invoiceCount: 0, clientCount: 0 });

  const clientIds = await matchingClientIds(supabase, user.id, q);

  const [invoiceResult, clientResult] = await Promise.all([
    applyInvoiceSearch(
      supabase
        .from('invoices')
        .select('id, invoice_number, issue_date, due_date, total, status, clients(name)', {
          count: 'exact',
        })
        .eq('owner_id', user.id)
        .order('issue_date', { ascending: false })
        .limit(LIMIT),
      q,
      clientIds
    ),
    supabase
      .from('clients')
      .select('id, name, email, nipt', { count: 'exact' })
      .eq('owner_id', user.id)
      // `.in()` with an empty list is a syntax error in PostgREST, so a term
      // that matched no client skips the query rather than sending `in.()`.
      .in('id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])
      .order('name')
      .limit(LIMIT),
  ]);

  const invoices = (invoiceResult.data ?? []) as unknown as InvoiceWithClient[];
  const clients = (clientResult.data ?? []) as unknown as Client[];

  return json({
    q,
    invoiceCount: invoiceResult.count ?? 0,
    clientCount: clientResult.count ?? 0,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      href: `/app/faturat/${invoice.id}`,
      title: invoice.invoice_number,
      subtitle: `${invoice.clients?.name ?? '—'} · ${formatDate(invoice.issue_date)}`,
      meta: formatALL(invoice.total),
      status: displayStatus(invoice.status, invoice.due_date),
    })),
    clients: clients.map((client) => ({
      id: client.id,
      href: '/app/klientet',
      title: client.name,
      subtitle:
        [client.nipt && `NIPT: ${client.nipt}`, client.email].filter(Boolean).join(' · ') ||
        'Pa të dhëna shtesë',
    })),
  });
};
