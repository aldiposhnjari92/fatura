import type { NavKey } from '@/models/navigation';

export interface AdminLayoutProps {
  title: string;
  heading: string;
  subheading?: string;
  active:
    'overview' | 'invoices' | 'activity' | 'users' | 'payments' | 'waitlist' | 'audit' | 'builder';
  /** Pending-payment count, rendered as a badge on the Payments item. */
  pendingCount?: number;
}

export interface AppLayoutProps {
  title: string;
  heading?: string;
  active?: NavKey;
}

export interface AuthLayoutProps {
  title: string;
  description?: string;
  heading: string;
  subheading: string;
}

export interface BaseLayoutProps {
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  noindex?: boolean;
}

export interface MarketingLayoutProps {
  title: string;
  description?: string;
  noindex?: boolean;
}
