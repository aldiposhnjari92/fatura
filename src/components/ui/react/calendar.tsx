import * as React from 'react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import { sq } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/react/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Month grid used by DatePicker. Albanian locale and Monday-first weeks, which
 * is what an Albanian business expects to see.
 */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      locale={sq}
      weekStartsOn={1}
      showOutsideDays={showOutsideDays}
      className={cn('relative p-3', className)}
      classNames={{
        ...defaults,
        months: cn(defaults.months, 'flex flex-col gap-4'),
        month: cn(defaults.month, 'flex flex-col gap-4'),
        month_caption: cn(defaults.month_caption, 'flex h-9 items-center justify-center'),
        caption_label: cn(defaults.caption_label, 'text-sm font-semibold capitalize'),
        /*
          react-day-picker's own stylesheet is never imported (we restyle it
          entirely with Tailwind), so `.rdp-root { position: relative }` does
          not apply and the nav had no positioning context: the arrows escaped
          to the popover's top corners, sitting on a line above the month name
          instead of beside it. The root now establishes the context and the
          nav is laid out explicitly as a row over the caption.
        */
        nav: cn(
          defaults.nav,
          'absolute inset-x-3 top-3 z-10 flex h-9 items-center justify-between'
        ),
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'size-7 p-0 opacity-70 hover:opacity-100'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'size-7 p-0 opacity-70 hover:opacity-100'
        ),
        month_grid: cn(defaults.month_grid, 'w-full border-collapse'),
        weekdays: cn(defaults.weekdays, 'flex'),
        weekday: cn(
          defaults.weekday,
          'text-muted-foreground w-9 text-[0.7rem] font-medium capitalize'
        ),
        week: cn(defaults.week, 'mt-1 flex w-full'),
        day: cn(defaults.day, 'size-9 p-0 text-center text-sm'),
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-9 rounded-lg p-0 font-normal aria-selected:opacity-100'
        ),
        selected: cn(
          defaults.selected,
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground [&>button]:font-semibold'
        ),
        today: cn(defaults.today, '[&>button]:ring-primary/40 [&>button]:ring-1'),
        outside: cn(defaults.outside, 'text-muted-foreground/50'),
        disabled: cn(defaults.disabled, 'text-muted-foreground/40'),
        hidden: cn(defaults.hidden, 'invisible'),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'left' ? (
            <ChevronLeft className="size-4" {...rest} />
          ) : (
            <ChevronRight className="size-4" {...rest} />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
