import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { isInputField, pickFields } from '@/lib/page-builder';
import { notify } from '@/lib/toast';
import { useBlockContext } from './block-context';
import { FieldGrid, Missing } from './FieldInputs';
import { emptyValues, invalidField, missingRequired, saveRecord, storable } from './record-values';
import type { FormBlock } from '@/models/page-builder';
import type { FormValues } from '@/models/page-builder-ui';

/** The Formular block: every chosen field of a collection, saved as one new row. */
export default function FormView({ block }: { block: FormBlock }) {
  const ctx = useBlockContext();
  const collection = ctx.collection(block.source.collectionId);
  const allFields = collection?.fields ?? [];
  const fields = pickFields(collection, block.fieldIds);
  const [values, setValues] = React.useState<FormValues>(() => emptyValues(fields));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The admin reconfiguring fields in the editor must not leave stale keys.
  const fieldKey = fields.map((f) => f.id).join('|');
  React.useEffect(() => setValues(emptyValues(fields)), [fieldKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!collection) return <Missing what="Formulari" />;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    setSaving(true);
    try {
      const row = await saveRecord(collection!.id, storable(allFields, values), null);
      ctx.onSaved(row);
      setValues(emptyValues(fields));
      notify.success('U ruajt.', `Një rresht i ri te ${collection!.name}.`);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      notify.error('Nuk u ruajt', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card shadow-card grid gap-4 rounded-2xl p-5 text-left">
      {block.title && <h2 className="text-base font-semibold">{block.title}</h2>}
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-sm">Koleksioni nuk ka ende fusha.</p>
      ) : (
        <FieldGrid
          fields={fields}
          allFields={allFields}
          values={values}
          setValues={setValues}
          idPrefix={block.id}
        />
      )}
      {error && <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>}
      <div>
        <Button type="submit" disabled={saving || fields.filter(isInputField).length === 0}>
          {saving && <Loader2 className="animate-spin" />}
          {block.submitLabel || 'Ruaj'}
        </Button>
      </div>
    </form>
  );
}
