import { fold } from './columns';
import type { ParsedInvoice } from '@/models/excel';

/* Reading and writing single cells: dates, text, numbers and statuses. */

// ---------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------

/** 'YYYY-MM-DD' as a UTC Date, which is what the writer turns into an Excel date. */
export function isoToCellDate(iso: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function validIso(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Whatever a date cell holds, as 'YYYY-MM-DD'. The reader hands back a Date
 * for a formatted cell, a serial number for an unformatted one, and a string
 * for anything typed as text — in Albania that is day-first.
 */
export function cellToIso(value: unknown): string | null {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return validIso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  if (typeof value === 'number') {
    // Excel serial: days since 1899-12-30. Anything below ~1955 is not a date we mean.
    if (value < 20000 || value > 80000) return null;
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return validIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const text = String(value).trim();
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (match) return validIso(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (match) return validIso(Number(match[3]), Number(match[2]), Number(match[1]));
  return null;
}

export function toText(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return cellToIso(value) ?? '';
  return String(value).trim();
}

/** Numbers as Excel stores them, or as typed: "1.200,50", "1,200.50" and "1200" all read. */
export function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = String(value).replace(/[\s%]|lek[ëe]?|all/gi, '');
  if (!text) return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > lastDot) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function toStatus(value: unknown): ParsedInvoice['status'] | null {
  const text = fold(toText(value));
  if (!text) return 'draft';
  if (['draft', 'drafti', 'skice'].includes(text)) return 'draft';
  if (['paid', 'e paguar', 'paguar', 'paguara', 'e paguara'].includes(text)) return 'paid';
  // Lateness is derived from the due date, never stored, so a late invoice
  // comes back in as an unpaid one and turns late again by itself.
  if (
    ['unpaid', 'e papaguar', 'papaguar', 'e papaguara', 'overdue', 'e vonuar', 'vonuar'].includes(text)
  ) {
    return 'unpaid';
  }
  return null;
}
