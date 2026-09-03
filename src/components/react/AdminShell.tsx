import * as React from 'react';
import {
  Activity,
  ArrowLeft,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  ScrollText,
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/react/sidebar';
import ActivityStream from '@/components/react/ActivityStream';
import LogoMark from '@/components/react/LogoMark';
import { initials } from '@/lib/utils';
import { Toaster } from '@/components/ui/react/sonner';


/*
  The operator console's shell — the same chrome as /app, built on the same
  shadcn sidebar: a rail that collapses to icons, ⌘B, the draggable edge, and
  a sticky bar that gains a shadow once the page moves under it.

  It is a separate component from AppShell rather than a flag on it. The two
  consoles share a *design*, not a payload: this one has no invoice search, no
  plan meter, no customer account menu, and its nav is gated on a role. Fusing
  them would put every operator control one boolean away from the customer
  chrome, which is exactly the mistake the old layout was written to avoid.

  What the console does keep is the marker: the ink brand block pinned at the
  top of the rail, badged ADMIN or MENAXHER. It survives the rail collapsing —
  the badge moves onto the mark itself — because "you are operating on other
  people's data" is not a thing to hide behind a toggle.
*/

export type AdminNavKey =
  | 'overview'
  | 'invoices'
  | 'activity'
  | 'users'
  | 'payments'
  | 'waitlist'
  | 'audit';

export type AdminIconKey =
  | 'layout-dashboard'
  | 'activity'
  | 'file-text'
  | 'users'
  | 'credit-card'
  | 'clipboard-list'
  | 'scroll-text';

const ICONS: Record<AdminIconKey, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  activity: Activity,
  'file-text': FileText,
  users: Users,
  'credit-card': CreditCard,
  'clipboard-list': ClipboardList,
  'scroll-text': ScrollText,
};

export interface AdminNavItem {
  key: AdminNavKey;
  href: string;
  label: string;
  icon: AdminIconKey;
}

export interface AdminNavGroup {
  group: string | null;
  items: AdminNavItem[];
}

interface Props {
  heading: string;
  subheading?: string;
  active: AdminNavKey;
  nav: AdminNavGroup[];
  /** Pending-payment count, badged on the Payments item. */
  pendingCount: number;
  isAdmin: boolean;
  businessName: string | null;
  email: string;
  backToAppHref: string;
  labels: {
    console: string;
    backToApp: string;
    signOut: string;
    /** Read out with the count on the phone bar's pending-payments badge. */
    pendingPayments: string;
  };
  /** The rail's state as the server read it from the sidebar_state cookie. */
  defaultSidebarOpen: boolean;
  /** Page-level controls, slotted in beside the bell. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export default function AdminShell({
  heading,
  subheading,
  active,
  nav,
  pendingCount,
  isAdmin,
  businessName,
  email,
  backToAppHref,
  labels,
  defaultSidebarOpen,
  actions,
  children,
}: Props) {
  const [stuck, setStuck] = React.useState(false);
  const badge = isAdmin ? 'ADMIN' : 'MENAXHER';

  /*
    Shadow under the bar once the page has moved beneath it — an observer on
    the strip above the header rather than a scroll listener, so it costs
    nothing per frame. Same arrangement as the customer shell.
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
        Below `lg` the rail becomes a sheet, which portals to the body — so
        hiding this wrapper suppresses only the pre-hydration desktop markup,
        not the drawer. Without it a tablet paints the full rail for one frame
        before `useIsMobile` resolves and throws it away.
      */}
      <div className="max-lg:hidden">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <a
              href="/admin"
              aria-label={labels.console}
              data-nav-feedback="off"
              className="bg-ink flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <LogoMark size={26} invert />
                <span className="text-mist text-[1.0625rem] font-bold tracking-[-0.02em] group-data-[collapsible=icon]:hidden">
                  Fatura<span className="text-brand">.co</span>
                </span>
              </span>
              <span className="bg-brand/20 text-brand rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide group-data-[collapsible=icon]:hidden">
                {badge}
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
                      const showBadge = item.key === 'payments' && pendingCount > 0;
                      return (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton
                            asChild
                            isActive={active === item.key}
                            tooltip={item.label}
                          >
                            {/* Same as the customer rail: the bar at the top
                                is the only navigation feedback here. */}
                            <a
                              href={item.href}
                              aria-current={active === item.key ? 'page' : undefined}
                              data-nav-feedback="off"
                            >
                              <Icon />
                              <span>{item.label}</span>
                            </a>
                          </SidebarMenuButton>
                          {showBadge && (
                            <SidebarMenuBadge className="bg-primary text-primary-foreground">
                              {pendingCount}
                            </SidebarMenuBadge>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter>
            {/*
              Who is operating, then the two ways out. The identity row is not
              a menu — an operator console has no account settings of its own,
              and the customer's do not belong in here.
            */}
            <div className="flex items-center gap-2.5 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
              <span className="bg-accent text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                {initials(businessName ?? email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{businessName}</p>
                <p className="text-muted-foreground truncate text-[11px]">{email}</p>
              </div>
            </div>

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={labels.backToApp}>
                  <a href={backToAppHref} data-nav-feedback="off">
                    <ArrowLeft />
                    <span>{labels.backToApp}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                {/* A real form post, so signing out still works with no JS. */}
                <form method="POST" action="/auth/signout">
                  <SidebarMenuButton asChild tooltip={labels.signOut}>
                    <button type="submit" className="w-full">
                      <LogOut />
                      <span>{labels.signOut}</span>
                    </button>
                  </SidebarMenuButton>
                </form>
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
            {/* Visible at every width: below `lg` this is the only way into
                the nav, since the rail is a sheet down there. */}
            <SidebarTrigger className="-ml-1" />

            {/* The rail carries the marker from `lg`; below that the bar does. */}
            <a
              href="/admin"
              className="flex items-center gap-2 lg:hidden"
              aria-label={labels.console}
              data-nav-feedback="off"
            >
              <span className="text-[1.0625rem] font-bold tracking-[-0.02em]">
                Fatura<span className="text-primary">.co</span>
              </span>
              <span className="bg-ink text-mist rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide">
                {badge}
              </span>
            </a>

            <div className="ml-auto flex items-center gap-2">
              {/*
                Below `lg` the rail is a sheet, so the badge on the Payments
                item is behind a tap. The count is the console's most
                time-sensitive number — it rides in the bar down here instead
                of disappearing with the rail.
              */}
              {pendingCount > 0 && (
                <a
                  href="/admin/pagesat"
                  data-nav-feedback="off"
                  className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-bold lg:hidden"
                  aria-label={`${pendingCount} ${labels.pendingPayments}`}
                >
                  {pendingCount}
                </a>
              )}
              <ActivityStream variant="bell" />
              {actions}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pt-4 pb-10 sm:px-6">
          <div className="mb-6">
            <h1 className="truncate text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
              {heading}
            </h1>
            {subheading && (
              <p className="text-muted-foreground mt-1 text-sm">{subheading}</p>
            )}
          </div>
          {children}
        </main>
      </SidebarInset>

      {/* Live platform notifications. The table's RLS is manager-only, so the
          subscription yields nothing to anyone else. */}
      <ActivityStream variant="toast" />

      {/* Feedback for the operator's own actions, distinct from the feed
          above: that reports what the platform did, this what they did. */}
      <Toaster />
    </SidebarProvider>
  );
}
