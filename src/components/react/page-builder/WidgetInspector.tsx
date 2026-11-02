import * as React from 'react';
import { ArrowDown, ArrowUp, ImageUp, Loader2, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { NumberInput } from '@/components/ui/react/number-input';
import { Textarea } from '@/components/ui/react/textarea';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { WIDGET_ICONS, isNumericField, newId, safeHref, safeImageSrc } from '@/lib/page-builder';
import { Field, Segmented, SourcePicker } from './BlockInspector';
import { WIDGET_ICON_COMPONENTS } from './icons';
import type { CustomCollection, LeafBlock, WidgetIcon } from '@/models/page-builder';
import type { WidgetInspectorProps } from '@/models/page-builder-ui';

/*
  Përmbajtja tab for the richer widgets (see Widgets.tsx). Split from
  BlockInspector so neither file is a wall of switch cases.
*/

export const WIDGET_TYPES = new Set<LeafBlock['type']>([
  'image',
  'iconlist',
  'alert',
  'iconbox',
  'tabs',
  'accordion',
  'toc',
  'testimonial',
  'rating',
  'pricetable',
  'pricelist',
  'cta',
  'flipbox',
  'countdown',
  'progress',
  'cards',
]);

export default function WidgetInspector({ block, set, collections, onManageCollections }: WidgetInspectorProps) {
  const collectionOf = (id: string | null) => collections.find((c) => c.id === id);

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

// ---- Controls ---------------------------------------------------------------------

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary size-4"
      />
      {label}
    </label>
  );
}

function IconPicker({ value, onChange }: { value: WidgetIcon; onChange: (icon: WidgetIcon) => void }) {
  return (
    <Field label="Ikona">
      <div className="grid grid-cols-6 gap-1">
        {WIDGET_ICONS.map((name) => {
          const Icon = WIDGET_ICON_COMPONENTS[name];
          return (
            <button
              key={name}
              type="button"
              aria-label={name}
              title={name}
              aria-pressed={value === name}
              onClick={() => onChange(name)}
              className={cn(
                'grid aspect-square place-items-center rounded-md border transition-colors',
                value === name ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function StarsInput({
  value,
  onChange,
  allowZero = false,
}: {
  value: number;
  onChange: (value: number) => void;
  allowZero?: boolean;
}) {
  return (
    <Field label={`Yjet: ${value}/5`}>
      <input
        type="range"
        min={allowZero ? 0 : 0.5}
        max={5}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary w-full"
        aria-label="Yjet"
      />
    </Field>
  );
}

function LinkFields({
  label,
  href,
  onChange,
}: {
  label: string;
  href: string;
  onChange: (label: string, href: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Teksti i butonit">
        <Input value={label} onChange={(e) => onChange(e.target.value, href)} />
      </Field>
      <Field label="Lidhja">
        <Input value={href} onChange={(e) => onChange(label, e.target.value)} placeholder="/app/…" />
      </Field>
      {label && !safeHref(href) && (
        <p className="text-destructive col-span-2 text-xs">Lidhja duhet të fillojë me / ose https://</p>
      )}
    </div>
  );
}

function FieldSelect({
  label,
  collection,
  value,
  onChange,
  numericOnly = false,
  allowNone = false,
}: {
  label: string;
  collection: CustomCollection | undefined;
  value: string | null;
  onChange: (id: string | null) => void;
  numericOnly?: boolean;
  allowNone?: boolean;
}) {
  const fields = (collection?.fields ?? []).filter((f) => !numericOnly || isNumericField(f));
  return (
    <Field label={label}>
      <SearchableSelect
        value={value ?? ''}
        onValueChange={(v) => onChange(v === '__none' ? null : v)}
        placeholder={allowNone ? 'Asnjë' : 'Zgjidh fushën'}
        searchPlaceholder="Kërko…"
        emptyText={numericOnly ? 'Koleksioni nuk ka fusha numri' : 'Koleksioni nuk ka fusha'}
        searchThreshold={8}
        options={[
          ...(allowNone ? [{ value: '__none', label: 'Asnjë' }] : []),
          ...fields.map((f) => ({ value: f.id, label: f.label })),
        ]}
      />
    </Field>
  );
}

/*
  A list of items with add, remove and reorder — the repeater every list-shaped
  widget uses (tabs, accordion, icon list, price features, price list).
*/
function ItemList<T extends { id: string }>({
  label,
  items,
  onChange,
  create,
  render,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  const list = Array.isArray(items) ? items : [];
  const move = (i: number, by: -1 | 1) => {
    const next = [...list];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <Field label={label}>
      <div className="grid gap-2">
        {list.map((item, i) => (
          <div key={item.id} className="grid grid-cols-[1fr_auto] items-start gap-1 rounded-lg border p-2">
            {render(item, (patch) => onChange(list.map((x) => (x.id === item.id ? { ...x, ...patch } : x))))}
            <div className="flex flex-col">
              <MiniButton label="Lart" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </MiniButton>
              <MiniButton label="Poshtë" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown />
              </MiniButton>
              <MiniButton label="Hiq" danger onClick={() => onChange(list.filter((x) => x.id !== item.id))}>
                <X />
              </MiniButton>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => onChange([...list, create()])}
        >
          <Plus /> Shto
        </Button>
      </div>
    </Field>
  );
}

function MiniButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-muted-foreground rounded p-1 disabled:opacity-30 [&_svg]:size-3.5',
        danger ? 'hover:text-destructive' : 'hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Uploads into the page-assets bucket — the only place a page's images may come from. */
function ImageUpload({ src, onChange }: { src: string; onChange: (src: string) => void }) {
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const shown = safeImageSrc(src);

  async function upload(file: File) {
    if (!TYPES.includes(file.type)) {
      notify.error('Format i pambështetur', 'Përdor PNG, JPG, WebP ose GIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      notify.error('Imazhi është shumë i madh', 'Maksimumi është 3 MB.');
      return;
    }
    setBusy(true);
    try {
      const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
      const path = `pages/${newId()}${newId()}.${ext}`;
      const { error } = await supabase.storage
        .from('page-assets')
        .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
      if (error) throw error;
      onChange(supabase.storage.from('page-assets').getPublicUrl(path).data.publicUrl);
    } catch (err) {
      notify.error('Ngarkimi dështoi', (err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <Field label="Imazhi">
      {shown && <img src={shown} alt="" className="max-h-40 w-full rounded-lg border object-contain" />}
      <input
        ref={input}
        type="file"
        accept={TYPES.join(',')}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <ImageUp />}
          {shown ? 'Ndrysho imazhin' : 'Ngarko imazh'}
        </Button>
        {shown && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
            Hiqe
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-[11px]">PNG, JPG, WebP ose GIF, deri 3 MB.</p>
    </Field>
  );
}
