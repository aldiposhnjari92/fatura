import { cn } from '@/lib/utils';
import type { FooterButtonProps, ToolButtonProps } from '@/models/page-builder-ui';

/** One icon on a selected block's toolbar. Never lets the click select the block underneath. */
export function ToolButton({ label, onClick, disabled, danger, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'text-muted-foreground rounded p-1 disabled:opacity-30 [&_svg]:size-3.5',
        danger ? 'hover:text-destructive' : 'hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

/** One icon in the panel's footer. */
export function FooterButton({ label, onClick, active, disabled, children }: FooterButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md p-1.5 transition-colors disabled:opacity-30 [&_svg]:size-4',
        active ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
