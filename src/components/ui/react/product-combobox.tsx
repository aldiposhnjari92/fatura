import * as React from 'react';
import { History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/react/input';
import { formatALL } from '@/lib/utils';
import { productKey, type ProductSuggestion } from '@/lib/products';

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  products: ProductSuggestion[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  /** Fired by Enter on typed text, so a product can be added without the mouse. */
  onEnter?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

const MAX_VISIBLE = 8;

/**
 * A text field that suggests products this business has invoiced before.
 *
 * Deliberately not `SearchableSelect`: the value here is free text — a product
 * nobody has invoiced yet has to be typeable — so the list assists typing
 * rather than owning the value. That also rules out Popover, which moves focus
 * to itself on open and would take the caret out of the field mid-word; the
 * list is an absolutely positioned sibling instead, and focus never leaves the
 * input.
 *
 * Picking a row fills in the name and nothing else: the quantity and the price
 * are what changes between two sales of the same thing, so writing last time's
 * numbers in would be a guess the user then has to check and correct.
 */
export function ProductCombobox({
  value,
  onValueChange,
  products,
  placeholder,
  disabled = false,
  className,
  id,
  'aria-label': ariaLabel,
  onEnter,
  inputRef,
}: Props) {
  const [open, setOpen] = React.useState(false);
  /*
    null until the list is arrowed into. The value here is free text, so
    nothing may be highlighted by default: with a row pre-selected, Enter on a
    half-typed new product would silently swap in an old one that happens to
    start the same way.
  */
  const [active, setActive] = React.useState<number | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  const matches = React.useMemo(() => {
    const query = productKey(value);
    // The list is an aid to typing, not a menu to browse: an empty field
    // suggests nothing, so it never covers the row on the way to another field.
    if (!query) return [];

    const hits = products.filter((p) => productKey(p.description).includes(query));
    // Typed out in full, the list narrows to that one product rather than going
    // on offering everything its name is the start of.
    const exact = hits.find((p) => productKey(p.description) === query);
    return exact ? [exact] : hits.slice(0, MAX_VISIBLE);
  }, [products, value]);

  React.useEffect(() => setActive(null), [value, open]);

  // Keep the highlighted row in view when arrowing past the fold.
  React.useEffect(() => {
    if (!open || active === null) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  // Clicking anywhere else closes the list. Pointerdown rather than click so it
  // closes before the other control takes focus.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const showList = open && matches.length > 0;

  function choose(product: ProductSuggestion) {
    onValueChange(product.description);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' && !showList) {
      // Only worth opening when there is a word to match; with an empty field
      // there is nothing to arrow through.
      if (matches.length > 0) setOpen(true);
      return;
    }
    if (showList && event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i === null ? 0 : Math.min(i + 1, matches.length - 1)));
      return;
    }
    if (showList && event.key === 'ArrowUp') {
      event.preventDefault();
      // Arrowing back off the top returns to the typed text.
      setActive((i) => (i === null || i === 0 ? null : i - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      // Enter takes a suggestion only once one is highlighted; otherwise it
      // adds exactly what was typed.
      const picked = showList && active !== null ? matches[active] : null;
      if (picked) {
        choose(picked);
      } else {
        setOpen(false);
        onEnter?.();
      }
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-label={ariaLabel}
      />

      {showList && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className="bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 max-h-[200px] w-full overflow-y-auto rounded-md border p-1 shadow-md"
        >
          {matches.map((product, index) => (
            <button
              key={product.description}
              type="button"
              role="option"
              aria-selected={index === active}
              data-index={index}
              onMouseEnter={() => setActive(index)}
              // Mousedown, not click: click fires after the input has already
              // blurred, and the outside-pointerdown handler closes the list
              // first, so the row would never be reached.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(product);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm',
                index === active && 'bg-accent text-accent-foreground'
              )}
            >
              <History className="text-muted-foreground size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{product.description}</span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatALL(product.price, false)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
