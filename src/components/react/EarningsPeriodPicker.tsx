import * as React from 'react';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { DatePicker } from '@/components/ui/react/date-picker';
import { Label } from '@/components/ui/react/label';
import { cn } from '@/lib/utils';
import { PERIOD_PRESETS } from '@/lib/earnings';
import type { EarningsPeriodPickerProps } from '@/models/earnings';

/*
  The period choice on Të ardhurat. The presets are ordinary links — the page
  is rendered on the server from the URL, so a link is all a preset needs, and
  it works before this island has hydrated. Only "Periudhë tjetër" needs
  script: it opens two date fields and sends their range to the same URL.
*/

export default function EarningsPeriodPicker({ preset, from, to }: EarningsPeriodPickerProps) {
  const [custom, setCustom] = React.useState(preset === 'tjeter');
  const [start, setStart] = React.useState(from);
  const [end, setEnd] = React.useState(to);

  /* A start moved past the end pulls the end along, so the range is never backwards. */
  function changeStart(value: string) {
    setStart(value);
    if (value && end && end < value) setEnd(value);
  }

  function apply(event: React.FormEvent) {
    event.preventDefault();
    if (!start || !end || end < start) return;
    const params = new URLSearchParams({ periudha: 'tjeter', nga: start, deri: end });
    window.location.assign(`?${params}`);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* One scrolling row on a phone, so the sticky toolbar stays short; wraps from `sm`. */}
      <nav aria-label="Periudha" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 sm:flex-wrap">
        {PERIOD_PRESETS.map((option) => {
          const current = option.value === 'tjeter' ? custom : !custom && option.value === preset;
          const classes = cn(
            'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
            current ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          );
          return option.value === 'tjeter' ? (
            <button
              key={option.value}
              type="button"
              aria-expanded={custom}
              onClick={() => setCustom((v) => !v)}
              className={cn(classes, 'inline-flex items-center gap-1.5')}
            >
              <CalendarRange className="size-4" />
              {option.label}
            </button>
          ) : (
            <a
              key={option.value}
              href={`?periudha=${option.value}`}
              aria-current={current ? 'page' : undefined}
              className={classes}
            >
              {option.label}
            </a>
          );
        })}
      </nav>

      {custom && (
        <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
          <div className="w-full space-y-1.5 sm:w-44">
            <Label htmlFor="earnings-from">Nga data</Label>
            <DatePicker id="earnings-from" value={start} onChange={changeStart} aria-label="Nga data" />
          </div>
          <div className="w-full space-y-1.5 sm:w-44">
            <Label htmlFor="earnings-to">Deri më</Label>
            {/* Days before the start are greyed out and cannot be picked. */}
            <DatePicker id="earnings-to" value={end} onChange={setEnd} min={start} aria-label="Deri më" />
          </div>
          <Button type="submit" disabled={!start || !end}>
            Shfaq
          </Button>
        </form>
      )}
    </div>
  );
}
