import { Search } from 'lucide-react';
import { Input } from '@/components/ui/react/input';
import { BLOCK_TYPES, FIELD_PALETTE } from '@/lib/page-builder';
import { BLOCK_ICONS, FIELD_ICONS, PALETTE_GROUPS } from './builder-config';
import type { WidgetPaletteProps } from '@/models/page-builder-ui';

const TILE =
  'hover:border-primary hover:text-primary flex aspect-square cursor-grab flex-col items-center justify-center gap-2 rounded-lg border p-2 text-center transition-colors active:cursor-grabbing';

/** The element grid: search, then one tile per block, grouped. Drag a tile or click it. */
export default function WidgetPalette({
  search,
  onSearch,
  hasInsertTarget,
  onAdd,
  onDragStart,
  onDragEnd,
}: WidgetPaletteProps) {
  const q = search.trim().toLowerCase();
  const visiblePalette = BLOCK_TYPES.filter((b) => b.type !== 'field' && (!q || b.label.toLowerCase().includes(q)));
  const visibleFields = FIELD_PALETTE.filter((f) => !q || f.label.toLowerCase().includes(q) || 'fushë'.includes(q));

  return (
    <div className="grid gap-4 p-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Kërko element…"
          className="pl-8"
        />
      </div>
      {PALETTE_GROUPS.map((group) => {
        const items = visiblePalette.filter((b) => b.group === group);
        const fieldTiles = group === 'Fushat e formularit' ? visibleFields : [];
        if (items.length === 0 && fieldTiles.length === 0) return null;
        return (
          <div key={group}>
            <p className="text-muted-foreground mb-2 text-[11px] font-bold tracking-[0.12em] uppercase">
              {group}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {fieldTiles.map((f) => {
                const Icon = FIELD_ICONS[f.kind];
                return (
                  <button
                    key={f.kind}
                    type="button"
                    draggable
                    onDragStart={(e) => onDragStart(e, { kind: 'new', type: 'field', fieldKind: f.kind })}
                    onDragEnd={onDragEnd}
                    onClick={() => onAdd('field', f.kind)}
                    title="Fushë formulari — tërhiqe ose kliko, pastaj lidhe me koleksionin"
                    className={TILE}
                  >
                    <Icon className="size-5" />
                    <span className="text-[11px] leading-tight font-medium">{f.label}</span>
                  </button>
                );
              })}
              {items.map((b) => {
                const Icon = BLOCK_ICONS[b.type];
                return (
                  <button
                    key={b.type}
                    type="button"
                    draggable
                    onDragStart={(e) => onDragStart(e, { kind: 'new', type: b.type })}
                    onDragEnd={onDragEnd}
                    onClick={() => onAdd(b.type)}
                    title={`${b.description} — tërhiqe ose kliko`}
                    className={TILE}
                  >
                    <Icon className="size-5" />
                    <span className="text-[11px] leading-tight font-medium">{b.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-muted-foreground text-[11px] leading-snug">
        Tërhiqe një element mbi faqe ose brenda një kolone. Me klik shtohet{' '}
        {hasInsertTarget ? 'te vendi i zgjedhur' : 'në fund të faqes'}.
      </p>
    </div>
  );
}
