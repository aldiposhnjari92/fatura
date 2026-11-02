import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Database,
  Eye,
  EyeOff,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/react/dropdown-menu';
import { cn } from '@/lib/utils';
import type { PagesBarProps } from '@/models/page-builder-ui';

/** The customer's pages as tabs, with ordering, plus collections and the page's extra actions. */
export default function PagesBar({
  pages,
  selectedPageId,
  draftTitle,
  dirty,
  creating,
  collectionCount,
  onOpen,
  onMove,
  onNew,
  onCollections,
  onPreview,
  onSaveTemplate,
  onCopy,
}: PagesBarProps) {
  return (
    <div className="bg-card shadow-card flex flex-col gap-3 rounded-2xl p-3 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {pages.map((page, i) => (
          <div
            key={page.id}
            className={cn(
              'group flex items-center rounded-lg border transition-colors',
              page.id === selectedPageId ? 'border-primary bg-primary/5' : 'hover:bg-muted'
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(page.id)}
              className="flex items-center gap-2 py-1.5 pr-1 pl-3 text-sm font-medium"
            >
              {page.published ? (
                <Eye className="text-success size-3.5" aria-label="Publikuar" />
              ) : (
                <EyeOff className="text-muted-foreground size-3.5" aria-label="Draft" />
              )}
              {page.id === selectedPageId && draftTitle !== null ? draftTitle || 'Pa titull' : page.title}
              {page.id === selectedPageId && dirty && (
                <span className="bg-warning size-1.5 rounded-full" aria-label="E paruajtur" />
              )}
            </button>
            <span className="flex pr-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                aria-label={`Lëvize ${page.title} para`}
                disabled={i === 0}
                onClick={() => onMove(page.id, -1)}
                className="text-muted-foreground hover:text-foreground rounded p-0.5 disabled:opacity-30"
              >
                <ArrowUp className="size-3.5 -rotate-90" />
              </button>
              <button
                type="button"
                aria-label={`Lëvize ${page.title} pas`}
                disabled={i === pages.length - 1}
                onClick={() => onMove(page.id, 1)}
                className="text-muted-foreground hover:text-foreground rounded p-0.5 disabled:opacity-30"
              >
                <ArrowDown className="size-3.5 -rotate-90" />
              </button>
            </span>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={onNew} disabled={creating}>
          {creating ? <Loader2 className="animate-spin" /> : <Plus />} Faqe e re
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={onCollections}>
          <Database /> Koleksionet ({collectionCount})
        </Button>
        {draftTitle !== null && (
          <>
            <Button variant="outline" size="sm" onClick={onPreview}>
              <Eye /> Parapamje
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-8" aria-label="Më shumë">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onSelect={onSaveTemplate}>
                  <LayoutTemplate /> Ruaj si shabllon
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onCopy}>
                  <CopyPlus /> Kopjo te një klient tjetër
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
