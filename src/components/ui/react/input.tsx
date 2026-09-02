import * as React from 'react';
import { cn } from '@/lib/utils';

/*
  40px is the standard height for every form control in this app — this field,
  the two selects, the date picker. It is the floor as well as the default:
  `min-h-10` sits alongside `h-10` so a call site that overrides the height can
  raise it (the auth forms run at `h-11`) but not drop a control below the
  standard, which is how the discount box ended up at 32px beside 36px fields.

  It is also the size a thumb can reliably hit. The controls that are not
  fields keep their own scale: Button has variants for a reason, and a `sm`
  button in a table row is not trying to look like an input.
*/

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 min-h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
