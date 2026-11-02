import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { formKey, formMembers, isInputField } from '@/lib/page-builder';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useBlockContext } from './block-context';
import { FieldInput } from './FieldInputs';
import { emptyValues, formatValue, invalidField, missingRequired, saveRecord, storable } from './record-values';
import type { FieldBlock, SubmitBlock } from '@/models/page-builder';

/*
  Element-built forms: a field block per input, anywhere on the page, and a
  submit block that saves them. Blocks with the same collection and form name
  share their values through the page's context (formKey), which is what keeps
  a formula in one column in step with the inputs in another.
*/

function ElementPlaceholder({ children }: { children: React.ReactNode }) {
  const ctx = useBlockContext();
  // Misconfigured on the live page: show nothing rather than a broken input.
  if (!ctx.preview) return null;
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed px-3 py-3 text-left text-xs">
      {children}
    </div>
  );
}

export function FieldElement({ block }: { block: FieldBlock }) {
  const ctx = useBlockContext();
  const collection = ctx.collection(block.source.collectionId);
  const field = collection?.fields.find((f) => f.id === block.fieldId);
  const key = formKey(block.source.collectionId, block.form);
  const values = ctx.formValues(key);

  if (!collection || !field) {
    return (
      <ElementPlaceholder>
        {block.label || 'Fushë'} — {collection ? 'lidhe me një fushë të koleksionit' : 'zgjidh koleksionin'}.
      </ElementPlaceholder>
    );
  }

  const shown = { ...field, label: block.label.trim() || field.label };

  return (
    <div className="grid gap-1 text-left">
      {field.type === 'formula' ? (
        // Worked out live from the other fields of the same form.
        <div className="space-y-1.5">
          <p className="text-sm leading-none font-medium">{shown.label}</p>
          <output className="bg-muted flex h-10 items-center justify-end rounded-md px-3 text-sm font-semibold tabular-nums">
            {formatValue(field, values, collection.fields)}
          </output>
        </div>
      ) : (
        <FieldInput
          field={shown}
          value={values[field.id] ?? (field.type === 'checkbox' ? false : field.type === 'number' ? 0 : '')}
          onChange={(v) => ctx.setFormValue(key, field.id, v)}
          idPrefix={block.id}
          placeholder={block.placeholder}
        />
      )}
      {block.hint && <p className="text-muted-foreground text-xs">{block.hint}</p>}
    </div>
  );
}

export function SubmitElement({ block }: { block: SubmitBlock }) {
  const ctx = useBlockContext();
  const collection = ctx.collection(block.source.collectionId);
  const key = formKey(block.source.collectionId, block.form);
  const values = ctx.formValues(key);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const memberIds = new Set(formMembers(ctx.blocks, key).map((b) => b.fieldId));
  const fields = (collection?.fields ?? []).filter((f) => memberIds.has(f.id));

  if (!collection) {
    return <ElementPlaceholder>Butoni i dërgimit — zgjidh koleksionin dhe formularin.</ElementPlaceholder>;
  }

  async function submit() {
    const missing = missingRequired(fields, values);
    if (missing) {
      setError(`Plotëso fushën "${missing.label}".`);
      return;
    }
    const invalid = invalidField(fields, values);
    if (invalid) {
      setError(`Fusha "${invalid.label}" nuk ka një vlerë të saktë.`);
      return;
    }
    setError(null);
    if (ctx.preview) {
      notify.info('Parapamje', 'Këtu formulari nuk ruan asgjë.');
      return;
    }
    if (fields.filter(isInputField).length === 0) {
      setError('Ky formular nuk ka fusha të lidhura.');
      return;
    }
    setSaving(true);
    try {
      const data = { ...emptyValues(fields), ...storable(fields, values) };
      const row = await saveRecord(collection!.id, data, null);
      ctx.onSaved(row);
      if (block.resetAfter) ctx.resetForm(key);
      notify.success(block.successText || 'U ruajt.', `Një rresht i ri te ${collection!.name}.`);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      notify.error('Nuk u ruajt', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div>
        <Button type="button" onClick={submit} disabled={saving} className={cn(block.fullWidth && 'w-full')}>
          {saving && <Loader2 className="animate-spin" />}
          {block.label || 'Dërgo'}
        </Button>
      </div>
      {error && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-left text-sm">{error}</p>
      )}
    </div>
  );
}
