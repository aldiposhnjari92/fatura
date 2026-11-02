import * as React from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/react/table';
import { isNumericField, pickFields } from '@/lib/page-builder';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useBlockContext } from './block-context';
import { FieldGrid, Missing } from './FieldInputs';
import { emptyValues, formatValue, invalidField, missingRequired, saveRecord, storable } from './record-values';
import type { CustomRecord, TableBlock } from '@/models/page-builder';
import type { FormValues } from '@/models/page-builder-ui';

/** The Tabela block: a collection's rows, optionally editable and deletable in place. */
export default function TableView({ block }: { block: TableBlock }) {
  const ctx = useBlockContext();
  const collection = ctx.collection(block.source.collectionId);
  const rows = ctx.rows(block.source.collectionId);
  const columns = pickFields(collection, block.columnIds);
  const allFields = collection?.fields ?? [];
  const [editing, setEditing] = React.useState<{ id: string; values: FormValues } | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<CustomRecord | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!collection) return <Missing what="Tabela" />;

  const canEdit = block.allowEdit;
  const span = columns.length + (canEdit ? 1 : 0);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const missing = missingRequired(allFields, editing.values);
    if (missing) {
      notify.error('Mungon një fushë', `Plotëso "${missing.label}".`);
      return;
    }
    const invalid = invalidField(allFields, editing.values);
    if (invalid) {
      notify.error('Vlerë e pasaktë', `Kontrollo fushën "${invalid.label}".`);
      return;
    }
    setBusy(true);
    try {
      ctx.onSaved(await saveRecord(collection!.id, storable(allFields, editing.values), editing.id));
      setEditing(null);
      notify.success('U ruajt.', 'Ndryshimet u ruajtën.');
    } catch (err) {
      notify.error('Nuk u ruajt', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('custom_records').delete().eq('id', pendingDelete.id);
      if (error) throw error;
      ctx.onDeleted(pendingDelete.id);
      setPendingDelete(null);
      notify.success('U fshi.', 'Rreshti u hoq.');
    } catch (err) {
      notify.error('Nuk u fshi', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 text-left">
      {block.title && <h2 className="text-base font-semibold">{block.title}</h2>}
      <div className="bg-card shadow-card overflow-hidden rounded-2xl">
        {columns.length === 0 ? (
          <p className="text-muted-foreground px-6 py-10 text-center text-sm">
            Koleksioni nuk ka ende fusha.
          </p>
        ) : (
          /*
            The header is always there, rows or not: it is what tells the
            customer what the table is for before the first row exists.
          */
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((field) => (
                    <TableHead key={field.id} className={cn(isNumericField(field) && 'text-right')}>
                      {field.label}
                    </TableHead>
                  ))}
                  {canEdit && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={span} className="text-muted-foreground py-10 text-center">
                      {block.emptyText || 'Nuk ka ende vlera në këtë tabelë.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      {columns.map((field) => (
                        <TableCell
                          key={field.id}
                          className={cn(
                            'max-w-[18rem] truncate',
                            isNumericField(field) && 'text-right tabular-nums',
                            field.type === 'formula' && 'font-medium'
                          )}
                        >
                          {formatValue(field, row.data, allFields)}
                        </TableCell>
                      ))}
                      {canEdit && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Ndrysho rreshtin"
                              disabled={ctx.preview}
                              onClick={() =>
                                setEditing({ id: row.id, values: { ...emptyValues(allFields), ...row.data } })
                              }
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Fshi rreshtin"
                              disabled={ctx.preview}
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setPendingDelete(row)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !busy && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ndrysho rreshtin</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleSave} className="@container grid gap-4">
              <FieldGrid
                fields={allFields}
                allFields={allFields}
                values={editing.values}
                setValues={(values) => setEditing({ ...editing, values })}
                idPrefix={`${block.id}-edit`}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                  Anulo
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />}
                  Ruaj
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && !busy && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta fshijmë këtë rresht?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">Ky veprim nuk kthehet mbrapsht.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={busy}>
              Anulo
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Po, fshije
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
