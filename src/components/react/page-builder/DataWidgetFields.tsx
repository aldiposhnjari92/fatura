import { Input } from '@/components/ui/react/input';
import { NumberInput } from '@/components/ui/react/number-input';
import { Field, Segmented, SourcePicker } from './BlockInspector';
import { FieldSelect } from './widget-controls';
import type { WidgetInspectorProps } from '@/models/page-builder-ui';

/*
  Përmbajtja tab for the widgets that read a collection: progress bar and cards.
*/

export default function DataWidgetFields({ block, set, collections, onManageCollections }: WidgetInspectorProps) {
  const collectionOf = (id: string | null) => collections.find((c) => c.id === id);

  switch (block.type) {
    case 'progress':
      return (
        <>
          <Field label="Etiketa">
            <Input value={block.label} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label="Vlera vjen nga">
            <Segmented
              value={block.mode}
              options={[
                { value: 'static', label: 'Përqindje fikse' },
                { value: 'goal', label: 'Objektiv nga të dhënat' },
              ]}
              onChange={(mode) => set({ mode: mode as typeof block.mode })}
            />
          </Field>
          {block.mode === 'static' ? (
            <Field label="Përqindja">
              <input
                type="range"
                min={0}
                max={100}
                value={block.value}
                onChange={(e) => set({ value: Number(e.target.value) })}
                className="accent-primary w-full"
                aria-label="Përqindja"
              />
              <p className="text-muted-foreground text-right text-xs tabular-nums">{block.value}%</p>
            </Field>
          ) : (
            <>
              <SourcePicker
                source={block.source}
                collections={collections}
                onChange={(source) => set({ source, fieldId: null })}
                onManage={onManageCollections}
              />
              <FieldSelect
                label="Fusha që mblidhet"
                collection={collectionOf(block.source.collectionId)}
                value={block.fieldId}
                onChange={(fieldId) => set({ fieldId })}
                numericOnly
              />
              <Field label="Objektivi">
                <NumberInput
                  value={block.target}
                  onValueChange={(target) => set({ target })}
                  decimal
                  className="text-right"
                />
              </Field>
            </>
          )}
        </>
      );

    case 'cards': {
      const collection = collectionOf(block.source.collectionId);
      return (
        <>
          <SourcePicker
            source={block.source}
            collections={collections}
            onChange={(source) =>
              set({ source, titleFieldId: null, subtitleFieldId: null, valueFieldId: null, badgeFieldId: null })
            }
            onManage={onManageCollections}
          />
          <Field label="Titulli i seksionit">
            <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          {collection && (
            <>
              <FieldSelect
                label="Titulli i kartelës"
                collection={collection}
                value={block.titleFieldId}
                onChange={(titleFieldId) => set({ titleFieldId })}
              />
              <FieldSelect
                label="Nëntitulli"
                collection={collection}
                value={block.subtitleFieldId}
                onChange={(subtitleFieldId) => set({ subtitleFieldId })}
                allowNone
              />
              <FieldSelect
                label="Vlera e theksuar"
                collection={collection}
                value={block.valueFieldId}
                onChange={(valueFieldId) => set({ valueFieldId })}
                allowNone
              />
              <FieldSelect
                label="Etiketa"
                collection={collection}
                value={block.badgeFieldId}
                onChange={(badgeFieldId) => set({ badgeFieldId })}
                allowNone
              />
            </>
          )}
          <Field label="Kartela për rresht">
            <Segmented
              value={String(block.perRow)}
              options={[
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4', label: '4' },
              ]}
              onChange={(v) => set({ perRow: Number(v) as 2 | 3 | 4 })}
            />
          </Field>
          <Field label="Mesazhi kur nuk ka të dhëna">
            <Input value={block.emptyText} onChange={(e) => set({ emptyText: e.target.value })} />
          </Field>
        </>
      );
    }

    default:
      return null;
  }
}
