import type {
  DateRange,
  EarningsBucket,
  EarningsInvoice,
  EarningsSummary,
  PaidInvoice,
  Period,
  PeriodPreset,
} from '@/models/earnings';

/*
  Të ardhurat — how much a business earned over a period it picks.

  "Earned" means collected: an invoice counts once it is marked paid, on the
  day it was paid (paid_at), not the day it was issued. That is the number a
  business owner means by "how much did I make in October" — money in hand.
  What was invoiced in the period is shown beside it, so the gap between the
  two (still to collect) is visible too.

  Days are Albanian days. The server runs in UTC, and an invoice paid at
  00:30 in Tirana on 1 November is 31 October in UTC; every date here is
  worked out in Europe/Tirane so it lands in the month the user expects.

  Pure functions only: the page fetches, this file counts.
*/

const TIME_ZONE = 'Europe/Tirane';

const MONTHS = [
  'janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor',
  'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor',
];
/** Sunday first, as Date.getUTCDay() counts. */
const WEEKDAYS = ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'];
const MONTHS_SHORT =['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'kor', 'gus', 'sht', 'tet', 'nën', 'dhj'];

/** The longest custom range accepted; anything wider is cut to its last ten years. */
const MAX_DAYS = 3660;

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'kjo-jave', label: 'Kjo javë' },
  { value: 'java-kaluar', label: 'Java e kaluar' },
  { value: 'ky-muaj', label: 'Ky muaj' },
  { value: 'muaji-kaluar', label: 'Muaji i kaluar' },
  { value: 'ky-vit', label: 'Ky vit' },
  { value: 'viti-kaluar', label: 'Viti i kaluar' },
  { value: 'tjeter', label: 'Periudhë tjetër' },
];

// ---- Dates (yyyy-mm-dd strings, calendar arithmetic in UTC) -------------------------

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(iso: string) {
  const [, y, m, d] = ISO.exec(iso)!;
  return { y: Number(y), m: Number(m), d: Number(d) };
}

function iso(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toISOString().slice(0, 10);
}

function isValidIso(value: string | null | undefined): value is string {
  if (!value || !ISO.test(value)) return false;
  const { y, m, d } = parts(value);
  return iso(y, m, d) === value;
}

function addDays(value: string, days: number): string {
  const { y, m, d } = parts(value);
  return iso(y, m, d + days);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The calendar day a moment falls on in Albania. */
export function albanianDate(moment: string | Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof moment === 'string' ? new Date(moment) : moment);
}

// ---- Labels ------------------------------------------------------------------------

/** "tetor 2026", "2025", "5 tetor 2026", "1 shtator – 15 tetor 2026". */
export function rangeLabel({ from, to }: DateRange): string {
  const a = parts(from);
  const b = parts(to);
  if (from === to) return `${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
  if (a.y === b.y && a.m === 1 && a.d === 1 && b.m === 12 && b.d === 31) return String(a.y);
  if (a.y === b.y && a.m === b.m && a.d === 1 && b.d === lastDayOfMonth(b.y, b.m)) {
    return `${MONTHS[a.m - 1]} ${a.y}`;
  }
  if (a.y === b.y && a.m === b.m) return `${a.d} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  const start = a.y === b.y ? `${a.d} ${MONTHS[a.m - 1]}` : `${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
  return `${start} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
}

// ---- Periods -----------------------------------------------------------------------

/*
  Every preset is a whole calendar period, never "so far": a week is Monday
  to Sunday, a month the 1st to its last day, a year January to December.
  Days still ahead simply show nothing yet. Each is compared with the whole
  period of the same kind just before it.
*/

