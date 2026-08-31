import type { SupabaseClient } from '@supabase/supabase-js';

/*
  The global filter behind the search field in the app shell.

  It was a GET form pointed straight at the invoice list, whose `kerko` filter
  only ever ran `ilike` against `invoice_number`. So the one thing a user
  actually types — a customer's name — matched nothing, from a field that
  claimed to search the whole app.

  Matching a client name means a join, and PostgREST cannot OR across an
  embedded resource. So the client table is resolved first and its ids folded
  into the invoice filter: two bounded round trips instead of one wrong one.
*/

/** Long enough for a business name, short enough to keep the LIKE cheap. */
export const SEARCH_MAX_LENGTH = 60;

/** Clients resolved per lookup. Past this the term is too vague to be useful. */
const CLIENT_MATCH_LIMIT = 50;

export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').trim().slice(0, SEARCH_MAX_LENGTH);
}

/*
  A PostgREST `or()` argument is a comma-separated list, and each value may be
  double-quoted. A term containing a comma, a parenthesis or a quote would
  otherwise be read as filter syntax rather than as text, so the pattern is
  quoted and the two characters that can end a quoted value are escaped.

  This is not an injection guard — postgrest-js binds these as values, never as
  SQL — it is what keeps the filter from being *parsed* wrong.
*/
function quotedPattern(term: string): string {
  return `"%${term.replace(/[\\"]/g, '\\$&')}%"`;
}

/** Ids of the caller's clients whose name, NIPT or email matches the term. */
export async function matchingClientIds(
  supabase: SupabaseClient,
  ownerId: string,
  term: string
): Promise<string[]> {
  if (!term) return [];

  const pattern = quotedPattern(term);
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('owner_id', ownerId)
    .or(`name.ilike.${pattern},nipt.ilike.${pattern},email.ilike.${pattern}`)
    .limit(CLIENT_MATCH_LIMIT);

  return (data ?? []).map((row) => row.id as string);
}

/**
 * Narrow an invoice query to the term: its own number, or any invoice billed
 * to a client the term matches. Pass the ids from `matchingClientIds`.
 */
export function applyInvoiceSearch<T>(
  query: T,
  term: string,
  clientIds: string[]
): T {
  if (!term) return query;

  const conditions = [`invoice_number.ilike.${quotedPattern(term)}`];
  if (clientIds.length > 0) conditions.push(`client_id.in.(${clientIds.join(',')})`);

  // `or` exists on the filter builder; the generic keeps the caller's type.
  return (query as { or: (filter: string) => T }).or(conditions.join(','));
}
