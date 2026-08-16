/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from './lib/types';
import type { Lang } from './lib/i18n';

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
      /** Interface language for this request: cookie, else Accept-Language. */
      lang: Lang;
    }
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
