import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ImageIcon,
  Info,
  Quote,
  Star,
  StarHalf,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { cn, groupThousands } from '@/lib/utils';
import {
  flattenBlocks,
  headingAnchor,
  numericValue,
  safeHref,
  safeImageSrc,
  type AccordionBlock,
  type AlertBlock,
  type Block,
  type CardsBlock,
  type CollectionField,
  type CountdownBlock,
  type CtaBlock,
  type CustomCollection,
  type CustomRecord,
  type FlipBoxBlock,
  type IconBoxBlock,
  type IconListBlock,
  type ImageBlock,
  type PriceListBlock,
  type PriceTableBlock,
  type ProgressBlock,
  type RatingBlock,
  type TabsBlock,
  type TestimonialBlock,
  type TocBlock,
} from '@/lib/page-builder';
import { widgetIcon } from './icons';

/*
  The page builder's richer widgets — this app's own versions of what page
  builders like Elementor Pro offer. Every one renders text as text, links
  through safeHref() and images through safeImageSrc(); none of them can put
  markup, script or a third-party frame on a customer's page.

  `preview` is true on the editor canvas: links do not navigate there, and
  interactive widgets still respond so the admin can see their states.
*/

const asArray = <T,>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);

/** A link-or-not button: live on the page, inert in the editor. */
function LinkButton({
  label,
  href,
  preview,
  variant = 'default',
  className,
}: {
  label: string;
  href: string;
  preview: boolean;
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
}) {
  if (!label) return null;
  const safe = safeHref(href);
  const external = safe?.startsWith('http');
  const live = !!safe && !preview;
  return (
    <Button asChild={live} variant={variant} disabled={!safe} className={className}>
      {live ? (
        <a href={safe!} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {label}
        </a>
      ) : (
        <span>{label}</span>
      )}
    </Button>
  );
}

// ---- Bazë -------------------------------------------------------------------------

const RATIO: Record<ImageBlock['ratio'], string> = {
  auto: '',
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
};

export function ImageWidget({ block }: { block: ImageBlock }) {
  const src = safeImageSrc(block.src);
  return (
    <figure className="grid gap-2">
      {src ? (
        <img
          src={src}
          alt={block.alt}
          loading="lazy"
          className={cn(
            'w-full',
            RATIO[block.ratio] ?? '',
            block.ratio !== 'auto' && (block.fit === 'contain' ? 'object-contain' : 'object-cover'),
            block.rounded && 'rounded-2xl'
          )}
        />
      ) : (
        <div
          className={cn(
            'bg-muted text-muted-foreground grid place-items-center gap-1 rounded-2xl text-xs',
            RATIO[block.ratio] || 'aspect-video'
          )}
        >
          <ImageIcon className="size-6" />
          Ngarko një imazh
        </div>
      )}
      {block.caption && (
        <figcaption className="text-muted-foreground text-center text-xs">{block.caption}</figcaption>
      )}
    </figure>
  );
}

