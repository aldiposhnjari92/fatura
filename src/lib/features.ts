import type { FeatureDef, FeatureGroup, FeatureKey, FeatureState, Profile } from '@/models/account';

/*
  The parts of the app the admin can switch on or off per business, from
  Admin → Veçoritë (profiles.features / profiles.disabled_features).

  A feature is either on for everyone unless switched off (defaultOn), or off
  unless switched on — the screens only some businesses asked for. The keys
  and defaults must match supabase/migrations/0031_feature_settings.sql:
  admin_set_feature() refuses a key it does not know, and the tables a
  feature owns (suppliers, supplies) check has_feature() in RLS, so hiding a
  page is not the only lock.
*/

export const FEATURES: FeatureDef[] = [
  {
    key: 'earnings',
    group: 'Faturimi',
    label: 'Të ardhurat',
    description: 'Sa ka arkëtuar biznesi në një javë, muaj, vit ose periudhë të zgjedhur.',
    where: 'Menuja anësore, faqja Të ardhurat dhe lidhja në Panel',
    defaultOn: true,
  },
  {
    key: 'excel',
    group: 'Faturimi',
    label: 'Excel',
    description: 'Importi i faturave nga Excel dhe shkarkimi i tyre në Excel.',
    where: 'Faqja Faturat dhe menyja e çdo fature',
    defaultOn: true,
  },
  {
    key: 'suppliers',
    group: 'Blerjet',
    label: 'Furnitorët',
    description: 'Regjistri i furnitorëve: vlera, pagesat dhe diferenca me secilin.',
    where: 'Menuja anësore dhe shiriti i telefonit',
    defaultOn: false,
  },
  {
    key: 'supplies',
    group: 'Blerjet',
    label: 'Furnizimet',
    description: 'Malli i blerë nga furnitorët: kosto, çmimi i shitjes dhe diferenca.',
    where: 'Menuja anësore dhe shiriti i telefonit',
    defaultOn: false,
    requires: 'suppliers',
  },
  {
    key: 'custom_pages',
    group: 'Faqet',
    label: 'Faqet e personalizuara',
    description: 'Faqet që admini ndërton për këtë biznes me ndërtuesin e faqeve.',
    where: 'Menuja anësore, nën titujt e faqeve',
    defaultOn: true,
  },
];

export const FEATURE_GROUPS: { group: FeatureGroup; description: string }[] = [
  { group: 'Faturimi', description: 'Mjetet rreth faturave.' },
  { group: 'Blerjet', description: 'Për bizneset që regjistrojnë blerjet e tyre.' },
  { group: 'Faqet', description: 'Faqet e ndërtuara posaçërisht për biznesin.' },
];

const BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));

/** Whether a feature is on, given the two stored lists and the feature's default. */
export function isFeatureOn(state: Partial<FeatureState> | null | undefined, key: FeatureKey): boolean {
  const def = BY_KEY.get(key);
  if (!def) return false;
  return def.defaultOn
    ? !(state?.disabled_features ?? []).includes(key)
    : (state?.features ?? []).includes(key);
}

/** The signed-in business's switch for a feature. */
export function hasFeature(
  profile: Pick<Profile, 'features' | 'disabled_features'> | null | undefined,
  key: FeatureKey
): boolean {
  return isFeatureOn(profile, key);
}
