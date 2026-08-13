import * as React from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/react/button';
import { Calendar } from '@/components/ui/react/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/react/popover';
import { formatDate, toDateInput } from '@/lib/utils';

interface Props {
  id?: string;
  /** yyyy-mm-dd, the same shape the database and <input type="date"> used. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Parse yyyy-mm-dd as a *local* date — `new Date('2025-03-12')` is UTC midnight. */
function parseLocal(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return undefined;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Zgjidh datën',
  clearable = false,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = parseLocal(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'w-full justify-start gap-2 font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="shrink-0 opacity-70" />
          <span className="flex-1 text-left">
            {selected ? formatDate(selected) : placeholder}
          </span>
          {clearable && selected && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Pastro datën"
              className="hover:text-destructive -mr-1 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
              onClick={(event) => {
                // Don't let the click bubble into the trigger and open the popover.
                event.preventDefault();
                event.stopPropagation();
                onChange('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange('');
                }
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(date ? toDateInput(date) : '');
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
