import * as React from 'react';
import {
  Check,
  ChevronDown,
  FileText,
  Languages,
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
import { formatDate, initials } from '@/lib/utils';
import { FREE_INVOICE_LIMIT } from '@/lib/types';
import { LANGS, LANG_LABEL, useTranslations, type Lang } from '@/lib/i18n';

interface Props {
  businessName: string | null;
  email: string;
  logoUrl: string | null;
  isPro: boolean;
  /** ISO date the Pro period ends, when the customer has cancelled. */
  proEndsOn?: string | null;
  isAdmin?: boolean;
  invoicesThisMonth: number;
  lang: Lang;
  /** Where to return after switching language. */
  pathname: string;
}

export default function UserMenu({
  businessName,
  email,
  logoUrl,
  isPro,
  proEndsOn = null,
  isAdmin = false,
  invoicesThisMonth,
  lang,
  pathname,
}: Props) {
  const t = useTranslations(lang);
  const signOutRef = React.useRef<HTMLFormElement>(null);
  // One hidden form, retargeted per language — a POST so the cookie is set
  // server-side and the switch survives with JavaScript off elsewhere.
  const langFormRef = React.useRef<HTMLFormElement>(null);
  const langInputRef = React.useRef<HTMLInputElement>(null);
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
            aria-label={t('nav.accountMenu')}
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
                  {businessName || t('nav.yourBusiness')}
                </p>
                <p className="text-muted-foreground truncate text-xs">{email}</p>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Plan + usage: the free cap is the thing users hit, so surface it here. */}
          <div className="px-2 py-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium">{t('set.plan')}</span>
              <span
                className={
                  isPro
                    ? 'bg-brand/15 text-primary rounded-full px-2 py-0.5 text-[11px] font-bold'
                    : 'bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold'
                }
              >
                {isPro ? t('plan.proBadge') : t('plan.freeBadge')}
              </span>
            </div>

            {isPro ? (
              <p className="text-muted-foreground text-xs">
                {proEndsOn
                  ? t('sub.activeUntil', { date: formatDate(proEndsOn) })
                  : t('sub.unlimitedInvoices')}
              </p>
            ) : (
              <>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  {t('usage.remaining', { left: remaining, max: FREE_INVOICE_LIMIT })}
                </p>
              </>
            )}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <a href="/app/faturat">
              <FileText /> {t('nav.invoices')}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/app/klientet">
              <Users /> {t('nav.clients')}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/app/cilesimet">
              <Settings /> {t('nav.settings')}
            </a>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <a href="/app/abonimi">
              <CreditCard /> {t('nav.subscription')}
            </a>
          </DropdownMenuItem>

          {!isPro && (
            <DropdownMenuItem asChild>
              <a href="/app/abonimi" className="text-primary font-medium">
                <Sparkles /> {t('sub.upgrade')}
              </a>
            </DropdownMenuItem>
          )}

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/admin" className="font-medium">
                  <ShieldCheck /> {t('nav.adminConsole')}
                </a>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          {/* Only shown while more than one language is offered. */}
          {LANGS.length > 1 && (
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              {t('nav.language')}
            </DropdownMenuLabel>
          )}
          {LANGS.length > 1 &&
            LANGS.map((code) => (
            <DropdownMenuItem
              key={code}
              className={code === lang ? 'font-semibold' : undefined}
              onSelect={(event) => {
                event.preventDefault();
                if (code === lang) return;
                if (langInputRef.current) langInputRef.current.value = code;
                langFormRef.current?.submit();
              }}
            >
              <Languages /> {LANG_LABEL[code]}
              {code === lang && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          ))}

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
            <LogOut /> {t('nav.signOutAccount')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <form ref={signOutRef} method="POST" action="/auth/signout" className="hidden" />

      <form ref={langFormRef} method="POST" action="/api/lang" className="hidden">
        <input type="hidden" name="lang" ref={langInputRef} />
        <input type="hidden" name="next" value={pathname} />
      </form>
    </>
  );
}
