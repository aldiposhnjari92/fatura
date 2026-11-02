import * as React from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { COLUMN_GRID, ROOT, childrenOf, sameContainer, styleClasses } from '@/lib/page-builder';
import { cn } from '@/lib/utils';
import { BlockContextProvider } from './block-context';
import { BlockView } from './PageBlocks';
import { ToolButton } from './BuilderButtons';
import { BLOCK_ICONS, BLOCK_LABEL, DEVICE_WIDTH } from './builder-config';
import type { Block, Container, LeafBlock } from '@/models/page-builder';
import type { BuilderCanvasProps, DropTarget } from '@/models/page-builder-ui';

/**
 * The page itself, drawn by the same components the customer's page uses, with
 * interaction switched off. Click to select; drag to move; drop elements from
 * the panel between blocks or into a column. The canvas is a container, so the
 * phone preview stacks columns and hides elements exactly as a phone will.
 */
export default function BuilderCanvas({
  title,
  blocks,
  device,
  context,
  selectedId,
  insertTarget,
  dropTarget,
  onSelect,
  onPickInsert,
  onDragStart,
  onDragEnd,
  onDragOverBlock,
  onDragOverEmpty,
  onDragOverCanvas,
  onDrop,
  onNudge,
  onDuplicate,
  onDelete,
}: BuilderCanvasProps) {
  const isDropAt = (container: Container, index: number) =>
    !!dropTarget && sameContainer(dropTarget.container, container) && dropTarget.index === index;

  // Plain render functions, not components: a component declared in here would
  // be a new type every render, remounting the canvas — and cancelling a drag.
  function dropLine(container: Container, index: number) {
    return (
      <div
        className={cn(
          'h-1 rounded-full transition-colors',
          isDropAt(container, index) ? 'bg-primary' : 'bg-transparent'
        )}
      />
    );
  }

  function addHere(target: DropTarget, label: string) {
    const active =
      insertTarget &&
      sameContainer(insertTarget.container, target.container) &&
      insertTarget.index === target.index;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPickInsert(target);
        }}
        className={cn(
          'text-muted-foreground hover:border-primary hover:text-primary flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-xs font-medium transition-colors',
          active && 'border-primary bg-primary/5 text-primary'
        )}
      >
        <Plus className="size-3.5" /> {label}
      </button>
    );
  }

  /** The selection frame every block gets on the canvas: outline, tag and toolbar. */
  function frame(block: Block, container: Container, index: number, children: React.ReactNode) {
    const isSelected = block.id === selectedId;
    const Icon = BLOCK_ICONS[block.type];
    return (
      <div
        key={block.id}
        draggable
        onDragStart={(e) => onDragStart(e, { kind: 'move', id: block.id })}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOverBlock(e, container, index)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(block.id);
        }}
        className={cn(
          'group/frame relative cursor-pointer rounded-md outline-2 -outline-offset-2 transition-[outline-color]',
          isSelected
            ? 'outline-primary outline'
            : 'outline-transparent hover:outline hover:outline-dashed hover:outline-primary/50'
        )}
      >
        {/* Elementor's tab: the element's name, and the handle to drag it by. */}
        <div
          className={cn(
            'bg-primary text-primary-foreground absolute -top-6 left-0 z-10 items-center gap-1 rounded-t-md px-1.5 py-0.5 text-[11px] font-medium',
            isSelected ? 'flex' : 'hidden group-hover/frame:flex'
          )}
        >
          <GripVertical className="size-3 cursor-grab" aria-hidden />
          <Icon className="size-3" aria-hidden />
          {BLOCK_LABEL[block.type]}
        </div>
        <div
          className={cn(
            'bg-background absolute -top-6 right-0 z-10 items-center gap-0.5 rounded-t-md border border-b-0 px-1',
            isSelected ? 'flex' : 'hidden group-hover/frame:flex'
          )}
        >
          <ToolButton label="Lart" onClick={() => onNudge(block.id, -1)} disabled={index === 0}>
            <ArrowUp />
          </ToolButton>
          <ToolButton
            label="Poshtë"
            onClick={() => onNudge(block.id, 1)}
            disabled={index === childrenOf(blocks, container).length - 1}
          >
            <ArrowDown />
          </ToolButton>
          <ToolButton label="Dyfisho" onClick={() => onDuplicate(block.id)}>
            <Copy />
          </ToolButton>
          <ToolButton label="Fshi" danger onClick={() => onDelete(block.id)}>
            <Trash2 />
          </ToolButton>
        </div>
        {children}
      </div>
    );
  }

  function leaf(block: LeafBlock, container: Container, index: number) {
    return frame(
      block,
      container,
      index,
      // Interaction is off in the editor: clicks select, they do not type.
      <div className={cn('pointer-events-none select-none', styleClasses(block.style))} aria-hidden>
        <BlockView block={block} />
      </div>
    );
  }

  function section(block: Extract<Block, { type: 'columns' }>, index: number) {
    return frame(
      block,
      ROOT,
      index,
      <div className={cn('grid gap-5 p-1', COLUMN_GRID[block.layout], styleClasses(block.style))}>
        {block.columns.map((column, col) => {
          const container: Container = { kind: 'column', blockId: block.id, col };
          return (
            <div
              key={col}
              onDragOver={(e) => onDragOverEmpty(e, container, column.length)}
              className="border-muted-foreground/25 flex min-w-0 flex-col gap-1 rounded-md border border-dashed p-2"
            >
              {column.map((child, i) => (
                <React.Fragment key={child.id}>
                  {dropLine(container, i)}
                  {leaf(child, container, i)}
                </React.Fragment>
              ))}
              {dropLine(container, column.length)}
              {addHere({ container, index: column.length }, 'Shto')}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section
      className="bg-muted/40 min-h-[560px] overflow-x-auto rounded-2xl border p-4 sm:p-6"
      onClick={() => onSelect(null)}
      onDragOver={onDragOverCanvas}
      onDrop={onDrop}
    >
      <div
        className={cn(
          'bg-background mx-auto rounded-xl p-4 shadow-sm transition-[max-width] duration-300 sm:p-6',
          DEVICE_WIDTH[device]
        )}
      >
        <BlockContextProvider value={context}>
          <div className="@container">
            <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>

            {blocks.length === 0 ? (
              <div
                onDragOver={(e) => onDragOverEmpty(e, ROOT, 0)}
                className={cn(
                  'text-muted-foreground grid place-items-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center text-sm transition-colors',
                  isDropAt(ROOT, 0) && 'border-primary bg-primary/5 text-primary'
                )}
              >
                <p>Tërhiq elementin e parë këtu, ose</p>
                <div className="w-48">{addHere({ container: ROOT, index: 0 }, 'Shto element')}</div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {blocks.map((block, index) => (
                  <React.Fragment key={block.id}>
                    {dropLine(ROOT, index)}
                    <div className="pt-5">
                      {block.type === 'columns' ? section(block, index) : leaf(block, ROOT, index)}
                    </div>
                  </React.Fragment>
                ))}
                {dropLine(ROOT, blocks.length)}
                <div className="pt-4" onDragOver={(e) => onDragOverEmpty(e, ROOT, blocks.length)}>
                  {addHere({ container: ROOT, index: blocks.length }, 'Shto element')}
                </div>
              </div>
            )}
          </div>
        </BlockContextProvider>
      </div>
    </section>
  );
}
