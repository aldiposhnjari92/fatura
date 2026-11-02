import * as React from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Info,
  Loader2,
  Sheet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/react/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import { Label } from '@/components/ui/react/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/react/select';
import { IMPORT_FIELDS, columnLetter, columnSample, downloadExcelTemplate, existingInvoiceNumbers, exportInvoicesToExcel, guessMapping, importInvoices, missingFields, parseInvoiceRows, readInvoicesWorkbook, rememberMapping, sheetHeaders } from '@/lib/excel';
import { flashToast, notify } from '@/lib/toast';
import { translate, useTranslations } from '@/lib/i18n';
import { startNavProgress } from '@/lib/nav-progress';
import type { ExcelImportMapping, ExcelImportPhase, ExcelImportPreview, ImportResult, RowProblem } from '@/models/excel';
import type { TranslationKey } from '@/models/i18n';

/*
  Export and import of the whole invoice list as .xlsx.

  Import is two steps on purpose: the file is read and checked first, and the
  user sees what will happen — how many invoices, which rows were unreadable,
  which numbers already exist — before a single row is written. A spreadsheet
  is the easiest thing in the world to get slightly wrong, and a half-imported
  one is much harder to clean up than one that was never sent.

  A file whose headers the guess cannot place — a client's own spreadsheet,
  kept for years before they found us — gets a step before that: the user
  points each field at one of their columns.
*/

/** Albanian has one form for 1 and one for everything else, 0 included. */
function counted(count: number, one: TranslationKey, many: TranslationKey): string {
  return translate(count === 1 ? one : many, { count });
}

/** "2 fatura u shtuan. 1 u anashkalua." — the second half only when something was skipped. */
function importSummary({ imported, skipped }: ImportResult): string {
  const added = counted(imported, 'xls.importedDescOne', 'xls.importedDesc');
  return skipped > 0
    ? `${added} ${counted(skipped, 'xls.skippedDescOne', 'xls.skippedDesc')}`
    : added;
}

/** Shown in full up to this many; past it the user needs to fix the file, not read a list. */
const PROBLEMS_SHOWN = 30;

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(translate('inv.errSessionExpired'));
  return user.id;
}

function ProblemList({ problems }: { problems: RowProblem[] }) {
  const t = useTranslations();
  if (problems.length === 0) return null;
  return (
    <div className="border-destructive/30 bg-destructive/5 rounded-lg border">
      <p className="text-destructive border-destructive/20 border-b px-3 py-2 text-xs font-semibold">
        {counted(problems.length, 'xls.problemsTitleOne', 'xls.problemsTitle')}
      </p>
      <ul className="max-h-48 space-y-1 overflow-y-auto px-3 py-2 text-xs">
        {problems.slice(0, PROBLEMS_SHOWN).map((p, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {t('xls.row', { row: p.row })}
            </span>
            <span className="min-w-0 break-words">{p.message}</span>
          </li>
        ))}
        {problems.length > PROBLEMS_SHOWN && (
          <li className="text-muted-foreground">
            {counted(problems.length - PROBLEMS_SHOWN, 'xls.moreProblemsOne', 'xls.moreProblems')}
          </li>
        )}
      </ul>
    </div>
  );
}

function buildPreview({ source, headerIndex, mapping }: ExcelImportMapping): ExcelImportPreview {
  const parsed = parseInvoiceRows(source.sheet, headerIndex, mapping);
  const ready = parsed.invoices.filter((inv) => !source.existing.has(inv.invoice_number));
  return {
    source,
    headerIndex,
    mapping,
    ready,
    duplicates: parsed.invoices.length - ready.length,
    problems: parsed.problems,
  };
}

/** Radix Select reserves the empty string, so "not imported" needs a value of its own. */
const UNMAPPED = 'none';

