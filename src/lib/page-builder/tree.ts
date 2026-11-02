import { COLUMN_COUNTS, flattenBlocks, newId } from './blocks';
import type { Block, ColumnsBlock, ColumnsLayout, Container, LeafBlock } from '@/models/page-builder';

// ---- Tree editing (pure; the editor's every change goes through these) ---

export const ROOT: Container = { kind: 'root' };

export function sameContainer(a: Container, b: Container) {
  return a.kind === 'root'
    ? b.kind === 'root'
    : b.kind === 'column' && a.blockId === b.blockId && a.col === b.col;
}

export function findBlock(blocks: Block[], id: string): Block | undefined {
  return flattenBlocks(blocks).find((b) => b.id === id);
}

/** The container a block sits in and its index there. */
export function locate(blocks: Block[], id: string): { container: Container; index: number } | null {
  const top = blocks.findIndex((b) => b.id === id);
  if (top !== -1) return { container: ROOT, index: top };
  for (const b of blocks) {
    if (b.type !== 'columns') continue;
    for (let col = 0; col < b.columns.length; col += 1) {
      const index = b.columns[col].findIndex((c) => c.id === id);
      if (index !== -1) return { container: { kind: 'column', blockId: b.id, col }, index };
    }
  }
  return null;
}

export function childrenOf(blocks: Block[], container: Container): Block[] {
  if (container.kind === 'root') return blocks;
  const parent = blocks.find((b) => b.id === container.blockId);
  return parent?.type === 'columns' ? (parent.columns[container.col] ?? []) : [];
}

function withChildren(blocks: Block[], container: Container, children: Block[]): Block[] {
  if (container.kind === 'root') return children;
  return blocks.map((b) =>
    b.id === container.blockId && b.type === 'columns'
      ? {
          ...b,
          columns: b.columns.map((col, i) =>
            i === container.col ? (children.filter((c) => c.type !== 'columns') as LeafBlock[]) : col
          ),
        }
      : b
  );
}

export function insertAt(blocks: Block[], container: Container, index: number, block: Block): Block[] {
  // Columns inside a column would be a second level; it goes in after the parent instead.
  if (block.type === 'columns' && container.kind === 'column') {
    const at = blocks.findIndex((b) => b.id === container.blockId);
    return insertAt(blocks, ROOT, at + 1, block);
  }
  const children = [...childrenOf(blocks, container)];
  children.splice(Math.max(0, Math.min(index, children.length)), 0, block);
  return withChildren(blocks, container, children);
}

export function removeBlock(blocks: Block[], id: string): Block[] {
  const where = locate(blocks, id);
  if (!where) return blocks;
  const children = childrenOf(blocks, where.container).filter((b) => b.id !== id);
  return withChildren(blocks, where.container, children);
}

export function replaceBlock(blocks: Block[], updated: Block): Block[] {
  const where = locate(blocks, updated.id);
  if (!where) return blocks;
  const children = childrenOf(blocks, where.container).map((b) => (b.id === updated.id ? updated : b));
  return withChildren(blocks, where.container, children);
}

/** Move a block to `index` in `to` — the index as it reads before the move. */
export function moveBlock(blocks: Block[], id: string, to: Container, index: number): Block[] {
  const where = locate(blocks, id);
  const block = findBlock(blocks, id);
  if (!where || !block) return blocks;
  // A columns block cannot be dropped into its own columns.
  if (to.kind === 'column' && to.blockId === id) return blocks;
  let at = index;
  if (sameContainer(where.container, to)) {
    if (at === where.index || at === where.index + 1) return blocks;
    if (at > where.index) at -= 1;
  }
  return insertAt(removeBlock(blocks, id), to, at, block);
}

/** A deep copy with fresh ids, so a duplicate never shares an id with its source. */
export function cloneBlock(block: Block): Block {
  if (block.type === 'columns') {
    return {
      ...block,
      id: newId(),
      columns: block.columns.map((col) => col.map((c) => cloneBlock(c) as LeafBlock)),
    };
  }
  return { ...structuredClone(block), id: newId() };
}

/** A layout change keeps every child: a dropped column's blocks join the last kept one. */
export function setColumnsLayout(block: ColumnsBlock, layout: ColumnsLayout): ColumnsBlock {
  const count = COLUMN_COUNTS[layout];
  const columns = Array.from({ length: count }, (_, i) => [...(block.columns[i] ?? [])]);
  for (let i = count; i < block.columns.length; i += 1) columns[count - 1].push(...block.columns[i]);
  return { ...block, layout, columns };
}
