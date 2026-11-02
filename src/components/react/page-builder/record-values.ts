import { supabase } from '@/lib/supabase';
import { isInputField, isNumericField, numericValue, safeHref } from '@/lib/page-builder';
import { formatDate, groupThousands } from '@/lib/utils';
import type { CollectionField, CustomRecord } from '@/models/page-builder';
import type { FormValues } from '@/models/page-builder-ui';

/* A record's values: starting them empty, checking them, showing them, saving them. */

export function emptyValues(fields: CollectionField[]): FormValues {
  return Object.fromEntries(
    fields
      .filter(isInputField)
      .map((f) => [f.id, f.type === 'checkbox' ? false : f.type === 'number' ? 0 : ''])
  );
}

/** Only what a person typed — formula results are never stored. */
export function storable(fields: CollectionField[], values: FormValues): FormValues {
  const keep = new Set(fields.filter(isInputField).map((f) => f.id));
  return Object.fromEntries(Object.entries(values).filter(([k]) => keep.has(k)));
}

export function missingRequired(fields: CollectionField[], values: FormValues): CollectionField | undefined {
  return fields.find(
    (f) =>
      f.required &&
      isInputField(f) &&
      f.type !== 'checkbox' &&
      (values[f.id] === '' || values[f.id] === null || values[f.id] === undefined)
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A filled-in email, phone or link that is not one — empty is required's job. */
export function invalidField(fields: CollectionField[], values: FormValues): CollectionField | undefined {
  return fields.find((f) => {
    const v = String(values[f.id] ?? '').trim();
    if (!v) return false;
    if (f.type === 'email') return !EMAIL_RE.test(v);
    if (f.type === 'tel') return !/^[+\d][\d\s()-]{5,}$/.test(v);
    if (f.type === 'url') return !/^https?:\/\//i.test(v) || !safeHref(v);
    return false;
  });
}

export function formatNumber(n: number): string {
  const whole = groupThousands(Math.trunc(n));
  const cents = Math.round(Math.abs(n % 1) * 100);
  const sign = n < 0 && Math.trunc(n) === 0 ? '-' : '';
  return cents ? `${sign}${whole},${String(cents).padStart(2, '0')}` : `${sign}${whole}`;
}

/** A record's value for one field, as text — formulas worked out. */
export function formatValue(
  field: CollectionField,
  data: FormValues,
  fields: CollectionField[]
): string {
  if (isNumericField(field)) {
    const n = numericValue(field, data, fields);
    if (field.type === 'number' && (data[field.id] === '' || data[field.id] == null)) return '—';
    return n === null ? '—' : formatNumber(n);
  }
  const value = data[field.id];
  if (value === null || value === undefined || value === '') return '—';
  switch (field.type) {
    case 'date':
      return formatDate(String(value));
    case 'checkbox':
      return value ? 'Po' : 'Jo';
    default:
      return String(value);
  }
}

/** Inserts a new row for the signed-in customer, or updates `recordId`. RLS scopes both. */
export async function saveRecord(collectionId: string, data: FormValues, recordId: string | null): Promise<CustomRecord> {
  if (recordId) {
    const { data: row, error } = await supabase
      .from('custom_records')
      .update({ data })
      .eq('id', recordId)
      .select()
      .single();
    if (error) throw error;
    return row as CustomRecord;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesioni skadoi. Hyr sërish.');
  const { data: row, error } = await supabase
    .from('custom_records')
    .insert({ owner_id: user.id, collection_id: collectionId, data })
    .select()
    .single();
  if (error) throw error;
  return row as CustomRecord;
}
