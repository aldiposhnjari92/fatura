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
  /** Optional screens the admin switched on — see lib/features.ts. */
  features?: string[];
  /** Default-on screens the admin switched off — see lib/features.ts. */
  disabled_features?: string[];
  created_at: string;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FeatureKey = 'earnings' | 'excel' | 'suppliers' | 'supplies' | 'custom_pages';

export type FeatureGroup = 'Faturimi' | 'Blerjet' | 'Faqet';

export interface FeatureDef {
  key: FeatureKey;
  group: FeatureGroup;
  /** What the admin sees on the switch. */
  label: string;
  description: string;
  /** Where the business sees it, so the admin knows what the switch changes. */
  where: string;
  /** On for every business unless the admin switches it off. */
  defaultOn: boolean;
  /** A feature this one cannot work without; switched on together, off together. */
  requires?: FeatureKey;
}

/** The two lists a feature's state is stored in (profiles.features / disabled_features). */
export interface FeatureState {
  features: string[];
  disabled_features: string[];
}

export interface AdminFeatureRow extends FeatureState {
  id: string;
  business_name: string | null;
  city: string | null;
  email: string;
  plan: string;
  created_at: string;
}

export interface FeatureSettingsProps {
  business: AdminFeatureRow;
}

export interface FeatureSwitchProps {
  id: string;
  checked: boolean;
  /** This switch's change is being saved. */
  busy: boolean;
  disabled: boolean;
  onChange: () => void;
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
