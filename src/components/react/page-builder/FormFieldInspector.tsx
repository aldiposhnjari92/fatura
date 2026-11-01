import * as React from 'react';
import { CheckCircle2, Link2, Loader2, Plus, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import { notify } from '@/lib/toast';
import {
  DEFAULT_FORM,
  FIELD_PALETTE,
  FIELD_TYPES,
  evaluateFormula,
  flattenBlocks,
  formKey,
  formulaToIds,
  isNumericField,
  newId,
  type Block,
  type CollectionField,
  type CustomCollection,
  type FieldBlock,
  type SubmitBlock,
} from '@/lib/page-builder';
import { Field, SourcePicker } from './BlockInspector';
import { formMembers } from './PageBlocks';

/*
  Settings for a form built element by element (FieldBlock, SubmitBlock).

  The two things to get right are which collection and which form name — the
  pair that makes elements one form — so both are shown on every element,
  with a summary of what the form currently holds and what it is missing.
*/

interface Props {
  block: FieldBlock | SubmitBlock;
  set: (patch: Partial<Omit<FieldBlock, 'type'>> & Partial<Omit<SubmitBlock, 'type'>>) => void;
  collections: CustomCollection[];
  pageBlocks: Block[];
  onManageCollections: () => void;
  onAddField: (collectionId: string, field: CollectionField) => Promise<boolean>;
}

export default function FormFieldInspector({
  block,
  set,
  collections,
  pageBlocks,
  onManageCollections,
  onAddField,
}: Props) {
  const collection = collections.find((c) => c.id === block.source.collectionId);
  const key = formKey(block.source.collectionId, block.form);

  return (
    <>
      <SourcePicker
        source={block.source}
        collections={collections}
        onChange={(source) => set(block.type === 'field' ? { source, fieldId: null } : { source })}
        onManage={onManageCollections}
      />

      <FormNamePicker
        value={block.form}
        onChange={(form) => set({ form })}
        pageBlocks={pageBlocks}
        collectionId={block.source.collectionId}
      />

      {block.type === 'field' ? (
        <FieldSettings block={block} set={set} collection={collection} onAddField={onAddField} />
      ) : (
        <SubmitSettings block={block} set={set} />
      )}

      <FormSummary pageBlocks={pageBlocks} formKey={key} collection={collection} />
    </>
  );
}

/** The form's name: any text, with the names already on this page offered first. */
function FormNamePicker({
  value,
  onChange,
  pageBlocks,
  collectionId,
}: {
  value: string;
  onChange: (form: string) => void;
  pageBlocks: Block[];
  collectionId: string | null;
}) {
  const listId = React.useId();
  const names = [
    ...new Set(
      flattenBlocks(pageBlocks)
        .filter(
          (b): b is FieldBlock | SubmitBlock =>
            (b.type === 'field' || b.type === 'submit') && b.source.collectionId === collectionId
        )
        .map((b) => b.form.trim())
        .filter(Boolean)
    ),
  ];
  return (
    <Field label="Formulari">
      <Input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => !value.trim() && onChange(DEFAULT_FORM)}
        placeholder={DEFAULT_FORM}
      />
      <datalist id={listId}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <p className="text-muted-foreground text-[11px]">
        Fushat dhe butoni me të njëjtin koleksion dhe emër formulari ruhen bashkë.
      </p>
    </Field>
  );
}

