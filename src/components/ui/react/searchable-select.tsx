import * as React from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/react/popover';

export interface SelectOption {
  value: string;
  label: string;
  /** Secondary line, e.g. a client's VAT number. Also matched when filtering. */
  hint?: string;
}

interface Props {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  /**
   * Show the search box once the list reaches this many options.
   *
   * Defaults to 0: every dropdown is filterable, which is what was asked for.
   * Raise it on an individual field if a short list ever feels better without
   * one.
   */
  searchThreshold?: number;
  'aria-label'?: string;
}

/**
 * A select you can type into.
 *
 * Built on Popover rather than Radix Select: Select owns keyboard input for its
 * own typeahead and moves focus to the highlighted item, which fights a real
 * text input placed inside it. Popover leaves focus alone, so the field behaves
 * like an ordinary input.
 */
export function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = '—',
  searchPlaceholder = 'Kërko…',
  emptyText = 'Asnjë rezultat.',
  disabled = false,
  className,
  searchThreshold = 0,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const showSearch = options.length >= searchThreshold;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Accent-insensitive: typing "kafe" should still find "Kafé".
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const nq = norm(q);
    return options.filter(
      (o) => norm(o.label).includes(nq) || (o.hint ? norm(o.hint).includes(nq) : false)
    );
  }, [options, query]);

  React.useEffect(() => setActive(0), [query, open]);

  // Keep the highlighted row in view when arrowing past the fold.
  React.useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function choose(option: SelectOption) {
    onValueChange(option.value);
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[active];
      if (option) choose(option);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            /*
              Sized off `Input`, down to the height, the radius and the shadow.
              This sits in the same form rows as plain fields — a 40px pill at
              14px beside a 36px field at 16px reads as two different controls
              rather than two of a kind.
            */
            'border-input bg-transparent ring-offset-background focus-visible:ring-ring flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-1 text-base shadow-sm focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate text-left">{selected?.label ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onKeyDown={onKeyDown}
      >
        {showSearch && (
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              /*
                `text-base` under `md`, like every other field: iOS Safari zooms
                the viewport when something smaller than 16px takes focus, and
                this one autofocuses the moment the dropdown opens — so the page
                lurches as part of opening it.
              */
              className="placeholder:text-muted-foreground h-10 w-full bg-transparent text-base outline-hidden md:text-sm"
            />
          </div>
        )}

        <div ref={listRef} role="listbox" className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              {emptyText}
            </p>
          ) : (
            filtered.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm',
                    index === active && 'bg-accent text-accent-foreground'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="text-muted-foreground block truncate text-xs">
                        {option.hint}
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="text-primary size-4 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
