/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from './lib/types';
import type { PlanId } from './lib/plans';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      /*
        The signed-in identity, taken from verified JWT claims rather than a
        round-trip to the auth server. Only `id` and `email` are ever needed,
        so this is deliberately narrower than Supabase's `User` — anything
        else lives on `profile`.
      */
      user: { id: string; email: string | null } | null;
      profile: Profile | null;
      /** Invoices created this calendar month — from app_bootstrap(). */
      invoicesThisMonth: number;
      /**
       * The tier in force right now, from active_plan(): an expired
       * subscription reads as 'free' here, same as in the quota trigger.
       */
      plan: PlanId;
      /** Invoices allowed this month; null on Pro, which is unlimited. */
      invoiceLimit: number | null;
    }
  }

  interface Window {
    /*
      Published by <NavigationProgress />. It has to hang off the window rather
      than be imported: the bar is raised by an inline script in the document
      and by islands that are torn down by the page load it is reporting on.
    */
    __navProgress?: {
      start: (el?: Element | null) => void;
      done: () => void;
    };
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
