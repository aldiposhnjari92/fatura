import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

/*
  Two shapes of the same control.

  `RadioGroupItem` is the stock dot. `RadioGroupCard` is the same primitive
  drawn as a full selection card — the plan, term and payment-method pickers
  are all "one of these", and rendering them as radios rather than as a row of
  `aria-pressed` buttons is what gives them arrow-key navigation and a single
  announced group instead of N independent toggles.
*/

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn('grid gap-2', className)} {...props} />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      'border-input text-primary focus-visible:ring-ring aspect-square size-4 shrink-0 rounded-full border shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <Circle className="size-2 fill-current text-current" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

/**
 * A radio rendered as a bordered card. Carries `group/radio-card`, so anything
 * inside can style itself off `group-data-[state=checked]/radio-card:`.
 */
const RadioGroupCard = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      'press group/radio-card focus-visible:ring-ring relative rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
      'enabled:hover:data-[state=unchecked]:border-input enabled:hover:data-[state=unchecked]:bg-muted/50',
      'data-[state=checked]:border-primary data-[state=checked]:bg-accent/50 data-[state=checked]:ring-primary/25 data-[state=checked]:ring-2',
      'disabled:cursor-not-allowed disabled:opacity-55',
      className
    )}
    {...props}
  >
    {children}
  </RadioGroupPrimitive.Item>
));
RadioGroupCard.displayName = 'RadioGroupCard';

/** The tick that marks the chosen `RadioGroupCard`. */
function RadioGroupCardIndicator({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'border-input group-data-[state=checked]/radio-card:border-primary group-data-[state=checked]/radio-card:bg-primary group-data-[state=checked]/radio-card:text-primary-foreground flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
        className
      )}
    >
      <Check
        className="size-2.5 opacity-0 transition-opacity group-data-[state=checked]/radio-card:opacity-100"
        strokeWidth={3.5}
        aria-hidden="true"
      />
    </span>
  );
}

export { RadioGroup, RadioGroupItem, RadioGroupCard, RadioGroupCardIndicator };