export function IconListWidget({ block }: { block: IconListBlock }) {
  const Icon = widgetIcon(block.icon);
  return (
    <ul className="grid gap-2 text-left">
      {asArray(block.items).map((item) => (
        <li key={item.id} className="flex items-start gap-2.5 text-sm">
          <Icon className="text-primary mt-0.5 size-4 shrink-0" />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

const ALERT = {
  info: { icon: Info, box: 'border-sky-500/30 bg-sky-500/10', fg: 'text-sky-700 dark:text-sky-300' },
  success: { icon: CheckCircle2, box: 'border-success/30 bg-success/10', fg: 'text-success' },
  warning: { icon: AlertTriangle, box: 'border-warning/40 bg-warning/10', fg: 'text-warning' },
  danger: { icon: XCircle, box: 'border-destructive/30 bg-destructive/10', fg: 'text-destructive' },
} as const;

export function AlertWidget({ block }: { block: AlertBlock }) {
  const v = ALERT[block.variant] ?? ALERT.info;
  const Icon = v.icon;
  return (
    <div role="note" className={cn('flex gap-3 rounded-xl border px-4 py-3 text-left', v.box)}>
      <Icon className={cn('mt-0.5 size-5 shrink-0', v.fg)} />
      <div className="min-w-0">
        {block.title && <p className={cn('text-sm font-semibold', v.fg)}>{block.title}</p>}
        {block.text && <p className="text-sm whitespace-pre-line">{block.text}</p>}
      </div>
    </div>
  );
}

// ---- Përmbajtje -------------------------------------------------------------------

export function IconBoxWidget({ block }: { block: IconBoxBlock }) {
  const Icon = widgetIcon(block.icon);
  const left = block.layout === 'left';
  return (
    <div className={cn('flex gap-4', left ? 'items-start text-left' : 'flex-col items-center text-center')}>
      <span className="bg-primary/10 text-primary grid size-12 shrink-0 place-items-center rounded-xl">
        <Icon className="size-6" />
      </span>
      <div className="grid gap-1">
        <h3 className="text-base font-semibold">{block.title}</h3>
        {block.text && (
          <p className="text-muted-foreground text-sm whitespace-pre-line">{block.text}</p>
        )}
      </div>
    </div>
  );
}

export function TabsWidget({ block }: { block: TabsBlock }) {
  const items = asArray(block.items);
  const [active, setActive] = React.useState(0);
  const current = items[Math.min(active, items.length - 1)];
  const baseId = React.useId();
  if (items.length === 0) return null;
  return (
    <div className="text-left">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${baseId}-panel`}
            onClick={() => setActive(i)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              i === active
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="pt-4 text-sm leading-relaxed whitespace-pre-line"
      >
        {current?.text}
      </div>
    </div>
  );
}

export function AccordionWidget({ block }: { block: AccordionBlock }) {
  const items = asArray(block.items);
  const [open, setOpen] = React.useState<Set<string>>(
    () => new Set(block.firstOpen && items[0] ? [items[0].id] : [])
  );

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(block.multiple ? prev : []);
      if (prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="divide-y overflow-hidden rounded-xl border text-left">
      {items.map((item) => {
        const isOpen = open.has(item.id);
        return (
          <div key={item.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(item.id)}
              className="hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors"
            >
              <span className="flex-1">{item.title}</span>
              <ChevronDown className={cn('size-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <div className="text-muted-foreground px-4 pb-4 text-sm leading-relaxed whitespace-pre-line">
                {item.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Lists the page's own headings, so it can never point anywhere else. */
export function TocWidget({ block, blocks, preview }: { block: TocBlock; blocks: Block[]; preview: boolean }) {
  const headings = flattenBlocks(blocks).filter(
    (b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading' && b.level <= block.depth
  );
  return (
    <nav aria-label={block.title || 'Përmbajtja'} className="bg-muted/50 rounded-xl p-4 text-left">
      {block.title && <p className="mb-2 text-sm font-semibold">{block.title}</p>}
      {headings.length === 0 ? (
        <p className="text-muted-foreground text-xs">Shto tituj në faqe — shfaqen këtu.</p>
      ) : (
        <ol className="grid gap-1.5 text-sm">
          {headings.map((h) => (
            <li key={h.id} className={cn(h.level === 2 && 'pl-3', h.level === 3 && 'pl-6')}>
              <a
                href={preview ? undefined : `#${headingAnchor(h.id)}`}
                className="text-primary hover:underline"
              >
                {h.text}
              </a>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}

function Stars({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(5, Math.round((Number(value) || 0) * 2) / 2));
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${v} nga 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        if (v >= i + 1) return <Star key={i} className="size-4 fill-amber-400 text-amber-400" />;
        if (v >= i + 0.5) return <StarHalf key={i} className="size-4 fill-amber-400 text-amber-400" />;
        return <Star key={i} className="text-muted-foreground/40 size-4" />;
      })}
    </span>
  );
}

export function RatingWidget({ block }: { block: RatingBlock }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {block.label && <span className="text-sm font-medium">{block.label}</span>}
      <Stars value={block.value} />
      <span className="text-muted-foreground text-sm tabular-nums">{Number(block.value) || 0}/5</span>
    </div>
  );
}

export function TestimonialWidget({ block }: { block: TestimonialBlock }) {
  return (
    <figure className="bg-card shadow-card grid gap-3 rounded-2xl p-6 text-left">
      <Quote className="text-primary/40 size-7" />
      <blockquote className="text-base leading-relaxed whitespace-pre-line">{block.quote}</blockquote>
      {block.rating > 0 && <Stars value={block.rating} />}
      <figcaption className="text-sm">
        <span className="font-semibold">{block.author}</span>
        {block.role && <span className="text-muted-foreground"> · {block.role}</span>}
      </figcaption>
    </figure>
  );
}

// ---- Marketing --------------------------------------------------------------------

export function PriceTableWidget({ block, preview }: { block: PriceTableBlock; preview: boolean }) {
  return (
    <div
      className={cn(
        'bg-card relative grid gap-5 rounded-2xl border p-6 text-left',
        block.featured ? 'border-primary shadow-lg' : 'shadow-card'
      )}
    >
      {block.badge && (
        <span className="bg-primary text-primary-foreground absolute -top-3 right-5 rounded-full px-3 py-1 text-[11px] font-bold">
          {block.badge}
        </span>
      )}
      <div>
        <h3 className="text-base font-semibold">{block.title}</h3>
        <p className="mt-2">
          <span className="text-3xl font-bold tracking-tight">{block.price}</span>
          {block.period && <span className="text-muted-foreground text-sm"> / {block.period}</span>}
        </p>
      </div>
      <ul className="grid gap-2">
        {asArray(block.features).map((f) => (
          <li key={f.id} className={cn('flex items-start gap-2 text-sm', !f.included && 'text-muted-foreground')}>
            {f.included ? (
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0" />
            )}
            <span className={cn(!f.included && 'line-through')}>{f.text}</span>
          </li>
        ))}
      </ul>
      <LinkButton
        label={block.buttonLabel}
        href={block.buttonHref}
        preview={preview}
        variant={block.featured ? 'default' : 'outline'}
        className="w-full"
      />
    </div>
  );
}

export function PriceListWidget({ block }: { block: PriceListBlock }) {
  return (
    <ul className="grid gap-4 text-left">
      {asArray(block.items).map((item) => (
        <li key={item.id} className="grid gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{item.text}</span>
            <span className="border-muted-foreground/30 mb-1 flex-1 border-b border-dotted" aria-hidden />
            <span className="text-sm font-semibold tabular-nums">{item.price}</span>
          </div>
          {item.description && <p className="text-muted-foreground text-xs">{item.description}</p>}
        </li>
      ))}
    </ul>
  );
}

const CTA_TONE = {
  brand: 'bg-primary text-primary-foreground',
  dark: 'bg-foreground text-background',
  light: 'bg-muted text-foreground',
} as const;

export function CtaWidget({ block, preview }: { block: CtaBlock; preview: boolean }) {
  const tone = CTA_TONE[block.tone] ?? CTA_TONE.brand;
  return (
    <div className={cn('flex flex-col gap-4 rounded-2xl p-6 @2xl:flex-row @2xl:items-center @2xl:p-8', tone)}>
      <div className="grid flex-1 gap-1 text-left">
        <h3 className="text-xl font-semibold tracking-tight">{block.title}</h3>
        {block.text && <p className="text-sm whitespace-pre-line opacity-85">{block.text}</p>}
      </div>
      <LinkButton
        label={block.buttonLabel}
        href={block.buttonHref}
        preview={preview}
        variant={block.tone === 'light' ? 'default' : 'secondary'}
        className="shrink-0"
      />
    </div>
  );
}

/*
  Turns over on hover — and on tap or Enter, since a phone has no hover and a
  keyboard user has to be able to reach the back and its button too.
*/
export function FlipBoxWidget({ block, preview }: { block: FlipBoxBlock; preview: boolean }) {
  const Icon = widgetIcon(block.icon);
  const [flipped, setFlipped] = React.useState(false);
  return (
    <div
      className="group/flip h-56 perspective-[1000px]"
      tabIndex={0}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setFlipped((f) => !f)}
      onMouseLeave={() => setFlipped(false)}
      aria-label={`${block.frontTitle} — shtyp për anën tjetër`}
    >
      <div
        className={cn(
          'relative h-full transition-transform duration-500 transform-3d group-hover/flip:transform-[rotateY(180deg)]',
          flipped && 'transform-[rotateY(180deg)]'
        )}
      >
        <div className="bg-primary/10 absolute inset-0 grid place-items-center content-center gap-2 rounded-2xl p-6 text-center backface-hidden">
          <Icon className="text-primary size-8" />
          <h3 className="text-base font-semibold">{block.frontTitle}</h3>
          {block.frontText && <p className="text-muted-foreground text-sm">{block.frontText}</p>}
        </div>
        <div className="bg-primary text-primary-foreground absolute inset-0 grid place-items-center content-center gap-3 rounded-2xl p-6 text-center backface-hidden transform-[rotateY(180deg)]">
          <h3 className="text-base font-semibold">{block.backTitle}</h3>
          {block.backText && <p className="text-sm opacity-90">{block.backText}</p>}
          <LinkButton label={block.buttonLabel} href={block.buttonHref} preview={preview} variant="secondary" />
        </div>
      </div>
    </div>
  );
}

