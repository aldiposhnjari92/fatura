import { Input } from '@/components/ui/react/input';
import { Textarea } from '@/components/ui/react/textarea';
import { newId } from '@/lib/page-builder';
import { Field, Segmented } from './BlockInspector';
import ImageUpload from './ImageUpload';
import { Check, IconPicker, ItemList, StarsInput } from './widget-controls';
import type { WidgetInspectorProps } from '@/models/page-builder-ui';

/*
  Përmbajtja tab for the "Bazë" and "Përmbajtje" widgets: image, icon list,
  alert, icon box, tabs, accordion, table of contents, testimonial, rating.
*/

export default function ContentWidgetFields({ block, set }: WidgetInspectorProps) {
  switch (block.type) {
    case 'image':
      return (
        <>
          <ImageUpload src={block.src} onChange={(src) => set({ src })} />
          <Field label="Teksti alternativ (për lexuesit e ekranit)">
            <Input value={block.alt} onChange={(e) => set({ alt: e.target.value })} placeholder="Çfarë tregon imazhi" />
          </Field>
          <Field label="Mbishkrimi">
            <Input value={block.caption} onChange={(e) => set({ caption: e.target.value })} />
          </Field>
          <Field label="Përmasat">
            <Segmented
              value={block.ratio}
              options={[
                { value: 'auto', label: 'Origjinale' },
                { value: '16/9', label: '16:9' },
                { value: '4/3', label: '4:3' },
                { value: '1/1', label: '1:1' },
              ]}
              onChange={(ratio) => set({ ratio: ratio as typeof block.ratio })}
            />
          </Field>
          {block.ratio !== 'auto' && (
            <Field label="Mbushja">
              <Segmented
                value={block.fit}
                options={[
                  { value: 'cover', label: 'Mbulo' },
                  { value: 'contain', label: 'Përshtat' },
                ]}
                onChange={(fit) => set({ fit: fit as typeof block.fit })}
              />
            </Field>
          )}
          <Check label="Qoshe të rrumbullakosura" checked={block.rounded} onChange={(rounded) => set({ rounded })} />
        </>
      );

    case 'iconlist':
      return (
        <>
          <IconPicker value={block.icon} onChange={(icon) => set({ icon })} />
          <ItemList
            label="Pikat"
            items={block.items}
            onChange={(items) => set({ items })}
            create={() => ({ id: newId(), text: 'Pikë e re' })}
            render={(item, update) => (
              <Input value={item.text} onChange={(e) => update({ text: e.target.value })} aria-label="Teksti" />
            )}
          />
        </>
      );

    case 'alert':
      return (
        <>
          <Field label="Lloji">
            <Segmented
              value={block.variant}
              options={[
                { value: 'info', label: 'Info' },
                { value: 'success', label: 'Sukses' },
                { value: 'warning', label: 'Kujdes' },
                { value: 'danger', label: 'Rrezik' },
              ]}
              onChange={(variant) => set({ variant: variant as typeof block.variant })}
            />
          </Field>
          <Field label="Titulli">
            <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Teksti">
            <Textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={3} />
          </Field>
        </>
      );

    case 'iconbox':
      return (
        <>
          <IconPicker value={block.icon} onChange={(icon) => set({ icon })} />
          <Field label="Titulli">
            <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Teksti">
            <Textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={3} />
          </Field>
          <Field label="Pozicioni i ikonës">
            <Segmented
              value={block.layout}
              options={[
                { value: 'top', label: 'Sipër' },
                { value: 'left', label: 'Majtas' },
              ]}
              onChange={(layout) => set({ layout: layout as typeof block.layout })}
            />
          </Field>
        </>
      );

    case 'tabs':
    case 'accordion':
      return (
        <>
          <ItemList
            label={block.type === 'tabs' ? 'Skedat' : 'Elementet'}
            items={block.items}
            onChange={(items) => set({ items })}
            create={() => ({
              id: newId(),
              title: block.type === 'tabs' ? 'Skedë e re' : 'Pyetje e re?',
              text: 'Përmbajtja këtu.',
            })}
            render={(item, update) => (
              <div className="grid gap-1.5">
                <Input value={item.title} onChange={(e) => update({ title: e.target.value })} aria-label="Titulli" />
                <Textarea
                  value={item.text}
                  onChange={(e) => update({ text: e.target.value })}
                  rows={2}
                  aria-label="Përmbajtja"
                />
              </div>
            )}
          />
          {block.type === 'accordion' && (
            <>
              <Check
                label="I pari hapur kur faqja hapet"
                checked={block.firstOpen}
                onChange={(firstOpen) => set({ firstOpen })}
              />
              <Check
                label="Lejo disa të hapur njëkohësisht"
                checked={block.multiple}
                onChange={(multiple) => set({ multiple })}
              />
            </>
          )}
        </>
      );

    case 'toc':
      return (
        <>
          <Field label="Titulli">
            <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Përfshi titujt deri në">
            <Segmented
              value={String(block.depth)}
              options={[
                { value: '2', label: 'Mesatarët' },
                { value: '3', label: 'Të vegjlit' },
              ]}
              onChange={(v) => set({ depth: Number(v) as 2 | 3 })}
            />
          </Field>
          <p className="text-muted-foreground text-[11px]">
            Lista ndërtohet vetë nga elementet “Titull” të kësaj faqeje.
          </p>
        </>
      );

    case 'testimonial':
      return (
        <>
          <Field label="Citati">
            <Textarea value={block.quote} onChange={(e) => set({ quote: e.target.value })} rows={4} />
          </Field>
          <Field label="Autori">
            <Input value={block.author} onChange={(e) => set({ author: e.target.value })} />
          </Field>
          <Field label="Roli / kompania">
            <Input value={block.role} onChange={(e) => set({ role: e.target.value })} />
          </Field>
          <StarsInput value={block.rating} onChange={(rating) => set({ rating })} allowZero />
        </>
      );

    case 'rating':
      return (
        <>
          <Field label="Etiketa">
            <Input value={block.label} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <StarsInput value={block.value} onChange={(value) => set({ value })} />
        </>
      );

    default:
      return null;
  }
}
