import * as React from 'react';
import {
  ChevronDown,
  FileText,
  LogOut,
  CreditCard,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/react/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/react/dropdown-menu';
import { initials } from '@/lib/utils';
import { FREE_INVOICE_LIMIT } from '@/lib/types';

interface Props {
  businessName: string | null;
  email: string;
  logoUrl: string | null;
  isPro: boolean;
  isAdmin?: boolean;
  invoicesThisMonth: number;
}

export default function UserMenu({
  businessName,
  email,
  logoUrl,
  isPro,
  isAdmin = false,
  invoicesThisMonth,
}: Props) {
  const signOutRef = React.useRef<HTMLFormElement>(null);
  const label = businessName || email;
  const remaining = Math.max(FREE_INVOICE_LIMIT - invoicesThisMonth, 0);
  const usedPct = Math.min((invoicesThisMonth / FREE_INVOICE_LIMIT) * 100, 100);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="hover:bg-muted focus-visible:ring-ring flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
            aria-label="Menuja e llogarisë"
          >
            <Avatar>
              {logoUrl && <AvatarImage src={logoUrl} alt="" />}
              <AvatarFallback>{initials(label)}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:block">
              {label}
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-3 px-2 py-2.5">
              <Avatar className="size-10">
                {logoUrl && <AvatarImage src={logoUrl} alt="" />}
                <AvatarFallback>{initials(label)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {businessName || 'Biznesi yt'}
                </p>
                <p className="text-muted-foreground truncate text-xs">{email}</p>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Plan + usage: the free cap is the thing users hit, so surface it here. */}
          <div className="px-2 py-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium">Plani</span>
              <span
                className={
                  isPro
                    ? 'bg-brand/15 text-primary rounded-full px-2 py-0.5 text-[11px] font-bold'
                    : 'bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold'
                }
              >
                {isPro ? 'PRO' : 'FALAS'}
              </span>
            </div>

            {isPro ? (
              <p className="text-muted-foreground text-xs">Fatura të palimituara.</p>
            ) : (
              <>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  {remaining} nga {FREE_INVOICE_LIMIT} fatura të mbetura këtë muaj
                </p>
              </>
            )}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <a href="/app/faturat">
              <FileText /> Faturat
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/app/klientet">
              <Users /> Klientët
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/app/cilesimet">
              <Settings /> Cilësimet
            </a>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <a href="/app/abonimi">
              <CreditCard /> Abonimi
            </a>
          </DropdownMenuItem>

          {!isPro && (
            <DropdownMenuItem asChild>
              <a href="/app/abonimi" className="text-primary font-medium">
                <Sparkles /> Kalo në Pro
              </a>
            </DropdownMenuItem>
          )}

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/admin" className="font-medium">
                  <ShieldCheck /> Konsola e adminit
                </a>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(event) => {
              // Let the menu close first, then POST — a GET sign-out would be
              // triggerable cross-site.
              event.preventDefault();
              signOutRef.current?.submit();
            }}
          >
            <LogOut /> Dil nga llogaria
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <form ref={signOutRef} method="POST" action="/auth/signout" className="hidden" />
    </>
  );
}
