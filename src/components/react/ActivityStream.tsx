import * as React from 'react';
import { Bell, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatALL, formatDate } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';

export interface ActivityRow {
  id: number;
  type: string;
  ref: string | null;
  amount: number | null;
  created_at: string;
  business_name: string | null;
  city: string | null;
}

interface Props {
  /** Server-rendered first page, so the list is never empty on load. */
  initial?: ActivityRow[];
  /**
   * `bell`  — header button with an unread count and a dropdown panel
   * `list`  — the history table body
   * `toast` — floating notifications
   */
  variant?: 'bell' | 'toast' | 'list';
  /**
   * Which feed to read. `platform` is every business (managers and admins);
   * `own` is only the signed-in customer's own events, scoped by RLS.
   */
  scope?: 'platform' | 'own';
}

/** Colour and label per event type. Unknown types still render, greyed. */
const META: Record<string, { label: string; tone: string }> = {
  'invoice.created': { label: 'Faturë e re', tone: 'bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200' },
  'invoice.paid': { label: 'Faturë e paguar', tone: 'bg-teal-100 text-teal-900 dark:bg-brand/20 dark:text-brand' },
  'payment.requested': { label: 'Pagesë e kërkuar', tone: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200' },
  'payment.confirmed': { label: 'Pagesë e konfirmuar', tone: 'bg-teal-100 text-teal-900 dark:bg-brand/20 dark:text-brand' },
  'payment.rejected': { label: 'Pagesë e refuzuar', tone: 'bg-red-100 text-red-900 dark:bg-red-400/15 dark:text-red-200' },
  'subscription.started': { label: 'Abonim i ri', tone: 'bg-teal-100 text-teal-900 dark:bg-brand/20 dark:text-brand' },
  'subscription.cancelled': { label: 'Abonim i anuluar', tone: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200' },
  'subscription.ended': { label: 'Abonim i mbaruar', tone: 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200' },
  'user.signup': { label: 'Regjistrim i ri', tone: 'bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200' },
  'user.onboarded': { label: 'Profil i plotësuar', tone: 'bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200' },
};

function meta(type: string) {
  return META[type] ?? { label: type, tone: 'bg-muted text-muted-foreground' };
}

/**
 * Live platform activity.
 *
 * Subscribes to INSERTs on activity_events. The table's RLS policy is
 * manager-only, so a customer who opened this channel would receive nothing —
 * the subscription is not the access control, the policy is.
 */
/*
  Each mount gets its own channel name.

  supabase-js caches channels by name, and React runs effects twice in
  development — the second run then calls .on() on a channel that is already
  subscribed, which throws "cannot add postgres_changes callbacks ... after
  subscribe()". A per-mount name sidesteps the cache entirely.
*/
let channelSeq = 0;

export default function ActivityStream({
  initial = [],
  variant = 'toast',
  scope = 'platform',
}: Props) {
  const t = useTranslations();
  const [rows, setRows] = React.useState<ActivityRow[]>(initial);
  const [toasts, setToasts] = React.useState<ActivityRow[]>([]);
  const [live, setLive] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const loaded = React.useRef(false);

  /*
    The bell fetches its history the first time it is opened, not on page load.
    Every console page mounts this component, so fetching eagerly would add a
    query to each of them for a panel most visits never open.
  */
  async function loadOnce() {
    if (loaded.current) return;
    loaded.current = true;
    const { data } = await supabase.rpc(
      scope === 'own' ? 'my_activity' : 'activity_feed',
      { p_limit: 20 }
    );
    const fetched = (data as { rows: ActivityRow[] } | null)?.rows ?? [];
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      return [...prev, ...fetched.filter((r) => !seen.has(r.id))];
    });
  }

  // Close on outside tap and on Escape — both needed for the panel to feel
  // right on a phone, where there is no cursor to move away.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  React.useEffect(() => {
    const name = `activity-stream-${(channelSeq += 1)}`;
    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_events' },
        (payload) => {
          const row = payload.new as ActivityRow;
          // The realtime payload is the raw row — it has no business_name,
          // which is joined at read time. Showing the reference is enough for
          // a notification; the history table fills in the rest on reload.
          setRows((prev) => [row, ...prev].slice(0, 100));
          if (variant === 'bell') setUnread((n) => Math.min(n + 1, 99));
          if (variant === 'toast') {
            setToasts((prev) => [row, ...prev].slice(0, 4));
            setTimeout(
              () => setToasts((prev) => prev.filter((x) => x.id !== row.id)),
              8000
            );
          }
        }
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [variant]);

          if (variant === 'bell') {
    return (
      <div className="relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setUnread(0);
            void loadOnce();
          }}
          aria-expanded={open}
          aria-label={t('adm.notifications')}
          className="hover:bg-muted focus-visible:ring-ring relative flex size-10 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
              {unread}
            </span>
          )}
          <span
            className={[
              'absolute right-1.5 bottom-1.5 size-1.5 rounded-full',
              live ? 'bg-teal-500' : 'bg-muted-foreground/40',
            ].join(' ')}
            aria-hidden="true"
          />
        </button>

        {open && (
          /*
            Anchored to the button on a wide screen, but pinned to the viewport
            edges below `sm` — a right-anchored dropdown would otherwise hang
            off the side of a phone.
          */
          <div className="bg-popover ring-border animate-rise fixed inset-x-3 top-16 z-50 max-h-[70vh] overflow-y-auto rounded-xl shadow-xl ring-1 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">{t('adm.notifications')}</p>
              {/* There is no customer-facing history page, and /admin is
                  closed to them — so the link only shows for operators. */}
              {scope === 'platform' && (
                <a href="/admin/aktiviteti" className="text-primary text-xs font-medium">
                  {t('adm.viewAll')}
                </a>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="text-muted-foreground px-4 py-10 text-center text-sm">
                {t('adm.noResults')}
              </p>
            ) : (
              <ul className="divide-y">
                {rows.slice(0, 20).map((row) => {
                  const m = meta(row.type);
                  return (
                    <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.tone}`}
                      >
                        {m.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {row.business_name ?? row.ref ?? '—'}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {row.amount != null && `${formatALL(row.amount)} · `}
                          {formatDate(row.created_at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'toast') {
    return (
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((row) => {
          const m = meta(row.type);
          return (
            <div
              key={row.id}
              className="bg-card shadow-card ring-border/60 animate-rise pointer-events-auto flex items-start gap-3 rounded-xl p-3.5 shadow-xl ring-1"
            >
              <span className="bg-accent text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Bell className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{m.label}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {row.ref ?? '—'}
                  {row.amount != null && ` · ${formatALL(row.amount)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== row.id))}
                className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1"
                aria-label={t('action.close')}
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <span
          className={[
            'size-2 rounded-full',
            live ? 'bg-teal-500' : 'bg-muted-foreground/40',
          ].join(' ')}
          aria-hidden="true"
        />
        <span className="text-muted-foreground text-xs">
          {live ? 'Live' : '—'}
        </span>
      </div>

      <div className="bg-card shadow-card overflow-hidden rounded-2xl">
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-5 py-12 text-center text-sm">
            {t('adm.noResults')}
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => {
              const m = meta(row.type);
              return (
                <li key={row.id} className="flex items-center gap-4 px-5 py-3">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.tone}`}
                  >
                    {m.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {row.business_name ?? (
                      <span className="text-muted-foreground italic">
                        {t('adm.noName')}
                      </span>
                    )}
                    {row.ref && (
                      <span className="text-muted-foreground font-mono text-xs">
                        {' '}
                        · {row.ref}
                      </span>
                    )}
                  </span>
                  {row.amount != null && (
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {formatALL(row.amount)}
                    </span>
                  )}
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatDate(row.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