/** The Monday of the week a day falls in — the Albanian week starts on Monday. */
function mondayOf(day: string): string {
  const weekday = new Date(Date.parse(day)).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

const week = (monday: string): DateRange => ({ from: monday, to: addDays(monday, 6) });

function month(y: number, m: number): DateRange {
  // Month 0 is December of the year before.
  const year = m < 1 ? y - 1 : y;
  const mon = m < 1 ? m + 12 : m;
  return { from: iso(year, mon, 1), to: iso(year, mon, lastDayOfMonth(year, mon)) };
}

const year = (y: number): DateRange => ({ from: iso(y, 1, 1), to: iso(y, 12, 31) });

function withLabels(preset: PeriodPreset, range: DateRange, previous: DateRange): Period {
  return {
    preset,
    ...range,
    label: rangeLabel(range),
    previous: { ...previous, label: rangeLabel(previous) },
  };
}

/**
 * The period a URL asks for. Anything missing or malformed falls back to this
 * month rather than to an error — a hand-edited link should still show a page.
 *
 * `data` moves the presets to another date: "ky-muaj" with data=2026-09-14 is
 * September 2026. That is what the page's ‹ › arrows link to.
 */
export function resolvePeriod(
  params: URLSearchParams,
  today: string = albanianDate()
): Period {
  const preset = (params.get('periudha') ?? 'ky-muaj') as PeriodPreset;
  const anchor = params.get('data');
  const base = isValidIso(anchor) ? anchor : today;
  const { y, m } = parts(base);
  const thisMonday = mondayOf(base);

  switch (preset) {
    case 'kjo-jave':
      return withLabels(preset, week(thisMonday), week(addDays(thisMonday, -7)));
    case 'java-kaluar':
      return withLabels(preset, week(addDays(thisMonday, -7)), week(addDays(thisMonday, -14)));
    case 'muaji-kaluar':
      return withLabels(preset, month(y, m - 1), month(y, m - 2));
    case 'ky-vit':
      return withLabels(preset, year(y), year(y - 1));
    case 'viti-kaluar':
      return withLabels(preset, year(y - 1), year(y - 2));
    case 'tjeter': {
      let from = params.get('nga');
      let to = params.get('deri');
      if (isValidIso(from) && isValidIso(to)) {
        // The end never comes before the start: a reversed link is read as that one day.
        if (to < from) to = from;
        if (daysBetween(from, to) > MAX_DAYS) from = addDays(to, -MAX_DAYS);
        const length = daysBetween(from, to) + 1;
        return withLabels(preset, { from, to }, { from: addDays(from, -length), to: addDays(from, -1) });
      }
      break;
    }
  }

  // ky-muaj, and anything the URL got wrong.
  return withLabels('ky-muaj', month(y, m), month(y, m - 1));
}

/** What a preset's period is measured in, for the arrows; null for a custom range. */
function unitOf(preset: PeriodPreset): PeriodPreset | null {
  if (preset === 'kjo-jave' || preset === 'java-kaluar') return 'kjo-jave';
  if (preset === 'ky-muaj' || preset === 'muaji-kaluar') return 'ky-muaj';
  if (preset === 'ky-vit' || preset === 'viti-kaluar') return 'ky-vit';
  return null;
}

/**
 * The query strings of the period just before and just after this one, the
 * same size. There is no "after" once the period reaches today — nothing has
 * been earned in the future yet.
 */
export function neighbours(period: Period, today: string = albanianDate()) {
  const unit = unitOf(period.preset);
  const length = daysBetween(period.from, period.to) + 1;
  const nextFrom = addDays(period.to, 1);
  const link = (from: string, to: string) =>
    unit
      ? `?${new URLSearchParams({ periudha: unit, data: from })}`
      : `?${new URLSearchParams({ periudha: 'tjeter', nga: from, deri: to })}`;
  return {
    previous: link(period.previous.from, period.previous.to),
    next: nextFrom > today ? null : link(nextFrom, addDays(period.to, length)),
  };
}

/** The preset button that matches the period on screen, if any — after the arrows it may be none. */
export function matchingPreset(period: Period, today: string = albanianDate()): PeriodPreset | null {
  if (period.preset === 'tjeter') return 'tjeter';
  for (const { value } of PERIOD_PRESETS) {
    if (value === 'tjeter') continue;
    const candidate = resolvePeriod(new URLSearchParams({ periudha: value }), today);
    if (candidate.from === period.from && candidate.to === period.to) return value;
  }
  return null;
}

// ---- Totals ------------------------------------------------------------------------

const inRange = (day: string, { from, to }: DateRange) => day >= from && day <= to;

/** The day an invoice counts as paid. paid_at is kept by a trigger; issue_date is the fallback. */
function paidOn(invoice: EarningsInvoice): string {
  return invoice.paid_at ? albanianDate(invoice.paid_at) : invoice.issue_date;
}

/** The VAT inside an invoice's total: what is left once the net amount is taken out. */
function vatOf(invoice: EarningsInvoice): number {
  const net = (Number(invoice.subtotal) || 0) - (Number(invoice.discount) || 0);
  return Math.max(0, (Number(invoice.total) || 0) - net);
}

function bucketSizeFor({ from, to }: DateRange): EarningsSummary['bucketSize'] {
  const days = daysBetween(from, to) + 1;
  if (days <= 31) return 'day';
  if (days <= 731) return 'month';
  return 'year';
}

/** Every bucket in the range, empty ones included, so a quiet month shows as a gap. */
function emptyBuckets(range: DateRange, size: EarningsSummary['bucketSize']): EarningsBucket[] {
  const out: EarningsBucket[] = [];
  const start = parts(range.from);
  const end = parts(range.to);

  if (size === 'day') {
    // A week reads by weekday ("Hën 2"); a month by date alone.
    const byWeekday = daysBetween(range.from, range.to) < 7;
    for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
      const { y, m, d } = parts(day);
      const weekday = WEEKDAYS[new Date(Date.parse(day)).getUTCDay()];
      out.push({
        key: day,
        short: byWeekday ? `${weekday} ${d}` : String(d),
        long: `${weekday}, ${d} ${MONTHS[m - 1]} ${y}`,
        amount: 0,
        count: 0,
      });
    }
  } else if (size === 'month') {
    for (let y = start.y, m = start.m; y < end.y || (y === end.y && m <= end.m); m === 12 ? (y++, (m = 1)) : m++) {
      out.push({
        key: `${y}-${String(m).padStart(2, '0')}`,
        // The year goes under January, so a range across New Year still says which one.
        short: m === 1 || out.length === 0 ? `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}` : MONTHS_SHORT[m - 1],
        long: `${MONTHS[m - 1]} ${y}`,
        amount: 0,
        count: 0,
      });
    }
  } else {
    for (let y = start.y; y <= end.y; y++) {
      out.push({ key: String(y), short: String(y), long: String(y), amount: 0, count: 0 });
    }
  }
  return out;
}

