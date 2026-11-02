import type { PlanId } from '@/models/billing';

export interface Profile {
  id: string;
  business_name: string | null;
  nipt: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  logo_url: string | null;
  /** True while any paid plan is running. Which one is `plan`. */
  is_pro: boolean;
  /**
   * The tier bought. Only meaningful while the subscription is live — read the
   * effective tier from `Astro.locals.plan` (active_plan() in SQL), which
   * already accounts for expiry.
   */
  plan?: PlanId;
  is_admin?: boolean;
  /** Read-mostly operator: sees invoice activity, changes nothing. */
  is_manager?: boolean;
  /** When the subscription lapses; null means no expiry set. */
  pro_until?: string | null;
  /** Set when the customer asked not to renew; access still runs to pro_until. */
  cancelled_at?: string | null;
  /** Per-account screens the admin switched on — see lib/features.ts. */
  features?: string[];
  created_at: string;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FeatureKey = 'suppliers';

export interface FeatureDef {
  key: FeatureKey;
  /** What the admin sees on the switch. */
  label: string;
  description: string;
}

export interface LogoMarkProps {
  size?: number;
  invert?: boolean;
  className?: string;
}

export interface UserMenuProps {
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

export type AuthMode = 'login' | 'register';

export interface AuthFormProps {
  mode: AuthMode;
  next?: string;
  /** Overrides the submit label — the Pro signup is not "falas". */
  submitLabel?: string;
}

export interface ChangePasswordProps {
  email: string;
}

export interface LogoCropperProps {
  /** Object URL of the picked file. Null closes the dialog. */
  imageSrc: string | null;
  open: boolean;
  saving?: boolean;
  onCancel: () => void;
  onCropped: (blob: Blob) => void | Promise<void>;
}

export interface ProfileSettingsProps {
  profile: Profile | null;
  userId: string;
  email: string;
  welcome?: boolean;
}
