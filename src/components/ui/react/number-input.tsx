import * as React from 'react';
import { Input } from '@/components/ui/react/input';

interface NumberInputProps
  extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange: (value: number) => void;
}

/** Digits only, no leading zeros. Zero is written as '' so the placeholder shows. */
function canonical(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * Integer field that always displays the number it holds.
 *
 * A plain `<Input type="number" value={n}>` drifts out of sync: typing a digit
 * next to an existing one produces text like '01' or '02500' that parses back to
 * the value already in state, so React skips the re-render and the DOM keeps the
 * wrong text. This keeps the typed text in local state and rewrites the input's
 * value when it isn't canonical, so what's on screen and what's stored agree.
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onValueChange, placeholder = '0', ...props }, ref) => {
    const [draft, setDraft] = React.useState(() => (value === 0 ? '' : String(value)));

    // Follow the value when it changes from the outside (loaded invoice, reset).
    // Typing never trips this: the draft already parses to the value pushed down.
    React.useEffect(() => {
      if ((Number(draft) || 0) !== value) setDraft(value === 0 ? '' : String(value));
      // eslint-disable-next-line react-hooks/exhaustive-deps -- draft is the mirror, not a trigger
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const next = canonical(e.target.value);
      // React bails out of re-rendering when `next` equals the current draft, so
      // fix the DOM here rather than relying on the render pass to do it.
      if (next !== e.target.value) e.target.value = next;
      setDraft(next);
      onValueChange(next === '' ? 0 : Number(next));
    }

    return (
      <Input
        ref={ref}
        // Text, not number: a `number` input reports '' for junk like '1e',
        // which would silently wipe the value instead of ignoring the keystroke.
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={draft}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
NumberInput.displayName = 'NumberInput';

export { NumberInput };
