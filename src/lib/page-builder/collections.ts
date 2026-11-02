import type { CollectionField, CustomCollection, FieldType } from '@/models/page-builder';

// ---- Collections ------------------------------------------------------

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Tekst' },
  { value: 'textarea', label: 'Tekst i gjatë' },
  { value: 'number', label: 'Numër' },
  { value: 'date', label: 'Datë' },
  { value: 'select', label: 'Zgjedhje' },
  { value: 'checkbox', label: 'Po / Jo' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Telefon' },
  { value: 'url', label: 'Lidhje (URL)' },
  { value: 'formula', label: 'Llogaritje' },
];

/** Fields a person types into — a formula is worked out, not entered. */
export const isInputField = (f: CollectionField) => f.type !== 'formula';

/** Fields whose value is a number: what a formula or a sum can use. */
export const isNumericField = (f: CollectionField) => f.type === 'number' || f.type === 'formula';

/** The fields a form or table shows, in the configured order. */
export function pickFields(collection: CustomCollection | undefined, ids: string[]) {
  const fields = collection?.fields ?? [];
  if (ids.length === 0) return fields;
  const byId = new Map(fields.map((f) => [f.id, f]));
  return ids.map((id) => byId.get(id)).filter((f): f is CollectionField => !!f);
}
