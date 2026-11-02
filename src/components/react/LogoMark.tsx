import { cn } from '@/lib/utils';
import type { LogoMarkProps } from '@/models/account';

/*
  The brand mark, for the React shells.

  The same 32×32 rounded square with three rules was inlined in AppShell and
  again in AdminShell — copies of what src/components/Logo.astro already draws. The Astro side cannot be imported
  into React, so one shared component per renderer is the floor; four was not.

  `invert` is the console's block: on ink, the square takes the brand teal and
  the rules go dark, so the mark still reads at the same weight.
*/

export default function LogoMark({ size = 30, invert = false, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect width="32" height="32" rx="8.5" fill={invert ? '#00ADB5' : '#222831'} />
      <path
        d="M10 9.5h12M10 15.5h8M10 21.5h5"
        stroke={invert ? '#222831' : '#00ADB5'}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
