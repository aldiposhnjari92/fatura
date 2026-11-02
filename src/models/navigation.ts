import type * as React from 'react';
import type { PlanId } from '@/models/billing';
import type { PageIcon } from '@/models/page-builder';

export type AdminNavKey =
  'overview' | 'invoices' | 'activity' | 'users' | 'payments' | 'waitlist' | 'audit' | 'builder';

export type AdminIconKey =
  | 'layout-dashboard'
  | 'activity'
  | 'file-text'
  | 'users'
  | 'credit-card'
  | 'clipboard-list'
  | 'scroll-text'
  | 'layout-template';

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

export interface AdminShellProps {
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

export type NavKey =
  | 'dashboard'
  | 'invoices'
  | 'new'
  | 'clients'
  | 'suppliers'
  | 'supplies'
  | 'settings'
  /** A page-builder page, keyed by its slug. */
  | `page:${string}`;

export type IconKey =
  'layout-dashboard' | 'file-text' | 'square-pen' | 'users' | 'truck' | 'package-open' | PageIcon;

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

export interface AppShellProps {
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
