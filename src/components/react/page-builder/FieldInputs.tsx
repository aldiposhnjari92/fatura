import { Input } from '@/components/ui/react/input';
import { NumberInput } from '@/components/ui/react/number-input';
import { Label } from '@/components/ui/react/label';
import { Textarea } from '@/components/ui/react/textarea';
import { DatePicker } from '@/components/ui/react/date-picker';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import { formatValue } from './record-values';
import type { FieldGridProps, FieldInputProps } from '@/models/page-builder-ui';

/** Shown where a data block has no collection to read from. */
export function Missing({ what }: { what: string }) {
  return (
    <p className="border-warning/40 bg-warning/10 rounded-xl border px-4 py-3 text-left text-sm">
      {what} nuk ka një koleksion të lidhur.
    </p>
  );
}

/** One input for one collection field, by its type. */
export function FieldInput({ field, value, onChange, idPrefix, placeholder }: FieldInputProps) {
  const id = `${idPrefix}-${field.id}`;
  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.required && field.type !== 'checkbox' ? ' *' : ''}
    </Label>
  );

  switch (field.type) {
    case 'textarea':
      return (
        <div className="space-y-1.5 @lg:col-span-2">
          {label}
          <Textarea
            id={id}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || undefined}
            rows={3}
          />
        </div>
      );
    case 'number':
      return (
        <div className="space-y-1.5">
          {label}
          <NumberInput id={id} value={Number(value) || 0} onValueChange={onChange} decimal className="text-right" />
        </div>
      );
    case 'date':
      return (
        <div className="space-y-1.5">
          {label}
          <DatePicker
            id={id}
            value={String(value ?? '')}
            onChange={onChange}
            clearable={!field.required}
            aria-label={field.label}
          />
        </div>
      );
    case 'select':
      return (
        <div className="space-y-1.5">
          {label}
          <SearchableSelect
            id={id}
            value={String(value ?? '')}
            onValueChange={onChange}
            options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
            placeholder="Zgjidh…"
            searchPlaceholder="Kërko…"
            emptyText="Asnjë rezultat"
          />
        </div>
      );
    case 'checkbox':
      return (
        <label htmlFor={id} className="flex items-center gap-2.5 self-end py-2 text-sm font-medium">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-primary size-4"
          />
          {field.label}
        </label>
      );
    default:
      return (
        <div className="space-y-1.5">
          {label}
          <Input
            id={id}
            type={field.type === 'email' || field.type === 'tel' || field.type === 'url' ? field.type : 'text'}
            inputMode={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : undefined}
            placeholder={placeholder || (field.type === 'url' ? 'https://' : undefined)}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}

/** A form's fields in a two-column grid, formulas shown as live results. */
export function FieldGrid({ fields, allFields, values, setValues, idPrefix }: FieldGridProps) {
  return (
    <div className="grid gap-4 text-left @lg:grid-cols-2">
      {fields.map((field) =>
        field.type === 'formula' ? (
          // Worked out live as the inputs it uses are typed.
          <div key={field.id} className="space-y-1.5">
            <p className="text-sm leading-none font-medium">{field.label}</p>
            <output className="bg-muted flex h-10 items-center justify-end rounded-md px-3 text-sm font-semibold tabular-nums">
              {formatValue(field, values, allFields)}
            </output>
          </div>
        ) : (
          <FieldInput
            key={field.id}
            field={field}
            value={values[field.id] ?? null}
            onChange={(v) => setValues({ ...values, [field.id]: v })}
            idPrefix={idPrefix}
          />
        )
      )}
    </div>
  );
}