function parseLocal(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  return Number.isFinite(t) ? t : null;
}

export function CountdownWidget({ block }: { block: CountdownBlock }) {
  const target = parseLocal(block.target);
  // Rendered first with no clock, so the server's HTML and the first client
  // render agree; the numbers fill in once the tab is ticking.
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const left = target !== null && now !== null ? Math.max(0, target - now) : null;
  const parts =
    left === null
      ? null
      : [
          { label: 'Ditë', value: Math.floor(left / 86_400_000) },
          { label: 'Orë', value: Math.floor(left / 3_600_000) % 24 },
          { label: 'Minuta', value: Math.floor(left / 60_000) % 60 },
          { label: 'Sekonda', value: Math.floor(left / 1000) % 60 },
        ];

  return (
    <div className="grid gap-3 text-center">
      {block.title && <p className="text-sm font-semibold">{block.title}</p>}
      {target === null ? (
        <p className="text-muted-foreground text-sm">Vendos datën e afatit.</p>
      ) : left === 0 ? (
        <p className="text-sm font-medium">{block.doneText}</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {(parts ?? [{ label: 'Ditë' }, { label: 'Orë' }, { label: 'Minuta' }, { label: 'Sekonda' }]).map(
            (p) => (
              <div key={p.label} className="bg-card shadow-card rounded-xl px-2 py-3">
                <p className="text-2xl font-bold tabular-nums @lg:text-3xl">
                  {'value' in p ? String(p.value).padStart(2, '0') : '––'}
                </p>
                <p className="text-muted-foreground text-[11px]">{p.label}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ---- Të dhëna ---------------------------------------------------------------------

function formatAmount(n: number) {
  const whole = groupThousands(Math.trunc(n));
  const cents = Math.round(Math.abs(n % 1) * 100);
  return cents ? `${whole},${String(cents).padStart(2, '0')}` : whole;
}

export function ProgressWidget({
  block,
  collection,
  rows,
}: {
  block: ProgressBlock;
  collection: CustomCollection | undefined;
  rows: CustomRecord[];
}) {
  let percent = Math.max(0, Math.min(100, Number(block.value) || 0));
  let detail: string | null = null;

  if (block.mode === 'goal') {
    const field = collection?.fields.find((f) => f.id === block.fieldId);
    const target = Number(block.target) || 0;
    const sum = field
      ? rows.reduce((acc, r) => acc + (numericValue(field, r.data, collection!.fields) ?? 0), 0)
      : 0;
    percent = target > 0 ? Math.max(0, Math.min(100, (sum / target) * 100)) : 0;
    detail = field ? `${formatAmount(sum)} nga ${formatAmount(target)}` : 'Zgjidh koleksionin dhe fushën';
  }

  return (
    <div className="grid gap-2 text-left">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{block.label}</span>
        <span className="text-muted-foreground tabular-nums">
          {detail ? `${detail} · ` : ''}
          {Math.round(percent)}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={block.label}
        className="bg-muted h-2.5 overflow-hidden rounded-full"
      >
        <div className="bg-primary h-full rounded-full transition-[width] duration-700" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

const PER_ROW = {
  2: '@lg:grid-cols-2',
  3: '@lg:grid-cols-2 @3xl:grid-cols-3',
  4: '@lg:grid-cols-2 @3xl:grid-cols-4',
} as const;

export function CardsWidget({
  block,
  collection,
  rows,
  formatValue,
}: {
  block: CardsBlock;
  collection: CustomCollection | undefined;
  rows: CustomRecord[];
  formatValue: (field: CollectionField, data: CustomRecord['data'], fields: CollectionField[]) => string;
}) {
  if (!collection) {
    return (
      <p className="border-warning/40 bg-warning/10 rounded-xl border px-4 py-3 text-left text-sm">
        Kartelat nuk kanë një koleksion të lidhur.
      </p>
    );
  }
  const fields = collection.fields;
  const pick = (id: string | null) => fields.find((f) => f.id === id);
  const titleField = pick(block.titleFieldId) ?? fields[0];
  const subtitleField = pick(block.subtitleFieldId);
  const valueField = pick(block.valueFieldId);
  const badgeField = pick(block.badgeFieldId);

  return (
    <section className="grid gap-3 text-left">
      {block.title && <h2 className="text-base font-semibold">{block.title}</h2>}
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
          {block.emptyText || 'Nuk ka ende të dhëna.'}
        </p>
      ) : (
        <div className={cn('grid gap-3', PER_ROW[block.perRow] ?? PER_ROW[3])}>
          {rows.map((row) => (
            <article key={row.id} className="bg-card shadow-card grid gap-2 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {titleField ? formatValue(titleField, row.data, fields) : '—'}
                </h3>
                {badgeField && (
                  <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium">
                    {formatValue(badgeField, row.data, fields)}
                  </span>
                )}
              </div>
              {subtitleField && (
                <p className="text-muted-foreground truncate text-xs">
                  {formatValue(subtitleField, row.data, fields)}
                </p>
              )}
              {valueField && (
                <p className="text-lg font-semibold tabular-nums">{formatValue(valueField, row.data, fields)}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
