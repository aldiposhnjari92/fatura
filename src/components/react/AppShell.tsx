import * as React from 'react';
import {
  FileText,
  LayoutDashboard,
  LifeBuoy,
  SquarePen,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/react/sidebar';
import ActivityStream from '@/components/react/ActivityStream';
import GlobalSearch from '@/components/react/GlobalSearch';
import UserMenu from '@/components/react/UserMenu';
import { cn } from '@/lib/utils';
import type { PlanId } from '@/lib/plans';

/*
  The signed-in shell: rail, top bar, page, phone nav.

  It is one island rather than four because the sidebar is shadcn's, and that
  component is a context — the trigger in the bar, the collapse state, the
  keyboard shortcut and the width the page is offset by all read the same
  provider. Splitting it would mean re-implementing the parts that talk to each
  other, which is the thing this replaced.

  The page itself is not React: it arrives as `children` from an Astro slot,
  server-rendered, and Astro's renderer holds it in a memoised static wrapper —
  so the islands inside a page (the invoice editor, the client table) hydrate
  normally and are never re-rendered by anything happening out here.
*/

export type NavKey = 'dashboard' | 'invoices' | 'new' | 'clients' | 'settings';
export type IconKey = 'layout-dashboard' | 'file-text' | 'square-pen' | 'users';

const ICONS: Record<IconKey, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  'file-text': FileText,
  'square-pen': SquarePen,
  users: Users,
};

export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  icon: IconKey;
}

export interface NavGroup {
  group: string | null;
  items: NavItem[];
}

interface Props {
  heading?: string;
  active: NavKey;
  dashboardHref: string;
  nav: NavGroup[];
  mobileNav: NavItem[];
  newInvoiceLabel: string;
  /** The rail's state as the server read it from the sidebar_state cookie. */
  defaultSidebarOpen: boolean;
  searchQuery: string;
  businessName: string | null;
  email: string;
  logoUrl: string | null;
  plan: PlanId;
  proEndsOn: string | null;
  isAdmin: boolean;
  invoicesThisMonth: number;
  children?: React.ReactNode;
}

/** The mark on its own, so the wordmark can drop when the rail narrows. */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect width="32" height="32" rx="8.5" fill="#222831" />
      <path
        d="M10 9.5h12M10 15.5h8M10 21.5h5"
        stroke="#00ADB5"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Wordmark() {
  return (
    <span className="text-foreground text-[1.0625rem] font-bold tracking-[-0.02em]">
      Fatura<span className="text-primary">.co</span>
    </span>
  );
}

export default function AppShell({
  heading,
  active,
  dashboardHref,
  nav,
  mobileNav,
  newInvoiceLabel,
  defaultSidebarOpen,
  searchQuery,
  businessName,
  email,
  logoUrl,
  plan,
  proEndsOn,
  isAdmin,
  invoicesThisMonth,
  children,
}: Props) {
  const [stuck, setStuck] = React.useState(false);

  /*
    Shadow under the bar once the page has moved beneath it. An observer on the
    strip above the header rather than a scroll listener, so it costs nothing
    per frame; without IntersectionObserver the bar simply stays flat.
  */
  const sentinel = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const node = sentinel.current;
    if (!node || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} className="bg-ground min-h-screen">
      {/*
        `lg:contents` rather than a prop on the sidebar: below `lg` the phone
        nav owns navigation, and `useIsMobile` only knows the width after it
        has mounted — so without this the rail would be server-rendered and
        then thrown away on a phone, one frame wide.
      */}
      <div className="hidden lg:contents">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <a
              href={dashboardHref}
              aria-label="Fatura.co — paneli"
              className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 group-data-[collapsible=icon]:px-0"
            >
              <LogoMark />
              <span className="group-data-[collapsible=icon]:hidden">
                <Wordmark />
              </span>
            </a>
          </SidebarHeader>

          <SidebarContent>
            {nav.map((section) => (
              <SidebarGroup key={section.group ?? 'root'}>
                {section.group && <SidebarGroupLabel>{section.group}</SidebarGroupLabel>}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const Icon = ICONS[item.icon];
                      return (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton
                            asChild
                            isActive={active === item.key}
                            tooltip={item.label}
                          >
                            <a href={item.href} aria-current={active === item.key ? 'page' : undefined}>
                              <Icon />
                              <span>{item.label}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          {/*
            Support, which a signed-in user can otherwise only find in the
            marketing footer they never see. Collapsed, it is the same menu
            button as everything above it — a mail link with a tooltip.
          */}
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="aldiposhnjari@gmail.com"
                  className="group-data-[collapsible=icon]:!p-2"
                >
                  <a href="mailto:aldiposhnjari@gmail.com">
                    <LifeBuoy />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-xs font-semibold">Të duhet ndihmë?</span>
                      <span className="text-muted-foreground truncate text-[11px]">
                        aldiposhnjari@gmail.com
                      </span>
                    </span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>

          {/* The draggable edge: the second way to collapse, alongside ⌘B. */}
          <SidebarRail />
        </Sidebar>
      </div>

      <SidebarInset className="bg-ground min-w-0">
        <div ref={sentinel} aria-hidden="true" className="h-px w-full" />

        <header
          data-stuck={stuck}
          className="bg-card sticky top-0 z-40 backdrop-blur-md transition-shadow duration-300 data-[stuck=true]:shadow-card"
        >
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
            {/*
              In the bar rather than in the rail: collapsed to icons the rail
              has no room for it, and a control that disappears in the state it
              exists to undo leaves ⌘B and the drag rail as the only way back.
            */}
            <SidebarTrigger className="-ml-1 hidden lg:flex" />

            {/* The rail carries the mark from `lg`; below that the bar does. */}
            <a href={dashboardHref} className="lg:hidden" aria-label="Fatura.co — paneli">
              <span className="inline-flex items-center gap-2.5">
                <LogoMark />
                <Wordmark />
              </span>
            </a>

            {/*
              The field from `md` up, and on a phone the magnifier that opens
              it as a sheet. Both are direct children of this row, and the
              magnifier carries the `ml-auto` that packs the trailing controls
              — from `md` the cluster below takes that over.
            */}
            <GlobalSearch initialQuery={searchQuery} />

            <div className="flex items-center gap-2 md:ml-auto">
              {/*
                The bell replaces the new-invoice button here. Creating an
                invoice is still one tap away: the floating button on a phone,
                the rail item on a desktop.
              */}
              <ActivityStream variant="bell" scope="own" />

              <UserMenu
                businessName={businessName}
                email={email}
                logoUrl={logoUrl}
                plan={plan}
                proEndsOn={proEndsOn}
                isAdmin={isAdmin}
                invoicesThisMonth={invoicesThisMonth}
              />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pt-4 pb-28 sm:px-6 md:pb-10">
          {heading && (
            <h1 className="mb-6 text-2xl font-bold tracking-[-0.02em] sm:text-3xl">{heading}</h1>
          )}
          {children}
        </main>
      </SidebarInset>

      {/* Phone navigation: this product lives on phones. */}
      <nav
        className="bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Navigimi mobil"
      >
        <div className="flex">
          {mobileNav.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <a
                key={item.key}
                href={item.href}
                aria-current={active === item.key ? 'page' : undefined}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  active === item.key ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>

      <a
        href="/app/faturat/e-re"
        className="bg-primary text-primary-foreground fixed right-4 bottom-20 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full text-2xl font-light shadow-lg transition-transform hover:scale-105 lg:hidden"
        aria-label={newInvoiceLabel}
      >
        +
      </a>
    </SidebarProvider>
  );
}
