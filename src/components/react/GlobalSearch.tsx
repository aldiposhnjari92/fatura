import * as React from 'react';
import { FileText, Search, Users, CornerDownLeft, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_BADGE_BASE, STATUS_META, type InvoiceStatus } from '@/lib/types';
import { useTranslations } from '@/lib/i18n';
import { SEARCH_MAX_LENGTH } from '@/lib/search';
import { startNavProgress } from '@/lib/nav-progress';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';

/*
  The app's global filter, as an instant-search combobox — on every viewport.

  It replaces a plain GET form that only navigated. Typing now queries
  /app/kerko.json as you go and drops a categorised panel under the field —
  invoices and clients in their own sections, keyboard-navigable as one list,
  with the matched substring marked in each label.

  On a phone the field is not in the bar at rest: at that width it would leave
  no room for anything beside it. The magnifier next to the bell opens it as a
  sheet across the top of the screen, with the same panel underneath. There is
  no separate results page behind any of this — the panel is the search.

  Three things this has to get right, and a naive version gets wrong:

    • Races. Responses can land out of order, so a slow request for "al" must
      never overwrite a fast one for "alba". Each request carries its term and
      is discarded unless it is still the term in the box; the in-flight one is
      aborted on every new keystroke.

    • The no-JS path. The markup is a real <form action="/app/faturat">, so
      before this island hydrates — and for anyone without JavaScript — the
      field still works, it just navigates to the invoice list filtered by the
      term instead of previewing. Enter only preventDefaults when an option is
      actually highlighted.

    • Focus. Blur cannot simply close the panel: a click on a result blurs the
      input before the click lands. The panel closes on pointer-down outside the
      whole component instead.
*/

const DEBOUNCE_MS = 160;

interface ResultRow {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  meta?: string;
  status?: InvoiceStatus;
}

interface Results {
  q: string;
  invoices: ResultRow[];
  clients: ResultRow[];
  invoiceCount: number;
  clientCount: number;
}

const EMPTY: Results = { q: '', invoices: [], clients: [], invoiceCount: 0, clientCount: 0 };