function ColumnMapper({
  value,
  onChange,
}: {
  value: ExcelImportMapping;
  onChange: (next: ExcelImportMapping) => void;
}) {
  const t = useTranslations();
  const { source, headerIndex, mapping } = value;
  const headers = sheetHeaders(source.sheet, headerIndex);
  // Columns with neither a header nor anything under it are not worth offering.
  const columns = headers
    .map((header, index) => ({
      index,
      label: header || t('xls.column', { letter: columnLetter(index) }),
      sample: columnSample(source.sheet, headerIndex, index),
    }))
    .filter((c) => headers[c.index] || c.sample);

  function rowLabel(row: number) {
    const preview = sheetHeaders(source.sheet, row).filter(Boolean).slice(0, 3).join(', ');
    return `${t('xls.row', { row: row + 1 })}${preview ? ` — ${preview}` : ''}`;
  }

  return (
    <div className="-mx-1 max-h-[60vh] space-y-4 overflow-y-auto px-1">
      {source.sheet.headerCandidates.length > 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="xls-header-row">{t('xls.mapHeaderRow')}</Label>
          <Select
            value={String(headerIndex)}
            onValueChange={(next) => {
              // A different header row means different names, so guess afresh.
              const row = Number(next);
              onChange({
                source,
                headerIndex: row,
                mapping: guessMapping(source.sheet.rows[row] ?? []),
              });
            }}
          >
            <SelectTrigger id="xls-header-row">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {source.sheet.headerCandidates.map((row) => (
                <SelectItem key={row} value={String(row)}>
                  {rowLabel(row)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {IMPORT_FIELDS.map((field) => {
          const column = mapping[field.key];
          const sample = column === undefined ? '' : columnSample(source.sheet, headerIndex, column);
          return (
            <div key={field.key} className="min-w-0 space-y-1">
              <Label htmlFor={`xls-${field.key}`}>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              <Select
                value={column === undefined ? UNMAPPED : String(column)}
                onValueChange={(next) => {
                  const updated = { ...mapping };
                  if (next === UNMAPPED) delete updated[field.key];
                  else updated[field.key] = Number(next);
                  onChange({ source, headerIndex, mapping: updated });
                }}
              >
                <SelectTrigger id={`xls-${field.key}`} className="h-9 min-h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNMAPPED}>{t('xls.mapNone')}</SelectItem>
                  {columns.map((c) => (
                    <SelectItem key={c.index} value={String(c.index)}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground h-4 truncate text-xs">
                {sample && t('xls.mapSample', { value: sample })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function InvoiceExcelActions() {
  const t = useTranslations();
  const [busy, setBusy] = React.useState<'export' | 'template' | 'read' | null>(null);
  const [phase, setPhase] = React.useState<ExcelImportPhase>({ kind: 'closed' });
  const fileInput = React.useRef<HTMLInputElement>(null);

  async function handleExport() {
    setBusy('export');
    try {
      const count = await exportInvoicesToExcel(supabase, await currentUserId());
      notify.success(t('xls.exported'), counted(count, 'xls.exportedDescOne', 'xls.exportedDesc'));
    } catch (err) {
      notify.error(t('xls.errExport'), (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleTemplate() {
    setBusy('template');
    try {
      await downloadExcelTemplate();
      notify.success(t('xls.templateDownloaded'), t('xls.templateDownloadedDesc'));
    } catch (err) {
      notify.error(t('xls.errExport'), (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again (after fixing it) still fires.
    event.target.value = '';
    if (!file) return;

    setBusy('read');
    try {
      const [sheet, existing] = await Promise.all([
        readInvoicesWorkbook(file),
        currentUserId().then((id) => existingInvoiceNumbers(supabase, id)),
      ]);
      const start: ExcelImportMapping = {
        source: { fileName: file.name, sheet, existing },
        headerIndex: sheet.headerIndex,
        mapping: sheet.mapping,
      };
      // Our own export and anything the guess fully understands go straight
      // to the preview; anything else asks the user first.
      setPhase(
        missingFields(sheet.mapping).length > 0
          ? { kind: 'mapping', ...start }
          : { kind: 'preview', preview: buildPreview(start) }
      );
    } catch (err) {
      notify.error(t('xls.errRead'), (err as Error).message || t('xls.errNotXlsx'));
    } finally {
      setBusy(null);
    }
  }

  function reload() {
    startNavProgress();
    window.location.reload();
  }

  async function handleImport(preview: ExcelImportPreview) {
    setPhase({ kind: 'importing', total: preview.ready.length, done: 0 });
    try {
      const result = await importInvoices(
        supabase,
        await currentUserId(),
        preview.ready,
        (done) => setPhase({ kind: 'importing', total: preview.ready.length, done })
      );
      result.skipped += preview.duplicates;

      // A clean run has nothing left to say that a toast cannot; the list
      // behind the dialog is stale, so it goes straight to the fresh one.
      if (result.failed.length === 0 && !result.quotaReached) {
        flashToast(
          'success',
          t('xls.imported'),
          importSummary(result)
        );
        reload();
        return;
      }
      setPhase({ kind: 'result', result });
    } catch (err) {
      notify.error(t('xls.errImport'), (err as Error).message);
      setPhase({ kind: 'closed' });
    }
  }

  function applyMapping(value: ExcelImportMapping) {
    rememberMapping(sheetHeaders(value.source.sheet, value.headerIndex), value.mapping);
    setPhase({ kind: 'preview', preview: buildPreview(value) });
  }

  function closeDialog() {
    if (phase.kind === 'importing') return;
    if (phase.kind === 'result' && phase.result.imported > 0) {
      reload();
      return;
    }
    setPhase({ kind: 'closed' });
  }

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFile}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="rounded-full px-4" disabled={busy !== null}>
            {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            Excel
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => void handleExport()}>
            <Download /> {t('xls.export')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
            <FileUp /> {t('xls.import')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void handleTemplate()}>
            <Sheet /> {t('xls.template')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={phase.kind !== 'closed'} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent className={phase.kind === 'mapping' ? 'sm:max-w-2xl' : 'sm:max-w-lg'}>
          {phase.kind === 'mapping' && (() => {
            const missing = missingFields(phase.mapping);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{t('xls.mapTitle')}</DialogTitle>
                  <DialogDescription>
                    <span className="block break-all font-medium">{phase.source.fileName}</span>
                    {t('xls.mapDesc')} {t('xls.mapItemHint')}
                  </DialogDescription>
                </DialogHeader>

                <ColumnMapper
                  value={phase}
                  onChange={(next) => setPhase({ kind: 'mapping', ...next })}
                />

                <p className="text-muted-foreground text-xs">
                  {missing.length > 0 ? (
                    <span className="text-destructive">
                      {t('xls.mapMissing', { fields: missing.map((f) => f.label).join(', ') })}
                    </span>
                  ) : (
                    t('xls.mapRemembered')
                  )}
                </p>

                <DialogFooter>
                  <Button variant="ghost" onClick={closeDialog}>
                    {t('action.cancel')}
                  </Button>
                  <Button onClick={() => applyMapping(phase)} disabled={missing.length > 0}>
                    {t('xls.mapContinue')}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}

          {phase.kind === 'preview' && (
            <>
              <DialogHeader>
                <DialogTitle>{t('xls.previewTitle')}</DialogTitle>
                <DialogDescription className="break-all">
                  {phase.preview.source.fileName}
                </DialogDescription>
              </DialogHeader>

              {phase.preview.ready.length === 0 ? (
                // Nothing to do: say so in words, not with a "0" and a dead button.
                <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm">
                  <p className="font-semibold">{t('xls.nothingToImport')}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {phase.preview.problems.length > 0
                      ? t('xls.nothingToImportFix')
                      : t('xls.nothingToImportDuplicates')}
                  </p>
                </div>
              ) : (
                <p className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="font-semibold tabular-nums">
                      {phase.preview.ready.length}
                    </span>{' '}
                    {t(
                      phase.preview.ready.length === 1
                        ? 'xls.previewReadyOne'
                        : 'xls.previewReady'
                    )}
                  </span>
                </p>
              )}

              {phase.preview.duplicates > 0 && (
                <p className="text-muted-foreground flex items-start gap-2 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {/* "Kjo faturë…" already says how many, so the singular drops the number. */}
                    {phase.preview.duplicates === 1 ? (
                      t('xls.previewDuplicatesOne')
                    ) : (
                      <>
                        <span className="font-semibold tabular-nums">
                          {phase.preview.duplicates}
                        </span>{' '}
                        {t('xls.previewDuplicates')}
                      </>
                    )}
                  </span>
                </p>
              )}

              <ProblemList problems={phase.preview.problems} />

              <DialogFooter>
                {/* Remapping only helps when rows failed to read; duplicates are not a column problem. */}
                {phase.preview.problems.length > 0 && (
                  <Button
                    variant="outline"
                    className="sm:mr-auto"
                    onClick={() => {
                      const { source, headerIndex, mapping } = phase.preview;
                      setPhase({ kind: 'mapping', source, headerIndex, mapping });
                    }}
                  >
                    {t('xls.mapEdit')}
                  </Button>
                )}
                {phase.preview.ready.length === 0 ? (
                  <>
                    <Button variant="ghost" onClick={closeDialog}>
                      {t('action.close')}
                    </Button>
                    <Button
                      onClick={() => {
                        setPhase({ kind: 'closed' });
                        fileInput.current?.click();
                      }}
                    >
                      <FileUp /> {t('xls.chooseAnother')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={closeDialog}>
                      {t('action.cancel')}
                    </Button>
                    <Button onClick={() => void handleImport(phase.preview)}>
                      {counted(phase.preview.ready.length, 'xls.importCountOne', 'xls.importCount')}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}

          {phase.kind === 'importing' && (
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> {t('xls.importing')}
              </DialogTitle>
              <DialogDescription className="tabular-nums">
                {phase.done} / {phase.total}
              </DialogDescription>
            </DialogHeader>
          )}

          {phase.kind === 'result' && (
            <>
              <DialogHeader>
                <DialogTitle>{t('xls.resultTitle')}</DialogTitle>
                <DialogDescription>
                  {importSummary(phase.result)}
                </DialogDescription>
              </DialogHeader>
              {phase.result.quotaReached && (
                <p className="border-warning/40 bg-warning/10 rounded-lg border px-3 py-2 text-sm">
                  {t('xls.quotaReached')}
                </p>
              )}
              <ProblemList problems={phase.result.failed} />
              <DialogFooter>
                <Button onClick={closeDialog}>{t('action.close')}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
