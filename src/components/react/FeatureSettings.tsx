import * as React from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { FEATURES, FEATURE_GROUPS, isFeatureOn } from '@/lib/features';
import type { FeatureDef, FeatureKey, FeatureSettingsProps, FeatureState, FeatureSwitchProps } from '@/models/account';

/*
  Admin → Veçoritë → one business: a switch for every optional part of the
  app. Each flip is one admin_set_feature() call, which also keeps Furnizimet
  inside Furnitorët (on together, off together) and writes the audit log; the
  lists it returns replace the local ones, so what is shown is what is stored.
*/

const BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));

export default function FeatureSettings({ business }: FeatureSettingsProps) {
  const [state, setState] = React.useState<FeatureState>({
    features: business.features ?? [],
    disabled_features: business.disabled_features ?? [],
  });
  const [busy, setBusy] = React.useState<FeatureKey | 'reset' | null>(null);
  const name = business.business_name ?? business.email;

  const onCount = FEATURES.filter((f) => isFeatureOn(state, f.key)).length;
  const atDefaults = FEATURES.every((f) => isFeatureOn(state, f.key) === f.defaultOn);

  async function apply(key: FeatureKey, enabled: boolean): Promise<FeatureState> {
    const { data, error } = await supabase.rpc('admin_set_feature', {
      p_user: business.id,
      p_feature: key,
      p_enabled: enabled,
    });
    if (error) throw error;
    const next = data as Partial<FeatureState>;
    return { features: next.features ?? [], disabled_features: next.disabled_features ?? [] };
  }

  async function toggle(feature: FeatureDef) {
    const enabled = !isFeatureOn(state, feature.key);
    setBusy(feature.key);
    try {
      const next = await apply(feature.key, enabled);
      setState(next);
      // Say so when a switch moved another one with it.
      const moved = FEATURES.filter(
        (f) => f.key !== feature.key && isFeatureOn(next, f.key) !== isFeatureOn(state, f.key)
      ).map((f) => f.label);
      notify.success(
        `${feature.label} u ${enabled ? 'aktivizua' : 'çaktivizua'}.`,
        moved.length > 0
          ? `${moved.join(', ')} gjithashtu, sepse ${enabled ? 'nevojitet' : 'varet prej saj'}.`
          : `Për ${name}.`
      );
    } catch (err) {
      notify.error('Ndryshimi nuk u ruajt', (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /* Back to what a new business gets: each switch that differs, one call at a time. */
  async function reset() {
    setBusy('reset');
    try {
      let current = state;
      // Opt-in features off first, so switching Furnitorët off is not undone by Furnizimet.
      const order = [...FEATURES].sort((a, b) => Number(a.defaultOn) - Number(b.defaultOn));
      for (const feature of order) {
        if (isFeatureOn(current, feature.key) !== feature.defaultOn) {
          current = await apply(feature.key, feature.defaultOn);
        }
      }
      setState(current);
      notify.success('U rikthyen parazgjedhjet.', `Për ${name}.`);
    } catch (err) {
      notify.error('Rikthimi nuk u përfundua', (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="bg-card shadow-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-muted-foreground truncate text-sm">
            {business.email}
            {business.city ? ` · ${business.city}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm tabular-nums">
            {onCount} nga {FEATURES.length} aktive
          </span>
          <Button variant="outline" size="sm" disabled={atDefaults || busy !== null} onClick={reset}>
            {busy === 'reset' ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            Rikthe parazgjedhjet
          </Button>
        </div>
      </section>

      {FEATURE_GROUPS.map(({ group, description }) => (
        <section key={group} className="bg-card shadow-card overflow-hidden rounded-2xl">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-semibold tracking-tight">{group}</h2>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          <ul className="divide-y border-t">
            {FEATURES.filter((f) => f.group === group).map((feature) => {
              const on = isFeatureOn(state, feature.key);
              const requires = feature.requires ? BY_KEY.get(feature.requires) : undefined;
              const id = `feature-${feature.key}`;
              return (
                <li key={feature.key} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor={id} className="cursor-pointer font-medium">
                        {feature.label}
                      </label>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          feature.defaultOn ? 'bg-muted text-muted-foreground' : 'bg-accent text-primary'
                        )}
                      >
                        {feature.defaultOn ? 'Për të gjithë' : 'Shtesë'}
                      </span>
                      {on !== feature.defaultOn && (
                        <span className="text-warning text-[11px] font-semibold">Ndryshuar për këtë biznes</span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">{feature.description}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Shfaqet: {feature.where}
                      {requires && ` · Kërkon ${requires.label}`}
                    </p>
                  </div>
                  <Switch
                    id={id}
                    checked={on}
                    busy={busy === feature.key}
                    disabled={busy !== null}
                    onChange={() => toggle(feature)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="text-muted-foreground text-xs leading-relaxed">
        Një veçori e çaktivizuar fshihet nga menyja dhe faqja e saj nuk hapet më për këtë biznes. Të dhënat
        nuk fshihen: kur veçoria aktivizohet sërish, gjithçka është aty ku ishte.
      </p>
    </div>
  );
}

function Switch({ id, checked, busy, disabled, onChange }: FeatureSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'focus-visible:ring-ring relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        disabled && !busy && 'opacity-60'
      )}
    >
      <span
        className={cn(
          'bg-background flex size-5 items-center justify-center rounded-full shadow-sm transition-transform',
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        )}
      >
        {busy && <Loader2 className="text-muted-foreground size-3 animate-spin" />}
      </span>
    </button>
  );
}
