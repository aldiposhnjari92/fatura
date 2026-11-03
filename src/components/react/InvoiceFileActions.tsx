import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/react/dropdown-menu';
import { useTranslations } from '@/lib/i18n';
import { useInvoiceFiles } from '@/components/react/use-invoice-files';
import type { InvoiceFileActionsProps } from '@/models/invoice';

/*
  What is left to do with an invoice that can no longer be edited: send it, or
  take a copy. Two buttons rather than four — the file formats are one choice
  ("download"), not two competing calls to action.
*/

export default function InvoiceFileActions({ invoiceId, invoiceNumber, allowExcel = true }: InvoiceFileActionsProps) {
  const t = useTranslations();
  const { busy, download, print, excel, share } = useInvoiceFiles(invoiceId, invoiceNumber);
  const downloading = busy === 'download' || busy === 'print' || busy === 'excel';

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        className="rounded-full px-4"
        onClick={() => void share()}
        disabled={busy !== null}
      >
        {busy === 'share' ? <Loader2 className="animate-spin" /> : <Share2 />}
        {t('inv.share')}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="rounded-full px-4" disabled={busy !== null}>
            {downloading ? <Loader2 className="animate-spin" /> : <Download />}
            {t('inv.download')}
            <ChevronDown className="-mr-1 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => void download()} className="items-start">
            <FileText className="mt-0.5" />
            <span className="flex flex-col">
              PDF
              <span className="text-muted-foreground text-xs">{t('inv.downloadPdfDesc')}</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void print()} className="items-start">
            <Printer className="mt-0.5" />
            <span className="flex flex-col">
              {t('inv.print')}
              <span className="text-muted-foreground text-xs">{t('inv.printDesc')}</span>
            </span>
          </DropdownMenuItem>
          {allowExcel && (
            <DropdownMenuItem onSelect={() => void excel()} className="items-start">
              <FileSpreadsheet className="mt-0.5" />
              <span className="flex flex-col">
                Excel
                <span className="text-muted-foreground text-xs">{t('inv.downloadExcelDesc')}</span>
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
