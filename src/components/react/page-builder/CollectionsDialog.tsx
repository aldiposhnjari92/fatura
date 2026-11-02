import * as React from 'react';
import { ArrowDown, ArrowUp, Database, Loader2, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { Label } from '@/components/ui/react/label';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { FIELD_TYPES, evaluateFormula, formulaToIds, formulaToLabels, isNumericField, newId } from '@/lib/page-builder';
import type { CollectionField, CustomCollection } from '@/models/page-builder';
import type { CollectionDraft, CollectionsDialogProps } from '@/models/page-builder-ui';

/*
  Collections are the customer's own small tables: a name and a list of
  fields. Forms write rows into one; tables and stats read from one.

  A field's id never changes once made — rows store values under it — so a
  label can be renamed freely without orphaning what was already typed.

  A formula is edited with labels — {Kosto} × {Sasia} — and stored with ids,
  so renaming Kosto later does not break the formula that uses it.
*/

const newField = (): CollectionField => ({ id: newId(), label: '', type: 'text', required: false });

export default function CollectionsDialog({ open, onOpenChange, ownerId, collections, onChange }: CollectionsDialogProps) {
  const [draft, setDraft] = React.useState<CollectionDraft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setDraft(null);
      setConfirmDelete(false);
    }
  }, [open]);

  function edit(collection: CustomCollection) {
    setDraft({
      id: collection.id,
      name: collection.name,
      fields: collection.fields.map((f) =>
        f.type === 'formula'
          ? { ...f, formula: formulaToLabels(f.formula ?? '', collection.fields) }
          : { ...f }
      ),
    });
    setConfirmDelete(false);
  }

  function setField(index: number, patch: Partial<CollectionField>) {
    if (!draft) return;
    setDraft({
      ...draft,
      fields: draft.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    });
  }

  function moveField(index: number, by: -1 | 1) {
    if (!draft) return;
    const next = [...draft.fields];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft({ ...draft, fields: next });
  }

  async function save() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      notify.error('Mungon emri', 'Jepi koleksionit një emër.');
      return;
    }
    const labelled = draft.fields
      .map((f) => ({
        ...f,
        label: f.label.trim(),
        options:
          f.type === 'select'
            ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
            : undefined,
        required: f.type === 'formula' ? false : f.required,
      }))
      .filter((f) => f.label);

    // Formulas: labels → ids, and refuse one that does not parse.
    const fields: CollectionField[] = [];
    for (const f of labelled) {
      if (f.type !== 'formula') {
        fields.push({ ...f, formula: undefined });
        continue;
      }
      const converted = formulaToIds(
        f.formula ?? '',
        labelled.filter((x) => x.id !== f.id)
      );
      if ('unknown' in converted) {
        notify.error(
          'Formula nuk është e saktë',
          `Te "${f.label}": nuk ka fushë numri me emrin "${converted.unknown}".`
        );
        return;
      }
      if (evaluateFormula(converted.formula, () => 1) === null) {
        notify.error(
          'Formula nuk është e saktë',
          `Te "${f.label}": përdor fushat në {kllapa} dhe + − × ÷, p.sh. {Kosto} × {Sasia}.`
        );
        return;
      }
      fields.push({ ...f, options: undefined, formula: converted.formula });
    }

    setSaving(true);
    try {
      if (draft.id) {
        const { data, error } = await supabase
          .from('custom_collections')
          .update({ name, fields })
          .eq('id', draft.id)
          .select()
          .single();
        if (error) throw error;
        onChange(collections.map((c) => (c.id === draft.id ? (data as CustomCollection) : c)));
      } else {
        const { data, error } = await supabase
          .from('custom_collections')
          .insert({ owner_id: ownerId, name, fields })
          .select()
          .single();
        if (error) throw error;
        onChange([...collections, data as CustomCollection]);
      }
      notify.success('Koleksioni u ruajt.', `${name} — ${fields.length} fusha.`);
      setDraft(null);
    } catch (err) {
      notify.error('Koleksioni nuk u ruajt', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('custom_collections').delete().eq('id', draft.id);
      if (error) throw error;
      onChange(collections.filter((c) => c.id !== draft.id));
      notify.success('Koleksioni u fshi.', `${draft.name} dhe rreshtat e tij u hoqën.`);
      setDraft(null);
    } catch (err) {
      notify.error('Koleksioni nuk u fshi', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft ? (draft.id ? 'Ndrysho koleksionin' : 'Koleksion i ri') : 'Koleksionet'}</DialogTitle>
          <DialogDescription>
            Një koleksion është një tabelë e vogël: formularët shtojnë rreshta në të, tabelat i
            listojnë.
          </DialogDescription>
        </DialogHeader>

        {!draft ? (
          <div className="grid gap-2">
            {collections.length === 0 && (
              <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
                Ende asnjë koleksion për këtë klient.
              </p>
            )}
            {collections.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => edit(c)}
                className="hover:bg-muted flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
              >
                <Database className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                <span className="text-muted-foreground text-xs">{c.fields.length} fusha</span>
              </button>
            ))}
            <Button
              variant="outline"
              className="mt-2 justify-self-start"
              onClick={() => setDraft({ id: null, name: '', fields: [newField()] })}
            >
              <Plus /> Koleksion i ri
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="col-name">Emri *</Label>
              <Input
                id="col-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="p.sh. Porositë"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label>Fushat</Label>
              {draft.fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 rounded-lg border p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto] sm:items-center">
                    <Input
                      value={field.label}
                      onChange={(e) => setField(index, { label: e.target.value })}
                      placeholder="Emri i fushës"
                      aria-label="Emri i fushës"
                    />
                    <SearchableSelect
                      value={field.type}
                      onValueChange={(type) =>
                        setField(index, { type: type as CollectionField['type'] })
                      }
                      options={FIELD_TYPES}
                      searchThreshold={99}
                      aria-label="Lloji"
                    />
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="Lëvize lart"
                        disabled={index === 0}
                        onClick={() => moveField(index, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="Lëvize poshtë"
                        disabled={index === draft.fields.length - 1}
                        onClick={() => moveField(index, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-8"
                        aria-label="Hiq fushën"
                        onClick={() =>
                          setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })
                        }
                      >
                        <X />
                      </Button>
                    </div>
                  </div>

                  {field.type === 'formula' && (
                    <FormulaInput
                      value={field.formula ?? ''}
                      onChange={(formula) => setField(index, { formula })}
                      fields={draft.fields.filter(
                        (f) => f.id !== field.id && isNumericField(f) && f.label.trim()
                      )}
                    />
                  )}

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    {field.type !== 'checkbox' && field.type !== 'formula' && (
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={(e) => setField(index, { required: e.target.checked })}
                          className="accent-primary size-3.5"
                        />
                        E detyrueshme
                      </label>
                    )}
                    {field.type === 'select' && (
                      <Input
                        value={(field.options ?? []).join(', ')}
                        onChange={(e) => setField(index, { options: e.target.value.split(',') })}
                        placeholder="Zgjedhjet, të ndara me presje"
                        aria-label="Zgjedhjet"
                        className="h-8 min-h-8 flex-1 text-xs md:text-xs"
                      />
                    )}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() => setDraft({ ...draft, fields: [...draft.fields, newField()] })}
              >
                <Plus /> Shto fushë
              </Button>
            </div>

            {confirmDelete && (
              <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                Fshirja heq edhe të gjithë rreshtat që klienti ka ruajtur në këtë koleksion. Shtyp
                sërish "Fshi" për ta konfirmuar.
              </p>
            )}

            <DialogFooter className={cn(draft.id && 'sm:justify-between')}>
              {draft.id && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={saving}
                  onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
                >
                  <Trash2 /> Fshi
                </Button>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
                  Kthehu
                </Button>
                <Button type="button" onClick={save} disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />}
                  Ruaj koleksionin
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/*
  The formula box: typed freely, with the collection's number fields offered
  as chips that insert {Label} at the end — the only part people get wrong
  by hand is the braces.
*/
function FormulaInput({
  value,
  onChange,
  fields,
}: {
  value: string;
  onChange: (value: string) => void;
  fields: CollectionField[];
}) {
  const insert = (text: string) => onChange(`${value.trimEnd()} ${text} `.trimStart());
  return (
    <div className="grid gap-1.5">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="{Kosto} × {Sasia}"
        aria-label="Formula"
        className="font-mono text-xs md:text-xs"
      />
      <div className="flex flex-wrap items-center gap-1">
        {fields.length === 0 ? (
          <span className="text-muted-foreground text-[11px]">
            Shto më parë një fushë Numër për ta përdorur këtu.
          </span>
        ) : (
          fields.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => insert(`{${f.label.trim()}}`)}
              className="bg-primary/10 text-primary hover:bg-primary/20 rounded px-1.5 py-0.5 text-[11px] font-medium"
            >
              {f.label}
            </button>
          ))
        )}
        {['+', '−', '×', '÷'].map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => insert(op)}
            className="bg-muted hover:bg-muted/70 w-6 rounded py-0.5 text-[11px] font-semibold"
          >
            {op}
          </button>
        ))}
      </div>
    </div>
  );
}