const bucketKey = (day: string, size: EarningsSummary['bucketSize']) =>
  size === 'day' ? day : size === 'month' ? day.slice(0, 7) : day.slice(0, 4);

/**
 * Everything the page shows for a period.
 *
 * `paidRows` are invoices with status 'paid' whose paid_at may fall in the
 * period or the one before it (fetched with a day's margin either side, so
 * the time-zone shift cannot drop one). `issuedRows` are the non-draft
 * invoices issued in the period.
 */
export function summarize(
  period: Period,
  paidRows: EarningsInvoice[],
  issuedRows: EarningsInvoice[],
  today: string = albanianDate()
): EarningsSummary {
  const size = bucketSizeFor(period);
  const buckets = emptyBuckets(period, size);
  const byBucket = new Map(buckets.map((b) => [b.key, b]));

  const paid: PaidInvoice[] = [];
  let earned = 0;
  let earnedVat = 0;
  let previousEarned = 0;

  for (const invoice of paidRows) {
    if (invoice.status !== 'paid') continue;
    const day = paidOn(invoice);
    const total = Number(invoice.total) || 0;
    if (inRange(day, period.previous)) previousEarned += total;
    if (!inRange(day, period)) continue;

    earned += total;
    earnedVat += vatOf(invoice);
    paid.push({ ...invoice, paidOn: day });

    const bucket = byBucket.get(bucketKey(day, size));
    if (bucket) {
      bucket.amount += total;
      bucket.count += 1;
    }

  }

  let invoiced = 0;
  let outstanding = 0;
  let outstandingCount = 0;
  let overdueCount = 0;
  const issued = issuedRows.filter((i) => i.status !== 'draft' && inRange(i.issue_date, period));
  for (const invoice of issued) {
    const total = Number(invoice.total) || 0;
    invoiced += total;
    if (invoice.status !== 'paid') {
      outstanding += total;
      outstandingCount += 1;
      if (invoice.status === 'overdue' || (invoice.due_date && invoice.due_date < today)) overdueCount += 1;
    }
  }

  paid.sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.invoice_number.localeCompare(a.invoice_number));

  return {
    earned,
    earnedVat,
    paidCount: paid.length,
    previousEarned,
    invoiced,
    invoicedCount: issued.length,
    outstanding,
    outstandingCount,
    overdueCount,
    bucketSize: size,
    buckets,
    paid,
  };
}

/** Percentage change, or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** A round top for the chart's scale: 1, 2, 2.5, 5 or 10 × a power of ten. */
export function niceMax(value: number): number {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value)!;
  return step * power;
}

/** The query window: both periods, with a day's margin for the time-zone shift. */
export function fetchWindow(period: Period): { paidFrom: string; paidUntil: string } {
  return {
    paidFrom: `${addDays(period.previous.from, -1)}T00:00:00Z`,
    paidUntil: `${addDays(period.to, 2)}T00:00:00Z`,
  };
}
