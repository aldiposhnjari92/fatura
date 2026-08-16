import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Every money value in Fatura.co is a whole Lek integer. There are no cents in
 * everyday Albanian invoicing, so we never introduce float rounding at all.
 */
/**
 * Albanian thousands separator: a non-breaking space, no decimals.
 *
 * Deliberately NOT Intl. Node ships full ICU but many browsers have no `sq`
 * locale data at all (Intl.NumberFormat.supportedLocalesOf(['sq-AL']) === []),
 * silently falling back to en-US — "45,000" on the client against "45 000" from
 * the server. That is both wrong for Albanian users and a React hydration
 * mismatch. Formatting it by hand makes server and client byte-identical
 * everywhere.
 */
const NBSP = ' ';

export function groupThousands(n: number): string {
  const rounded = Math.round(Number.isFinite(n) ? n : 0);
  const negative = rounded < 0;
  const digits = String(Math.abs(rounded));

  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += NBSP;
    out += digits[i];
  }
  return negative ? `-${out}` : out;
}

export function formatALL(amount: number, withSuffix = true): string {
  const formatted = groupThousands(amount);
  return withSuffix ? `${formatted} Lekë` : formatted;
}

/** dd.MM.yyyy — the Albanian convention, computed without Intl (see above). */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/**
 * "14 gusht 2027". Month names are hardcoded for the same reason
 * groupThousands()/formatDate() avoid Intl: most browsers ship no Albanian
 * locale data, so toLocaleDateString('sq-AL', { month: 'long' }) silently
 * falls back to en-US and prints "August 14, 2027" to an Albanian customer.
 */
const SQ_MONTHS = [
  'janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor',
  'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor',
];

export function formatLongDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${SQ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** yyyy-mm-dd in local time, for <input type="date"> values. */
export function toDateInput(value: string | Date = new Date()): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(base: Date | string, days: number): string {
  const d = typeof base === 'string' ? new Date(base) : new Date(base);
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

/**
 * Albanian NIPT: a letter, 8 digits, then a letter — e.g. L72119451K.
 * Kept permissive: we warn, we never block a user from invoicing.
 */
export function isValidNipt(nipt: string | null | undefined): boolean {
  if (!nipt) return false;
  return /^[A-Za-z]\d{8}[A-Za-z]$/.test(nipt.trim());
}

export function initials(name: string | null | undefined): string {
  if (!name) return 'F';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
