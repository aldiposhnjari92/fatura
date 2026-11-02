import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import {
  AccordionWidget,
  AlertWidget,
  CardsWidget,
  CountdownWidget,
  CtaWidget,
  FlipBoxWidget,
  IconBoxWidget,
  IconListWidget,
  ImageWidget,
  PriceListWidget,
  PriceTableWidget,
  ProgressWidget,
  RatingWidget,
  TabsWidget,
  TestimonialWidget,
  TocWidget,
} from './Widgets';
import { cn } from '@/lib/utils';
import { COLUMN_GRID, SPACER_HEIGHT, headingAnchor, safeHref, styleClasses } from '@/lib/page-builder';
import { BlockContextProvider, useBlockContext } from './block-context';
import { FieldElement, SubmitElement } from './FormElements';
import FormView from './FormView';
import StatView from './StatView';
import TableView from './TableView';
import { formatValue } from './record-values';
import type { CustomRecord, LeafBlock } from '@/models/page-builder';
import type { BlockContext, FormValues, PageBlocksProps } from '@/models/page-builder-ui';

/*
  Renders a page's blocks. The same pieces draw the customer's live page and
  the admin's editor canvas; `preview` turns every write into a no-op so the
  editor can show a working-looking form without touching anyone's data.

  Records live in one place per page, so a form and a table on the same
  collection stay in step: a row saved by the form appears in the table below
  it without a reload.

  The root is a container (`@container`): columns stack and "hide on phone"
  applies by the width of the page itself, which is what lets the editor's
  phone preview behave exactly like a phone.

  Each data block lives in its own file beside this one (FormView, TableView,
  StatView, FormElements); the static ones are drawn here or in Widgets.
*/

/** One shared empty list: a fresh `[]` default would re-run the effect below every render. */
const NO_RECORDS: CustomRecord[] = [];

/** One shared empty object, so an untouched form never re-renders its fields. */
const NO_VALUES: FormValues = {};

export default function PageBlocks({
  blocks,
  collections,
  records: initial = NO_RECORDS,
  readOnly = false,
}: PageBlocksProps) {
  const [records, setRecords] = React.useState<CustomRecord[]>(initial);
  /* Values of every element-built form on the page, by formKey(). */
  const [forms, setForms] = React.useState<Record<string, FormValues>>({});
  const byId = React.useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);

  const ctx = React.useMemo<BlockContext>(
    () => ({
      preview: readOnly,
      blocks,
      collection: (id) => (id ? byId.get(id) : undefined),
      rows: (id) => (id ? records.filter((r) => r.collection_id === id) : []),
      onSaved: (row) =>
        setRecords((prev) =>
          prev.some((r) => r.id === row.id)
            ? prev.map((r) => (r.id === row.id ? row : r))
            : [row, ...prev]
        ),
      onDeleted: (id) => setRecords((prev) => prev.filter((r) => r.id !== id)),
      formValues: (key) => forms[key] ?? NO_VALUES,
      setFormValue: (key, fieldId, value) =>
        setForms((prev) => ({ ...prev, [key]: { ...prev[key], [fieldId]: value } })),
      resetForm: (key) =>
        setForms((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        }),
    }),
    [byId, records, readOnly, blocks, forms]
  );

  // The preview fetches its rows after opening; follow them when they land.
  React.useEffect(() => setRecords(initial), [initial]);

  if (blocks.length === 0) {
    return (
      <p className="text-muted-foreground rounded-2xl border border-dashed px-6 py-16 text-center text-sm">
        Kjo faqe është ende bosh.
      </p>
    );
  }

  return (
    <BlockContextProvider value={ctx}>
      <div className="@container flex flex-col gap-5">
        {blocks.map((block) =>
          block.type === 'columns' ? (
            <div
              key={block.id}
              className={cn('grid gap-5', COLUMN_GRID[block.layout], styleClasses(block.style))}
            >
              {block.columns.map((column, i) => (
                <div key={i} className="flex min-w-0 flex-col gap-5">
                  {column.map((child) => (
                    <StyledLeaf key={child.id} block={child} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <StyledLeaf key={block.id} block={block} />
          )
        )}
      </div>
    </BlockContextProvider>
  );
}

/** A leaf block inside its style wrapper (background, padding, alignment, visibility). */
export function StyledLeaf({ block }: { block: LeafBlock }) {
  const classes = styleClasses(block.style);
  return classes ? (
    <div className={classes}>
      <BlockView block={block} />
    </div>
  ) : (
    <BlockView block={block} />
  );
}

export function BlockView({ block }: { block: LeafBlock }) {
  const ctx = useBlockContext();

  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
      return (
        <Tag
          id={headingAnchor(block.id)}
          className={cn(
            'scroll-mt-24 font-semibold tracking-tight',
            block.level === 1 && 'text-2xl @2xl:text-3xl',
            block.level === 2 && 'text-xl',
            block.level === 3 && 'text-base'
          )}
        >
          {block.text}
        </Tag>
      );
    }
    case 'text':
      return (
        <p
          className={cn(
            'text-sm leading-relaxed whitespace-pre-line',
            block.tone === 'muted' && 'text-muted-foreground',
            block.tone === 'note' && 'border-brand/30 bg-brand/5 rounded-xl border px-4 py-3'
          )}
        >
          {block.text}
        </p>
      );
    case 'divider':
      return <hr className="border-border" />;
    case 'spacer':
      return <div className={SPACER_HEIGHT[block.size]} aria-hidden />;
    case 'button': {
      const href = safeHref(block.href);
      const external = href?.startsWith('http');
      const live = !!href && !ctx.preview;
      return (
        <div>
          <Button asChild={live} variant={block.variant} disabled={!href}>
            {live ? (
              <a href={href!} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {block.label}
                {external && <ExternalLink />}
              </a>
            ) : (
              <span>{block.label}</span>
            )}
          </Button>
        </div>
      );
    }
    case 'form':
      return <FormView block={block} />;
    case 'table':
      return <TableView block={block} />;
    case 'stat':
      return <StatView block={block} />;
    case 'image':
      return <ImageWidget block={block} />;
    case 'iconlist':
      return <IconListWidget block={block} />;
    case 'alert':
      return <AlertWidget block={block} />;
    case 'iconbox':
      return <IconBoxWidget block={block} />;
    case 'tabs':
      return <TabsWidget block={block} />;
    case 'accordion':
      return <AccordionWidget block={block} />;
    case 'toc':
      return <TocWidget block={block} blocks={ctx.blocks} preview={ctx.preview} />;
    case 'testimonial':
      return <TestimonialWidget block={block} />;
    case 'rating':
      return <RatingWidget block={block} />;
    case 'pricetable':
      return <PriceTableWidget block={block} preview={ctx.preview} />;
    case 'pricelist':
      return <PriceListWidget block={block} />;
    case 'cta':
      return <CtaWidget block={block} preview={ctx.preview} />;
    case 'flipbox':
      return <FlipBoxWidget block={block} preview={ctx.preview} />;
    case 'countdown':
      return <CountdownWidget block={block} />;
    case 'progress':
      return (
        <ProgressWidget
          block={block}
          collection={ctx.collection(block.source.collectionId)}
          rows={ctx.rows(block.source.collectionId)}
        />
      );
    case 'cards':
      return (
        <CardsWidget
          block={block}
          collection={ctx.collection(block.source.collectionId)}
          rows={ctx.rows(block.source.collectionId)}
          formatValue={formatValue}
        />
      );
    case 'field':
      return <FieldElement block={block} />;
    case 'submit':
      return <SubmitElement block={block} />;
  }
}