function FieldSettings({
  block,
  set,
  collection,
  onAddField,
}: {
  block: FieldBlock;
  set: Props['set'];
  collection: CustomCollection | undefined;
  onAddField: Props['onAddField'];
}) {
  const kindLabel = FIELD_PALETTE.find((f) => f.kind === block.kind)?.label ?? 'Fushë';
  const connected = collection?.fields.find((f) => f.id === block.fieldId);

  // Fields of the same type first: what this element was added as is the likely match.
  const options = (collection?.fields ?? [])
    .slice()
    .sort((a, b) => Number(b.type === block.kind) - Number(a.type === block.kind))
    .map((f) => ({
      value: f.id,
      label: f.label,
      hint: FIELD_TYPES.find((t) => t.value === f.type)?.label,
    }));

  return (
    <>
      {collection && (
        <Field label="Lidhur me fushën">
          <SearchableSelect
            value={block.fieldId ?? ''}
            onValueChange={(fieldId) => set({ fieldId })}
            placeholder="Zgjidh fushën e koleksionit"
            searchPlaceholder="Kërko…"
            emptyText="Koleksioni nuk ka ende fusha"
            searchThreshold={8}
            options={options}
          />
          {connected ? (
            <p className="text-success flex items-center gap-1.5 text-[11px]">
              <Link2 className="size-3" /> Lidhur me “{connected.label}”
              {connected.required && ' · e detyrueshme'}
            </p>
          ) : (
            <p className="text-warning text-[11px]">Pa lidhje — nuk shfaqet te klienti derisa ta lidhësh.</p>
          )}
        </Field>
      )}

      {collection && !connected && (
        <NewFieldForm kind={block.kind} kindLabel={kindLabel} collection={collection} onCreate={async (field) => {
          if (await onAddField(collection.id, field)) set({ fieldId: field.id });
        }} />
      )}

      <Field label="Etiketa (opsionale)">
        <Input
          value={block.label}
          onChange={(e) => set({ label: e.target.value })}
          placeholder={connected?.label ?? 'Emri i fushës'}
        />
      </Field>
      {connected?.type !== 'formula' && connected?.type !== 'checkbox' && (
        <Field label="Teksti brenda fushës">
          <Input value={block.placeholder} onChange={(e) => set({ placeholder: e.target.value })} />
        </Field>
      )}
      <Field label="Ndihmë poshtë fushës">
        <Input value={block.hint} onChange={(e) => set({ hint: e.target.value })} />
      </Field>
    </>
  );
}

/** Create the collection field this element needs, without leaving the editor. */
function NewFieldForm({
  kind,
  kindLabel,
  collection,
  onCreate,
}: {
  kind: CollectionField['type'];
  kindLabel: string;
  collection: CustomCollection;
  onCreate: (field: CollectionField) => Promise<void>;
}) {
  const [label, setLabel] = React.useState('');
  const [required, setRequired] = React.useState(false);
  const [options, setOptions] = React.useState('');
  const [formula, setFormula] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const numeric = collection.fields.filter(isNumericField);

  async function create() {
    const name = label.trim();
    if (!name) {
      notify.error('Mungon emri', 'Jepi fushës së re një emër.');
      return;
    }
    if (collection.fields.some((f) => f.label.trim().toLowerCase() === name.toLowerCase())) {
      notify.error('Emri ekziston', `Koleksioni ka tashmë një fushë “${name}” — lidhe atë.`);
      return;
    }
    const field: CollectionField = { id: newId(), label: name, type: kind, required: kind === 'formula' ? false : required };
    if (kind === 'select') {
      field.options = options.split(',').map((o) => o.trim()).filter(Boolean);
    }
    if (kind === 'formula') {
      const converted = formulaToIds(formula, collection.fields);
      if ('unknown' in converted) {
        notify.error('Formula nuk është e saktë', `Nuk ka fushë numri me emrin “${converted.unknown}”.`);
        return;
      }
      if (evaluateFormula(converted.formula, () => 1) === null) {
        notify.error('Formula nuk është e saktë', 'Përdor fushat në {kllapa} dhe + − × ÷, p.sh. {Sasia} × {Çmimi}.');
        return;
      }
      field.formula = converted.formula;
    }
    setBusy(true);
    try {
      await onCreate(field);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-muted/50 grid gap-2 rounded-lg p-3">
      <p className="text-xs font-medium">Ose krijo një fushë të re ({kindLabel}) te {collection.name}</p>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Emri i fushës" aria-label="Emri i fushës së re" />
      {kind === 'select' && (
        <Input
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          placeholder="Zgjedhjet, të ndara me presje"
          aria-label="Zgjedhjet"
        />
      )}
      {kind === 'formula' && (
        <>
          <Input
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder="{Sasia} × {Çmimi}"
            aria-label="Formula"
            className="font-mono text-xs md:text-xs"
          />
          <div className="flex flex-wrap gap-1">
            {numeric.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormula((v) => `${v.trimEnd()} {${f.label}} `.trimStart())}
                className="bg-primary/10 text-primary hover:bg-primary/20 rounded px-1.5 py-0.5 text-[11px] font-medium"
              >
                {f.label}
              </button>
            ))}
            {['+', '−', '×', '÷'].map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setFormula((v) => `${v.trimEnd()} ${op} `.trimStart())}
                className="bg-muted hover:bg-muted/70 w-6 rounded py-0.5 text-[11px] font-semibold"
              >
                {op}
              </button>
            ))}
          </div>
        </>
      )}
      {kind !== 'formula' && kind !== 'checkbox' && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="accent-primary size-3.5"
          />
          E detyrueshme
        </label>
      )}
      <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={create} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Plus />} Krijo dhe lidh
      </Button>
    </div>
  );
}