/** Marks every occurrence of the term in a label, without regex escaping games. */
function Highlight({ text, term }: { text: string; term: string }) {
  const needle = term.trim().toLowerCase();
  if (!needle) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  const haystack = text.toLowerCase();
  let cursor = 0;

  for (let at = haystack.indexOf(needle, cursor); at !== -1; at = haystack.indexOf(needle, cursor)) {
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(
      <mark key={at} className="bg-accent text-accent-foreground rounded-[3px] px-0.5">
        {text.slice(at, at + needle.length)}
      </mark>
    );
    cursor = at + needle.length;
  }
  if (cursor === 0) return <>{text}</>;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

interface Props {
  /**
   * The term the current page is already showing results for. Keeps the field
   * in step with the page instead of going blank the moment a search lands.
   */
  initialQuery?: string;
}

export default function GlobalSearch({ initialQuery = '' }: Props) {
  const t = useTranslations();

  const [term, setTerm] = React.useState(initialQuery);
  const [results, setResults] = React.useState<Results>(EMPTY);
  const [open, setOpen] = React.useState(false);
  /* Phone only: the field lives off-screen until the magnifier is tapped. */
  const [sheet, setSheet] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const trimmed = term.trim();

  /*
    Where "everything that matches" goes now that there is no results page of
    its own: the invoice list, whose `kerko` filter runs the very query this
    panel previews. The overflow row, the Enter fallback and the no-JS form
    submit all land on the same URL.
  */
  const allResultsHref = `/app/faturat?kerko=${encodeURIComponent(trimmed)}`;

  /*
    One flat list of everything selectable, in the order it is painted: the
    invoice rows, then the client rows, then the "all results" row. Arrow keys
    walk this, so they cross category boundaries the way a reader expects
    rather than stopping at each heading.
  */
  const options = React.useMemo<(ResultRow & { kind: 'invoice' | 'client' | 'all' })[]>(() => {
    const rows: (ResultRow & { kind: 'invoice' | 'client' | 'all' })[] = [
      ...results.invoices.map((row) => ({ ...row, kind: 'invoice' as const })),
      ...results.clients.map((row) => ({ ...row, kind: 'client' as const })),
    ];
    if (trimmed) {
      rows.push({
        id: '__all__',
        href: allResultsHref,
        title: '',
        subtitle: '',
        kind: 'all' as const,
      });
    }
    return rows;
  }, [results, trimmed]);

  // ---- Fetching -----------------------------------------------------
  /*
    Gated on `open`, not on the term alone. Landing on a filtered invoice list
    with the field pre-filled would otherwise fire a request on mount for rows
    the page has already rendered server-side. Focusing the field opens the
    panel, which is when the preview is actually wanted.
  */
  React.useEffect(() => {
    if (!open || !trimmed) {
      abortRef.current?.abort();
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/app/kerko.json?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      })
        .then((response) => {
          if (response.redirected && new URL(response.url).pathname === '/login') {
            startNavProgress();
            window.location.assign(response.url);
            return Promise.reject('signed-out');
          }
          return response.ok ? response.json() : Promise.reject(response.status);
        })
        .then((data: Results) => {
          // Stale response for a term the user has already moved past.
          if (data.q !== trimmed) return;
          setResults(data);
          setActiveIndex(-1);
          setLoading(false);
        })
        .catch((error) => {
          if (error?.name === 'AbortError') return;
          setResults(EMPTY);
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [open, trimmed]);

  // ---- Dismissal ----------------------------------------------------
  /*
    Armed for the sheet as well as the panel: on a phone a tap on the page
    behind the sheet has to put the whole thing away, not just the results.
  */
  React.useEffect(() => {
    if (!open && !sheet) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setSheet(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, sheet]);

  // A sheet without the caret in the field is just a smaller header. Opening it
  // also arms the panel, so the first keystroke previews rather than the second.
  React.useEffect(() => {
    if (!sheet) return;
    setOpen(true);
    inputRef.current?.focus();
  }, [sheet]);

  // ---- ⌘K / Ctrl-K, the shortcut printed in the field ----------------
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const closeSheet = () => {
    setSheet(false);
    setOpen(false);
    setActiveIndex(-1);
  };

  const go = (href: string) => {
    setOpen(false);
    setSheet(false);
    // The panel closing is the only thing the user sees otherwise, and it
    // looks exactly like a dismissal rather than like a result opening.
    startNavProgress();
    window.location.assign(href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      /*
        Chrome clears an <input type="search"> on Escape, which fires a change
        and wipes the term. Escape here means "put the panel away", so while it
        is open the native clear is suppressed and the query survives; a second
        Escape, with the panel already down, clears the field as expected.
      */
      if (open && trimmed) {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      } else if (sheet) {
        event.preventDefault();
        closeSheet();
      } else {
        setTerm('');
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!options.length) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + step;
        if (next < 0) return options.length - 1;
        if (next >= options.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0 && options[activeIndex]) {
      // Only intercept when something is highlighted; otherwise the form
      // submits to the invoice list, which is the no-JS behaviour too.
      event.preventDefault();
      go(options[activeIndex].href);
    }
  };

  const showPanel = open && Boolean(trimmed);
  const hasResults = results.invoices.length > 0 || results.clients.length > 0;
  const optionId = (index: number) => `global-search-option-${index}`;

  const section = (
    label: string,
    icon: React.ReactNode,
    count: number,
    rows: ResultRow[],
    offset: number
  ) =>
    rows.length === 0 ? null : (
      <li>
        <p className="text-muted-foreground/70 flex items-center gap-1.5 px-4 pt-3 pb-1 text-[10px] font-bold tracking-[0.12em] uppercase">
          {icon}
          {label}
          <span className="text-muted-foreground/50 font-semibold">({count})</span>
        </p>
        <ul role="group">
          {rows.map((row, index) => {
            const position = offset + index;
            const active = position === activeIndex;
            return (
              <li key={row.id}>
                <a
                  id={optionId(position)}
                  role="option"
                  aria-selected={active}
                  href={row.href}
                  onMouseEnter={() => setActiveIndex(position)}
                  onClick={closeSheet}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-2.5 transition-colors',
                    active && 'bg-muted'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      <Highlight text={row.title} term={trimmed} />
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      <Highlight text={row.subtitle} term={trimmed} />
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    {row.meta && (
                      <span className="text-sm font-medium tabular-nums">{row.meta}</span>
                    )}
                    {row.status && (
                      <span
                        className={cn(
                          STATUS_BADGE_BASE,
                          // Denser than the standard chip: it sits in a result row.
                          'px-2 text-[11px]',
                          (STATUS_META[row.status] ?? STATUS_META.draft).className
                        )}
                      >
                        {t(`status.${row.status}`)}
                      </span>
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </li>
    );

  const allIndex = options.length - 1;

  return (
    <>
      {/*
        The phone's way in, sitting in the bar beside the bell — same box, same
        glyph size, so the two read as a pair rather than as two guesses at a
        header button. From `md` up the field itself is in the bar and this is
        gone. It carries the `ml-auto` for the whole trailing cluster: an Astro
        island is `display: contents`, so this button is a direct child of the
        header's flex row.
      */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setSheet(true)}
        aria-label={t('action.search')}
        aria-expanded={sheet}
        className="text-muted-foreground hover:text-foreground ml-auto size-10 shrink-0 rounded-lg [&_svg]:size-5 md:hidden"
      >
        <Search aria-hidden="true" />
      </Button>

      <div
        ref={rootRef}
        className={cn(
          'min-w-0',
          sheet
            ? /*
                Pinned to the top of the screen, over the bar it replaces. The
                header it sits in carries `backdrop-blur`, which makes that
                header the containing block for anything fixed inside it — so
                this covers the bar exactly and nothing else. That rules out a
                dimmed backdrop from here; the panel below is opaque and a tap
                anywhere outside still closes, which is what the overlay was
                for.
              */
              'bg-card fixed inset-x-0 top-0 z-50 px-4 py-3 shadow-lg md:static md:max-w-md md:flex-1 md:bg-transparent md:p-0 md:shadow-none'
            : 'hidden md:block md:max-w-md md:flex-1'
        )}
      >
        <div className="flex items-center gap-2">
          {/*
            The form, not the row, is what the panel hangs off: on a phone the
            row is wider than the field by the width of the dismiss beside it,
            and a panel that overshoots the field it belongs to reads as
            unanchored.
          */}
          <form
            action="/app/faturat"
            method="get"
            role="search"
            className="relative min-w-0 flex-1"
          >
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                ref={inputRef}
                type="search"
                name="kerko"
                id="app-search"
                value={term}
                maxLength={SEARCH_MAX_LENGTH}
                autoComplete="off"
                placeholder={t('action.search')}
                aria-label="Kërko fatura dhe klientë"
                role="combobox"
                aria-expanded={showPanel}
                aria-controls="global-search-panel"
                aria-autocomplete="list"
                aria-activedescendant={
                  showPanel && activeIndex >= 0 ? optionId(activeIndex) : undefined
                }
                onChange={(event) => {
                  setTerm(event.target.value);
                  setOpen(true);
                  setActiveIndex(-1);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                /*
                  `text-base` under `md`, like every other input in the app:
                  iOS Safari zooms the viewport when a field smaller than 16px
                  takes focus, and on the search sheet that lands as the page
                  jumping to meet the keyboard.

                  The native cancel affordance goes with it. A search input
                  draws its own ✕ on WebKit, at the browser's size and colour
                  rather than the design's, and it sat crushed against the
                  controls beside it — the button below replaces it.
                */
                className={cn(
                  /*
                    Tinted, not white: the bar behind it is white at every width
                    now, so a white field on it would be a ring and nothing else.
                    Recessed against the bar is also the truer reading — the field
                    is a hole in the chrome, not a card floating on it, which is
                    why it carries no shadow. The ring stands in for the border
                    the field would otherwise draw.
                  */
                  'bg-ground ring-border/60 h-10 rounded-full border-0 pr-16 pl-11 shadow-none ring-1 transition-shadow lg:pr-24',
                  '[&::-webkit-search-cancel-button]:appearance-none',
                  showPanel && 'ring-ring ring-2'
                )}
              />

              <span className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5">
                {trimmed && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setTerm('');
                      setActiveIndex(-1);
                      inputRef.current?.focus();
                    }}
                    aria-label="Pastro kërkimin"
                    className="text-muted-foreground hover:text-foreground size-6 shrink-0 rounded-full"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                )}

                {loading ? (
                  <Loader2
                    className="text-muted-foreground size-3.5 shrink-0 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <kbd className="bg-primary text-white hidden shrink-0 rounded-md px-1.5 py-0.5 font-sans text-[10px] font-semibold lg:inline">
                    ⌘K
                  </kbd>
                )}
              </span>
            </div>

            {showPanel && (
              <div
                id="global-search-panel"
                className="bg-card shadow-card-lg absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-2xl"
              >
                {/* Announced as one listbox even though the rows are grouped. */}
                <ul role="listbox" aria-label="Rezultatet e kërkimit" className="max-h-[70vh] overflow-y-auto py-1">
                  {hasResults ? (
                    <>
                      {section(
                        'Faturat',
                        <FileText className="size-3" aria-hidden="true" />,
                        results.invoiceCount,
                        results.invoices,
                        0
                      )}
                      {section(
                        'Klientët',
                        <Users className="size-3" aria-hidden="true" />,
                        results.clientCount,
                        results.clients,
                        results.invoices.length
                      )}
                    </>
                  ) : (
                    <li className="px-4 py-6 text-center">
                      <p className="text-sm font-medium">
                        {loading ? 'Duke kërkuar…' : `Asnjë rezultat për “${trimmed}”`}
                      </p>
                      {!loading && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          Provo numrin e faturës, emrin e klientit ose NIPT-in.
                        </p>
                      )}
                    </li>
                  )}

                  {/* Always last, so ArrowUp from the top lands on it. */}
                  <li className="mt-1 border-t">
                    <a
                      id={optionId(allIndex)}
                      role="option"
                      aria-selected={activeIndex === allIndex}
                      href={allResultsHref}
                      onMouseEnter={() => setActiveIndex(allIndex)}
                      onClick={closeSheet}
                      className={cn(
                        'flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-medium transition-colors',
                        activeIndex === allIndex && 'bg-muted'
                      )}
                    >
                      <span className="text-primary truncate">
                        Shiko të gjitha faturat për “{trimmed}”
                      </span>
                      <CornerDownLeft className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  </li>
                </ul>
              </div>
            )}
          </form>

          {/*
            Phone only: the way out of the sheet without reaching for Escape.
            A word rather than a second ✕ — the one in the field clears the
            term, this one leaves, and two identical glyphs an inch apart do
            not say which is which.
          */}
          {sheet && (
            <Button
              type="button"
              variant="link"
              onClick={closeSheet}
              className="text-muted-foreground hover:text-foreground h-auto shrink-0 px-1 py-0 no-underline hover:no-underline md:hidden"
            >
              {t('action.cancel')}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
