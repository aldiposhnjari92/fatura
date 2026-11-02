import type { FeatureDef, FeatureKey, Profile } from '@/models/account';

/*
  Screens switched on per account by the admin (profiles.features).

  A feature is something one business asked for that the rest do not need.
  The key here must match the one the database checks — admin_set_feature()
  refuses keys it does not know, and each table a feature owns checks
  has_feature() in RLS, so the sidebar hiding a page is not the only lock.
*/

export const FEATURES: FeatureDef[] = [
  {
    key: 'suppliers',
    label: 'Furnitorët & Furnizimet',
    description: 'Regjistri i furnitorëve dhe blerjet prej tyre.',
  },
];

export function hasFeature(
  profile: Pick<Profile, 'features'> | null | undefined,
  key: FeatureKey
): boolean {
  return Array.isArray(profile?.features) && profile.features.includes(key);
}