function SubmitSettings({ block, set }: { block: SubmitBlock; set: Props['set'] }) {
  return (
    <>
      <Field label="Teksti i butonit">
        <Input value={block.label} onChange={(e) => set({ label: e.target.value })} />
      </Field>
      <Field label="Mesazhi pas ruajtjes">
        <Input value={block.successText} onChange={(e) => set({ successText: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={block.resetAfter}
          onChange={(e) => set({ resetAfter: e.target.checked })}
          className="accent-primary size-4"
        />
        Pastro fushat pas ruajtjes
      </label>
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={block.fullWidth}
          onChange={(e) => set({ fullWidth: e.target.checked })}
          className="accent-primary size-4"
        />
        Butoni në gjithë gjerësinë
      </label>
    </>
  );
}

/*
  What the form is made of, right now: its connected fields, whether it has a
  submit button, and any required field of the collection with no element —
  the reasons a form "does nothing" or always refuses to save.
*/
function FormSummary({
  pageBlocks,
  formKey: key,
  collection,
}: {
  pageBlocks: Block[];
  formKey: string;
  collection: CustomCollection | undefined;
}) {
  if (!collection) return null;
  const members = formMembers(pageBlocks, key);
  const memberIds = new Set(members.map((m) => m.fieldId));
  const hasSubmit = flattenBlocks(pageBlocks).some(
    (b) => b.type === 'submit' && formKey(b.source.collectionId, b.form) === key
  );
  const missingRequired = collection.fields.filter(
    (f) => f.required && f.type !== 'formula' && !memberIds.has(f.id)
  );
  const labels = collection.fields.filter((f) => memberIds.has(f.id)).map((f) => f.label);

  return (
    <div className="grid gap-1.5 rounded-lg border p-3 text-xs">
      <p className="font-medium">Ky formular</p>
      <p className="text-muted-foreground">
        {labels.length ? `Fushat: ${labels.join(', ')}` : 'Ende asnjë fushë e lidhur.'}
      </p>
      {hasSubmit ? (
        <p className="text-success flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5" /> Ka buton dërgimi
        </p>
      ) : (
        <p className="text-warning flex items-center gap-1.5">
          <TriangleAlert className="size-3.5" /> Shto një “Butoni i dërgimit” me të njëjtin formular
        </p>
      )}
      {missingRequired.length > 0 && (
        <p className="text-muted-foreground">
          Fusha të detyrueshme pa element: {missingRequired.map((f) => f.label).join(', ')} — ruhen bosh.
        </p>
      )}
    </div>
  );
}
