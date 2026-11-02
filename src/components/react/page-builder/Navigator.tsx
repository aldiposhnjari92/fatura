import * as React from 'react';
import { EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BLOCK_ICONS, summary } from './builder-config';
import type { Block } from '@/models/page-builder';
import type { NavigatorProps } from '@/models/page-builder-ui';

/** The page as a tree — Elementor's Navigator — for picking what is hard to click. */
export default function Navigator({ blocks, selectedId, onSelect }: NavigatorProps) {
  if (blocks.length === 0) {
    return <p className="text-muted-foreground p-4 text-sm">Faqja është bosh.</p>;
  }
  const row = (block: Block, depth: number, prefix?: string) => {
    const Icon = BLOCK_ICONS[block.type];
    return (
      <button
        key={block.id}
        type="button"
        onClick={() => onSelect(block.id)}
        style={{ paddingLeft: `${12 + depth * 18}px` }}
        className={cn(
          'flex w-full items-center gap-2 py-2 pr-3 text-left text-sm transition-colors',
          block.id === selectedId ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
        )}
      >
        <Icon className="text-muted-foreground size-3.5 shrink-0" />
        {prefix && <span className="text-muted-foreground shrink-0 text-[11px]">{prefix}</span>}
        <span className="truncate">{summary(block)}</span>
        {(block.style?.hideOnMobile || block.style?.hideOnDesktop) && (
          <EyeOff className="text-muted-foreground ml-auto size-3 shrink-0" aria-label="E fshehur në një pajisje" />
        )}
      </button>
    );
  };
  return (
    <div className="py-1">
      {blocks.map((block) =>
        block.type === 'columns' ? (
          <React.Fragment key={block.id}>
            {row(block, 0)}
            {block.columns.map((column, col) => (
              <React.Fragment key={col}>
                <p className="text-muted-foreground py-1 text-[11px]" style={{ paddingLeft: '30px' }}>
                  Kolona {col + 1}
                  {column.length === 0 && ' — bosh'}
                </p>
                {column.map((child) => row(child, 2))}
              </React.Fragment>
            ))}
          </React.Fragment>
        ) : (
          row(block, 0)
        )
      )}
    </div>
  );
}
