import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { DEFAULT_NAV_GROUP, PAGE_ICONS, slugify } from '@/lib/page-builder';
import { cn } from '@/lib/utils';
import { Field, Segmented } from './BlockInspector';
import { ICON_LABELS } from './builder-config';
import type { PageSettingsProps } from '@/models/page-builder-ui';

/** The page's own settings: title, address, menu group, icon and visibility. */
export default function PageSettings({ page, navGroups, onChange, onDelete, slugTaken }: PageSettingsProps) {
  const slug = slugify(page.slug || page.title);
  const listId = React.useId();
  return (
    <div className="grid gap-4">
      <Field label="Titulli (në menu)">
        <Input value={page.title} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>

      <Field label="Adresa">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground shrink-0 text-xs">/app/p/</span>
          <Input
            value={page.slug}
            onChange={(e) => onChange({ slug: e.target.value.toLowerCase() })}
            onBlur={() => onChange({ slug })}
          />
        </div>
        {slugTaken(slug) && <p className="text-destructive text-xs">Kjo adresë përdoret nga një faqe tjetër.</p>}
      </Field>

      <Field label="Grupi në menu">
        <Input
          list={listId}
          value={page.nav_group ?? ''}
          onChange={(e) => onChange({ nav_group: e.target.value })}
          placeholder={DEFAULT_NAV_GROUP}
        />
        <datalist id={listId}>
          {navGroups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <p className="text-muted-foreground text-[11px]">
          Faqet me të njëjtin grup shfaqen bashkë nën këtë titull. Bosh = “{DEFAULT_NAV_GROUP}”.
        </p>
      </Field>

      <Field label="Ikona">
        <div className="grid grid-cols-5 gap-1">
          {PAGE_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              title={ICON_LABELS[icon]}
              aria-label={ICON_LABELS[icon]}
              aria-pressed={page.icon === icon}
              onClick={() => onChange({ icon })}
              className={cn(
                'rounded-md border px-1 py-1.5 text-[10px] transition-colors',
                page.icon === icon ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'
              )}
            >
              {ICON_LABELS[icon]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Dukshmëria">
        <Segmented
          value={page.published ? 'on' : 'off'}
          options={[
            { value: 'off', label: 'Draft' },
            { value: 'on', label: 'Publikuar' },
          ]}
          onChange={(v) => onChange({ published: v === 'on' })}
        />
        <p className="text-muted-foreground text-[11px]">
          {page.published ? 'Klienti e sheh në menu pasi ta ruash.' : 'Vetëm ti e sheh. Publikoje kur të jetë gati.'}
        </p>
      </Field>

      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive justify-self-start"
        onClick={onDelete}
      >
        <Trash2 /> Fshi faqen
      </Button>
    </div>
  );
}
