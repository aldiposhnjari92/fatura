import * as React from 'react';
import type { InvoiceItem, InvoiceItemsState } from '@/models/invoice';

const emptyItem = (): InvoiceItem => ({ description: '', quantity: 1, price: 0 });

/*
  The one row of inputs. Everything already on the invoice is a read-only
  line below it, so the form stays the same height whether the invoice has
  one product or thirty. Editing a line pulls it back up into this row.
*/
export function useInvoiceItems(initial: InvoiceItem[]): InvoiceItemsState {
  const [items, setItems] = React.useState<InvoiceItem[]>(initial);
  const [draft, setDraft] = React.useState<InvoiceItem>(emptyItem);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  /* The line the last Shto landed on, highlighted briefly so it is seen. */
  const [flash, setFlash] = React.useState<{ index: number } | null>(null);
  const descriptionRef = React.useRef<HTMLInputElement>(null);

  /**
   * Move the composer's line onto the invoice.
   *
   * Every entry is its own line, even a product already on the invoice: the
   * same thing is often sold twice at two prices, and folding the repeat into
   * the first line would overwrite the price that line was sold at.
   */
  function commitDraft() {
    const description = draft.description.trim();
    if (!description) return;

    const line: InvoiceItem = {
      description,
      quantity: Number(draft.quantity) || 0,
      price: Number(draft.price) || 0,
    };

    if (editingIndex !== null) {
      setItems((prev) => prev.map((item, i) => (i === editingIndex ? line : item)));
      setFlash({ index: editingIndex });
    } else {
      setFlash({ index: items.length });
      setItems((prev) => [...prev, line]);
    }

    setDraft(emptyItem());
    setEditingIndex(null);
    descriptionRef.current?.focus();
  }

  /** Pull a line back into the composer rather than making every row editable. */
  function editItem(index: number) {
    setDraft({ ...items[index] });
    setEditingIndex(index);
    descriptionRef.current?.focus();
  }

  function cancelEdit() {
    setDraft(emptyItem());
    setEditingIndex(null);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    // Keep the composer aimed at the same line it was editing.
    if (editingIndex === null) return;
    if (editingIndex === index) cancelEdit();
    else if (editingIndex > index) setEditingIndex(editingIndex - 1);
  }

  /*
    A description typed into the composer counts as a line before Shto is
    pressed, so the totals, the preview and the save all agree with what is on
    screen — forgetting to press Shto can't silently drop a product. While a
    line is being edited the list still holds its saved values, so there is
    nothing pending.
  */
  const pendingLine = React.useMemo<InvoiceItem | null>(() => {
    if (editingIndex !== null) return null;
    const description = draft.description.trim();
    if (!description) return null;
    return {
      description,
      quantity: Number(draft.quantity) || 0,
      price: Number(draft.price) || 0,
    };
  }, [draft, editingIndex]);

  /** What the invoice would hold if it were saved right now. */
  const effectiveItems = React.useMemo(
    () => (pendingLine ? [...items, pendingLine] : items),
    [items, pendingLine]
  );

  // The highlight is an acknowledgement, not a state — let it fade on its own.
  React.useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 1400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  return {
    items,
    draft,
    setDraft,
    editingIndex,
    flashIndex: flash?.index ?? null,
    descriptionRef,
    effectiveItems,
    commitDraft,
    editItem,
    cancelEdit,
    removeItem,
  };
}
