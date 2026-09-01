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
import { Button } from '@/components/ui/react/button';
import { formatDate, initials } from '@/lib/utils';
import { invoiceLimitOf, planOf, usageRatio, type PlanId } from '@/lib/plans';
import { useTranslations } from '@/lib/i18n';

interface Props {
  businessName: string | null;
  email: string;
  logoUrl: string | null;
  /** The tier in force — 'free' once a paid plan has lapsed. */
  plan: PlanId;
  /** ISO date the paid period ends, when the customer has cancelled. */
  proEndsOn?: string | null;
  isAdmin?: boolean;
  invoicesThisMonth: number;
}

export default function UserMenu({
  businessName,
  email,
  logoUrl,
  plan,
  proEndsOn = null,
  isAdmin = false,
  invoicesThisMonth,
}: Props) {
  const t = useTranslations();
  const signOutRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);
  /* When the menu last closed itself — see the trigger below. */
  const dismissedAt = React.useRef(0);
  const label = businessName || email;
  /* Unlimited on Pro, 30 on Starter, 5 on free — the meter follows the tier. */
  const monthlyLimit = invoiceLimitOf(plan);
  const remaining = monthlyLimit === null ? null : Math.max(monthlyLimit - invoicesThisMonth, 0);
  const usedPct = usageRatio(plan, invoicesThisMonth) * 100;

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (!next) dismissedAt.current = Date.now();
          setOpen(next);
        }}
      >
        <DropdownMenuTrigger
          asChild
          onPointerDown={(event) => event.preventDefault()}
          onClick={(event) => {
            if (event.detail === 0) return;
            if (Date.now() - dismissedAt.current < 350) return;
            setOpen(true);
          }}
        >
          <Button
            type="button"
            variant="ghost"
            className="h-auto touch-manipulation gap-2 rounded-full py-1 pr-2 pl-1"
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
          </Button>
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
                  plan !== 'free'
                    ? 'bg-brand/15 text-primary rounded-full px-2 py-0.5 text-[11px] font-bold'
                    : 'bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold'
                }
              >
                {planOf(plan).badge}
              </span>
            </div>

            {monthlyLimit === null ? (
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
                  {t('usage.remaining', { left: remaining ?? 0, max: monthlyLimit })}
                </p>
                {proEndsOn && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t('sub.activeUntil', { date: formatDate(proEndsOn) })}
                  </p>
                )}
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

          {/* Nothing to upsell on Pro; Starter is offered the step above it. */}
          {plan !== 'pro' && (
            <DropdownMenuItem asChild>
              <a
                href={plan === 'free' ? '/app/abonimi?plan=starter' : '/app/abonimi?plan=pro'}
                className="text-primary font-medium"
              >
                <Sparkles /> {plan === 'free' ? t('sub.upgradeStarter') : t('sub.upgrade')}
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
    </>
  );
}
