import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/react/input';
import { Label } from '@/components/ui/react/label';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Accessible names for the reveal button, in the caller's language. */
  showLabel: string;
  hideLabel: string;
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  /** Applied to the input, e.g. `h-11` on the taller auth forms. */
  className?: string;
}

/**
 * A password input with its own reveal toggle.
 *
 * Each instance holds its own visibility, so a form with two password fields
 * reveals them independently — one shared toggle would put a second password
 * on screen that the user never asked to see.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  showLabel,
  hideLabel,
  name,
  autoComplete = 'new-password',
  placeholder,
  minLength,
  required = true,
  className,
}: Props) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn('pr-10', className)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? hideLabel : showLabel}
          aria-pressed={show}
          // `tabIndex={-1}` on purpose: tabbing from the password field should
          // reach the submit button, not a decorative toggle.
          tabIndex={-1}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg focus-visible:ring-2 focus-visible:outline-hidden"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
