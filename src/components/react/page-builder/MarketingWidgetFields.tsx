import { Input } from '@/components/ui/react/input';
import { Textarea } from '@/components/ui/react/textarea';
import { newId } from '@/lib/page-builder';
import { Field, Segmented } from './BlockInspector';
import { Check, IconPicker, ItemList, LinkFields } from './widget-controls';
import type { WidgetInspectorProps } from '@/models/page-builder-ui';

/*
  Përmbajtja tab for the "Marketing" widgets: price table, price list,
  call to action, flip box, countdown.
*/

export default function MarketingWidgetFields({ block, set }: WidgetInspectorProps) {
  switch (block.type) {
    case 'pricetable':
      return (
        <>
          <Field label="Emri i paketës">
            <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Çmimi">
              <Input value={block.price} onChange={(e) => set({ price: e.target.value })} />
            </Field>
            <Field label="Periudha">
              <Input value={block.period} onChange={(e) => set({ period: e.target.value })} placeholder="në muaj" />
            </Field>
          </div>
          <ItemList
            label="Veçoritë"
            items={block.features}
            onChange={(features) => set({ features })}
            create={() => ({ id: newId(), text: 'Veçori e re', included: true })}
            render={(item, update) => (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.included}
                  onChange={(e) => update({ included: e.target.checked })}
                  aria-label="E përfshirë"
                  className="accent-primary size-4 shrink-0"
                />
                <Input value={item.text} onChange={(e) => update({ text: e.target.value })} aria-label="Veçoria" />
              </div>
            )}
          />
          <LinkFields
            label={block.buttonLabel}
            href={block.buttonHref}
            onChange={(buttonLabel, buttonHref) => set({ buttonLabel, buttonHref })}
          />
          <Check label="E theksuar (paketa e rekomanduar)" checked={block.featured} onChange={(featured) => set({ featured })} />
          <Field label="Etiketa sipër (opsionale)">
            <Input value={block.badge} onChange={(e) => set({ badge: e.target.value })} placeholder="p.sh. Më e zgjedhura" />
          </Field>
        </>
      );

    case 'pricelist':
      return (
        <ItemList
          label="Artikujt"
          items={block.items}
          onChange={(items) => set({ items })}
          create={() => ({ id: newId(), text: 'Artikull i ri', description: '', price: '0 Lekë' })}
          render={(item, update) => (
            <div className="grid gap-1.5">
              <div className="grid grid-cols-[1fr_110px] gap-1.5">
                <Input value={item.text} onChange={(e) => update({ text: e.target.value })} aria-label="Emri" />
                <Input value={item.price} onChange={(e) => update({ price: e.target.value })} aria-label="Çmimi" />
              </div>
              <Input
                value={item.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Përshkrimi (opsional)"
                aria-label="Përshkrimi"
              />
            </div>
          )}
        />
      );

    case 'cta':
      return (
        <>
          <Field label="Titulli">
            <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Teksti">
            <Textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={2} />
          </Field>
          <LinkFields
            label={block.buttonLabel}
            href={block.buttonHref}
            onChange={(buttonLabel, buttonHref) => set({ buttonLabel, buttonHref })}
          />
          <Field label="Ngjyra">
            <Segmented
              value={block.tone}
              options={[
                { value: 'brand', label: 'Marka' },
                { value: 'dark', label: 'E errët' },
                { value: 'light', label: 'E çelët' },
              ]}
              onChange={(tone) => set({ tone: tone as typeof block.tone })}
            />
          </Field>
        </>
      );

    case 'flipbox':
      return (
        <>
          <p className="text-muted-foreground text-[11px] font-bold tracking-[0.12em] uppercase">Ana e parë</p>
          <IconPicker value={block.icon} onChange={(icon) => set({ icon })} />
          <Field label="Titulli">
            <Input value={block.frontTitle} onChange={(e) => set({ frontTitle: e.target.value })} />
          </Field>
          <Field label="Teksti">
            <Input value={block.frontText} onChange={(e) => set({ frontText: e.target.value })} />
          </Field>
          <p className="text-muted-foreground mt-2 text-[11px] font-bold tracking-[0.12em] uppercase">Ana e pasme</p>
          <Field label="Titulli">
            <Input value={block.backTitle} onChange={(e) => set({ backTitle: e.target.value })} />
          </Field>
          <Field label="Teksti">
            <Textarea value={block.backText} onChange={(e) => set({ backText: e.target.value })} rows={2} />
          </Field>
          <LinkFields
            label={block.buttonLabel}
            href={block.buttonHref}
            onChange={(buttonLabel, buttonHref) => set({ buttonLabel, buttonHref })}
          />
          <p className="text-muted-foreground text-[11px]">
            Në faqe kthehet kur kalon miun ose e prek. Në redaktues shfaqet ana e parë.
          </p>
        </>
      );

    case 'countdown':
      return (
        <>
          <Field label="Titulli">
            <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Data dhe ora e afatit">
            <Input
              type="datetime-local"
              value={block.target}
              onChange={(e) => set({ target: e.target.value })}
            />
          </Field>
          <Field label="Teksti pasi kalon afati">
            <Input value={block.doneText} onChange={(e) => set({ doneText: e.target.value })} />
          </Field>
        </>
      );

    default:
      return null;
  }
}
