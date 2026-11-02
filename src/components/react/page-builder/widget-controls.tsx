import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import { cn } from '@/lib/utils';
import { WIDGET_ICONS, isNumericField, safeHref } from '@/lib/page-builder';
import { Field } from './BlockInspector';
import { WIDGET_ICON_COMPONENTS } from './icons';
import type {
  CheckProps,
  FieldSelectProps,
  IconPickerProps,
  ItemListProps,
  LinkFieldsProps,
  MiniButtonProps,
  StarsInputProps,
} from '@/models/page-builder-ui';

/* The small controls the widget inspectors are built from. */

export function Check({ label, checked, onChange }: CheckProps) {
  return (
    <label className="flex items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary size-4"
      />
      {label}
    </label>
  );
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <Field label="Ikona">
      <div className="grid grid-cols-6 gap-1">
        {WIDGET_ICONS.map((name) => {
          const Icon = WIDGET_ICON_COMPONENTS[name];
          return (
            <button
              key={name}
              type="button"
              aria-label={name}
              title={name}
              aria-pressed={value === name}
              onClick={() => onChange(name)}
              className={cn(
                'grid aspect-square place-items-center rounded-md border transition-colors',
                value === name ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function StarsInput({ value, onChange, allowZero = false }: StarsInputProps) {
  return (
    <Field label={`Yjet: ${value}/5`}>
      <input
        type="range"
        min={allowZero ? 0 : 0.5}
        max={5}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary w-full"
        aria-label="Yjet"
      />
    </Field>
  );
}

export function LinkFields({ label, href, onChange }: LinkFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Teksti i butonit">
        <Input value={label} onChange={(e) => onChange(e.target.value, href)} />
      </Field>
      <Field label="Lidhja">
        <Input value={href} onChange={(e) => onChange(label, e.target.value)} placeholder="/app/…" />
      </Field>
      {label && !safeHref(href) && (
        <p className="text-destructive col-span-2 text-xs">Lidhja duhet të fillojë me / ose https://</p>
      )}
    </div>
  );
}

export function FieldSelect({
  label,
  collection,
  value,
  onChange,
  numericOnly = false,
  allowNone = false,
}: FieldSelectProps) {
  const fields = (collection?.fields ?? []).filter((f) => !numericOnly || isNumericField(f));
  return (
    <Field label={label}>
      <SearchableSelect
        value={value ?? ''}
        onValueChange={(v) => onChange(v === '__none' ? null : v)}
        placeholder={allowNone ? 'Asnjë' : 'Zgjidh fushën'}
        searchPlaceholder="Kërko…"
        emptyText={numericOnly ? 'Koleksioni nuk ka fusha numri' : 'Koleksioni nuk ka fusha'}
        searchThreshold={8}
        options={[
          ...(allowNone ? [{ value: '__none', label: 'Asnjë' }] : []),
          ...fields.map((f) => ({ value: f.id, label: f.label })),
        ]}
      />
    </Field>
  );
}

/*
  A list of items with add, remove and reorder — the repeater every list-shaped
  widget uses (tabs, accordion, icon list, price features, price list).
*/
export function ItemList<T extends { id: string }>({ label, items, onChange, create, render }: ItemListProps<T>) {
  const list = Array.isArray(items) ? items : [];
  const move = (i: number, by: -1 | 1) => {
    const next = [...list];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <Field label={label}>
      <div className="grid gap-2">
        {list.map((item, i) => (
          <div key={item.id} className="grid grid-cols-[1fr_auto] items-start gap-1 rounded-lg border p-2">
            {render(item, (patch) => onChange(list.map((x) => (x.id === item.id ? { ...x, ...patch } : x))))}
            <div className="flex flex-col">
              <MiniButton label="Lart" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </MiniButton>
              <MiniButton label="Poshtë" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown />
              </MiniButton>
              <MiniButton label="Hiq" danger onClick={() => onChange(list.filter((x) => x.id !== item.id))}>
                <X />
              </MiniButton>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => onChange([...list, create()])}
        >
          <Plus /> Shto
        </Button>
      </div>
    </Field>
  );
}

function MiniButton({ label, onClick, disabled, danger, children }: MiniButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-muted-foreground rounded p-1 disabled:opacity-30 [&_svg]:size-3.5',
        danger ? 'hover:text-destructive' : 'hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
