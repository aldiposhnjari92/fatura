import { CheckCircle2, List, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn, formatALL } from '@/lib/utils';
import { Button } from '@/components/ui/react/button';
import { Label } from '@/components/ui/react/label';
import { NumberInput } from '@/components/ui/react/number-input';
import { ProductCombobox } from '@/components/ui/react/product-combobox';
import EditorSection from './EditorSection';
import type { InvoiceItemsSectionProps } from '@/models/invoice';

/** The composer row and the ledger of lines under it. State lives in useInvoiceItems. */
export default function InvoiceItemsSection({ state, products }: InvoiceItemsSectionProps) {
  const t = useTranslations();
  const { items, draft, setDraft, editingIndex, flashIndex, descriptionRef, commitDraft, editItem, cancelEdit, removeItem } =
    state;

  return (
    <EditorSection icon={List} title={t('inv.items')} hint="Çfarë po faturon">
      <div className="space-y-4">
        {/*
          One row of inputs, always. Each product added drops into the list
          underneath as a line of text, so an invoice with twenty products
          is twenty lines to read rather than sixty fields to scroll past.
          The row sits on the card's own ground: a panel around it would be
          a third surface inside a section that is already one.
        */}
        <div>
          <div className="grid gap-3 sm:grid-cols-[1fr_84px_124px_auto] sm:items-end sm:gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="item-description" className="text-xs">
                {t('inv.description')}
              </Label>
              <ProductCombobox
                id="item-description"
                inputRef={descriptionRef}
                value={draft.description}
                onValueChange={(description) => setDraft((d) => ({ ...d, description }))}
                onEnter={commitDraft}
                products={products}
                placeholder={t('inv.descriptionPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:contents">
              <div className="grid gap-1.5">
                <Label htmlFor="item-quantity" className="text-xs">
                  {t('inv.quantity')}
                </Label>
                <NumberInput
                  id="item-quantity"
                  value={draft.quantity}
                  onValueChange={(quantity) => setDraft((d) => ({ ...d, quantity }))}
                  className="sm:text-right"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="item-price" className="text-xs">
                  {t('inv.price')}
                </Label>
                <NumberInput
                  id="item-price"
                  value={draft.price}
                  onValueChange={(price) => setDraft((d) => ({ ...d, price }))}
                  className="sm:text-right"
                />
              </div>
            </div>

            <div className="flex gap-2">
              {editingIndex !== null && (
                <Button type="button" variant="ghost" onClick={cancelEdit}>
                  {t('inv.itemCancelEdit')}
                </Button>
              )}
              <Button
                type="button"
                onClick={commitDraft}
                disabled={!draft.description.trim()}
                className="flex-1 sm:flex-none"
              >
                {editingIndex !== null ? (
                  <>
                    <CheckCircle2 /> {t('inv.itemSaveEdit')}
                  </>
                ) : (
                  <>
                    <Plus /> {t('inv.addItem')}
                  </>
                )}
              </Button>
            </div>
          </div>

          {products.length > 0 && editingIndex === null && (
            <p className="text-muted-foreground mt-2 text-xs">{t('inv.productMemoryHint')}</p>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-4 py-5 text-center text-sm">
            {t('inv.itemsEmpty')}
          </p>
        ) : (
          /*
            A ledger, not a stack of cards: one line per product, hairlines
            between them, and the row height set by the icon buttons rather
            than by padding. `overflow-hidden` is what rounds the first and
            last rows, so no row carries a corner of its own.
          */
          <ul className="divide-border/60 divide-y overflow-hidden rounded-md border">
            {items.map((item, index) => {
              const lineTotal = (Number(item.quantity) || 0) * (Number(item.price) || 0);
              return (
                <li
                  key={index}
                  className={cn(
                    'flex items-center gap-2 py-1 pr-1 pl-3 transition-colors sm:gap-3',
                    editingIndex === index && 'bg-accent/60',
                    flashIndex === index && 'bg-primary/10'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{item.description}</span>

                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {item.quantity} × {formatALL(item.price, false)}
                  </span>

                  <span className="shrink-0 text-sm font-medium tabular-nums">{formatALL(lineTotal, false)}</span>

                  <span className="flex shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => editItem(index)}
                      aria-label={t('inv.itemEditAria', { n: index + 1 })}
                      className="text-muted-foreground hover:text-foreground size-8 rounded-md [&_svg]:size-3.5"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      aria-label={t('inv.itemDeleteAria', { n: index + 1 })}
                      className="text-muted-foreground hover:text-destructive size-8 rounded-md [&_svg]:size-3.5"
                    >
                      <Trash2 />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </EditorSection>
  );
}
