import * as React from 'react';
import { Download, FileSpreadsheet, FileUp, Loader2, Sheet } from 'lucide-react';
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
import {
  downloadExcelTemplate,
  existingInvoiceNumbers,
  exportInvoicesToExcel,
  importInvoices,
  parseInvoicesWorkbook,
  type ImportResult,
  type ParsedInvoice,
  type RowProblem,
} from '@/lib/excel';
import { flashToast, notify } from '@/lib/toast';
import { translate, useTranslations } from '@/lib/i18n';
import { startNavProgress } from '@/lib/nav-progress';

/*
  Export and import of the whole invoice list as .xlsx.

  Import is two steps on purpose: the file is read and checked first, and the
  user sees what will happen — how many invoices, which rows were unreadable,
  which numbers already exist — before a single row is written. A spreadsheet
  is the easiest thing in the world to get slightly wrong, and a half-imported
  one is much harder to clean up than one that was never sent.
*/

type Preview = {
  fileName: string;
  ready: ParsedInvoice[];
  duplicates: number;
  problems: RowProblem[];
};

type Phase =
  | { kind: 'closed' }
  | { kind: 'preview'; preview: Preview }
  | { kind: 'importing'; total: number; done: number }
  | { kind: 'result'; result: ImportResult };

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
        {t('xls.problemsTitle', { count: problems.length })}
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
            {t('xls.moreProblems', { count: problems.length - PROBLEMS_SHOWN })}
          </li>
        )}
      </ul>
    </div>
  );
}

export default function InvoiceExcelActions() {
  const t = useTranslations();
  const [busy, setBusy] = React.useState<'export' | 'template' | 'read' | null>(null);
  const [phase, setPhase] = React.useState<Phase>({ kind: 'closed' });
  const fileInput = React.useRef<HTMLInputElement>(null);

  async function handleExport() {
    setBusy('export');
    try {
      const count = await exportInvoicesToExcel(supabase, await currentUserId());
      notify.success(t('xls.exported'), t('xls.exportedDesc', { count }));
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
      const [parsed, existing] = await Promise.all([
        parseInvoicesWorkbook(file),
        currentUserId().then((id) => existingInvoiceNumbers(supabase, id)),
      ]);
      const ready = parsed.invoices.filter((inv) => !existing.has(inv.invoice_number));
      setPhase({
        kind: 'preview',
        preview: {
          fileName: file.name,
          ready,
          duplicates: parsed.invoices.length - ready.length,
          problems: parsed.problems,
        },
      });
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

  async function handleImport(preview: Preview) {
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
          t('xls.importedDesc', { count: result.imported, skipped: result.skipped })
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
        <DialogContent className="sm:max-w-lg">
          {phase.kind === 'preview' && (
            <>
              <DialogHeader>
                <DialogTitle>{t('xls.previewTitle')}</DialogTitle>
                <DialogDescription className="break-all">
                  {phase.preview.fileName}
                </DialogDescription>
              </DialogHeader>

              <ul className="space-y-1 text-sm">
                <li>
                  <span className="font-semibold tabular-nums">{phase.preview.ready.length}</span>{' '}
                  {t('xls.previewReady')}
                </li>
                {phase.preview.duplicates > 0 && (
                  <li className="text-muted-foreground">
                    <span className="font-semibold tabular-nums">{phase.preview.duplicates}</span>{' '}
                    {t('xls.previewDuplicates')}
                  </li>
                )}
              </ul>

              <ProblemList problems={phase.preview.problems} />

              <DialogFooter>
                <Button variant="ghost" onClick={closeDialog}>
                  {t('action.cancel')}
                </Button>
                <Button
                  onClick={() => void handleImport(phase.preview)}
                  disabled={phase.preview.ready.length === 0}
                >
                  {t('xls.importCount', { count: phase.preview.ready.length })}
                </Button>
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
                  {t('xls.importedDesc', {
                    count: phase.result.imported,
                    skipped: phase.result.skipped,
                  })}
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
