import type { ImageMetadata } from 'astro';

export type Cta1Props = {
  class?: string;
  title: string;
  description: string;
  buttons?: {
    label: string;
    href: string;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost';
    /** Show this button only to signed-out ('anon') or signed-in ('user') visitors. */
    'data-auth-show'?: 'anon' | 'user';
  }[];
  socialProof?: {
    avatars: {
      image?: ImageMetadata;
      initials: string;
      name?: string;
    }[];
    rating: number;
    text: string;
  };
};

export type Faqs1Props = {
  class?: string;
  title: string;
  description: string;
  faqs: {
    id: string;
    question: string;
    answer: string;
  }[];
  buttons?: {
    label: string;
    href: string;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  }[];
};

export type Footer1Props = {
  class?: string;
  brandName: string;
  brandHref: string;
  description: string;
  socials?: {
    label: string;
    href: string;
    icon: string;
  }[];
  columns: {
    title: string;
    links: {
      label: string;
      href: string;
    }[];
  }[];
  copyright: string;
  /** Sign-off shown opposite the legal line, e.g. "Bërë me dashuri". */
  signature?: string;
};

export type Header1Props = {
  class?: string;
  logo: {
    label: string;
    href: string;
  };
  navigation: {
    label: string;
    href: string;
    icon?: string;
    /** One line under the link in the mobile menu. */
    description?: string;
    active?: boolean;
  }[];
  buttons: {
    label: string;
    href: string;
    icon?: string;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost';
    /** Show this button only to signed-out ('anon') or signed-in ('user') visitors. */
    'data-auth-show'?: 'anon' | 'user';
  }[];
};

export type Pricing2Props = {
  class?: string;
  /** BCP-47 tag for price formatting. sq-AL renders `currency: "ALL"` as "2000 Lekë". */
  locale?: string;
  title: string;
  description: string;
  plans: {
    name: string;
    description: string;
    price: number;
    compareAt?: number;
    currency: string;
    unit: string;
    features: string[];
    /** Renders the plan on ink with teal accents and lifts it above the rest. */
    featured?: boolean;
    /** Ribbon above the plan name, e.g. "Më i zgjedhuri". */
    badge?: string;
    /** Small reassurance under the button, e.g. "Pa kartë krediti". */
    note?: string;
    button: {
      label: string;
      href: string;
      variant?: 'default' | 'outline' | 'secondary' | 'ghost';
    };
    /**
     * Shown instead of `button` to visitors who are already signed in. Without
     * it an existing customer clicking "Fillo me Pro" hits /regjistrohu, which
     * the middleware bounces away from — landing them on the dashboard with
     * their plan choice discarded.
     */
    authedButton?: {
      label: string;
      href: string;
      variant?: 'default' | 'outline' | 'secondary' | 'ghost';
    };
  }[];
  /**
   * Billing terms on offer. With two or more, a switcher renders above the
   * grid and every priced plan shows the total for the selected term instead
   * of its monthly rate — so the number on the card is the amount actually
   * transferred, not one the visitor has to multiply in their head.
   */
  terms?: { months: number; label: string; unit?: string }[];
};

export interface FeaturesSectionProps {
  class?: string;
}

export interface LegalPageProps {
  heading: string;
  updated: string;
}

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'start' | 'center';
  class?: string;
}

export interface LogoProps {
  class?: string;
  /** Use on dark surfaces (hero, footer) where the wordmark must read light. */
  invert?: boolean;
}
