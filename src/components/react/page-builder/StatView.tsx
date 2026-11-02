import { numericValue } from '@/lib/page-builder';
import { groupThousands } from '@/lib/utils';
import { useBlockContext } from './block-context';
import { Missing } from './FieldInputs';
import { formatNumber } from './record-values';
import type { StatBlock } from '@/models/page-builder';

/** The Statistikë block: a count of rows, or the sum of one field over them. */
export default function StatView({ block }: { block: StatBlock }) {
  const ctx = useBlockContext();
  const collection = ctx.collection(block.source.collectionId);
  const rows = ctx.rows(block.source.collectionId);
  if (!collection) return <Missing what="Statistika" />;

  const field = collection.fields.find((f) => f.id === block.fieldId);
  const value =
    block.op === 'sum' && field
      ? formatNumber(
          rows.reduce((sum, r) => sum + (numericValue(field, r.data, collection.fields) ?? 0), 0)
        )
      : groupThousands(rows.length);

  return (
    <div className="bg-card shadow-card rounded-2xl px-5 py-4 text-left">
      <p className="text-muted-foreground text-xs font-medium">{block.label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
