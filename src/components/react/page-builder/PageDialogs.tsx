import * as React from 'react';
import {
  ArrowRight,
  Calendar,
  ClipboardList,
  File,
  FilePlus2,
  Loader2,
  Monitor,
  Package,
  Search,
  ShoppingCart,
  Smartphone,
  Star,
  Table2,
  Tablet,
  Trash2,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { Label } from '@/components/ui/react/label';
import { Textarea } from '@/components/ui/react/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/react/dialog';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { flattenBlocks } from '@/lib/page-builder';
import { BUILTIN_TEMPLATES, deleteTemplate, instantiate, listTemplates, saveTemplate, snapshotOf } from '@/lib/page-templates';
import PageBlocks from './PageBlocks';
import type { Block, CustomCollection, CustomPage, CustomRecord, PageIcon, PageTemplate } from '@/models/page-builder';
import type { DeletePageDialogProps, PageBusiness, PreviewDevice } from '@/models/page-builder-ui';

/* Phase 3 of the page builder: preview, templates, and copying a page. */

export const PAGE_ICON_COMPONENTS: Record<PageIcon, LucideIcon> = {
  file: File,
  'clipboard-list': ClipboardList,
  table: Table2,
  package: Package,
  'shopping-cart': ShoppingCart,
  calendar: Calendar,
  wallet: Wallet,
  star: Star,
  truck: Truck,
  users: Users,
};

// ---- Parapamje ----------------------------------------------------------------

const WIDTH: Record<PreviewDevice, string> = {
  desktop: 'max-w-none',
  tablet: 'max-w-[768px]',
  mobile: 'max-w-[390px]',
};

/*
  The draft — unsaved edits included — the way the customer will get it, with
  their real rows. Read-only: the admin may read a customer's records for
  support, but this screen never writes one.
*/
export function PreviewDialog({
  open,
  onOpenChange,
  page,
  collections,
  ownerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: CustomPage;
  collections: CustomCollection[];
  ownerName: string;
}) {
  const [device, setDevice] = React.useState<PreviewDevice>('desktop');
  const [records, setRecords] = React.useState<CustomRecord[] | null>(null);

  React.useEffect(() => {
    if (!open) {
      setRecords(null);
      return;
    }
    const ids = [
      ...new Set(
        flattenBlocks(page.blocks)
          .map((b) => ('source' in b ? b.source.collectionId : null))
          .filter((id): id is string => !!id)
      ),
    ];
    if (ids.length === 0) {
      setRecords([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('custom_records')
      .select('*')
      .in('collection_id', ids)
      .order('created_at', { ascending: false })
      .limit(2000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) notify.error('Të dhënat nuk u ngarkuan', error.message);
        setRecords((data ?? []) as CustomRecord[]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, page.blocks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] max-w-[min(1280px,96vw)] flex-col gap-0 p-0 sm:max-w-[min(1280px,96vw)]">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">Parapamje: {page.title}</DialogTitle>
            <DialogDescription className="text-xs">
              Si e sheh {ownerName}, me të dhënat e tij — vetëm për lexim.
              {!page.published && ' Faqja është ende draft.'}
            </DialogDescription>
          </div>
          <div className="bg-muted mr-8 flex rounded-lg p-0.5">
            {(
              [
                ['desktop', Monitor, 'Kompjuter'],
                ['tablet', Tablet, 'Tablet'],
                ['mobile', Smartphone, 'Telefon'],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                title={label}
                aria-pressed={device === value}
                onClick={() => setDevice(value)}
                className={cn(
                  'rounded-md p-1.5 [&_svg]:size-4',
                  device === value ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'
                )}
              >
                <Icon />
              </button>
            ))}
          </div>
        </DialogHeader>
        <div className="bg-muted/40 min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div
            className={cn(
              'bg-background mx-auto rounded-xl p-4 shadow-sm transition-[max-width] duration-300 sm:p-6',
              WIDTH[device]
            )}
          >
            <h1 className="mb-6 text-2xl font-semibold tracking-tight">{page.title}</h1>
            {records === null ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> Po ngarkohen të dhënat…
              </p>
            ) : (
              <PageBlocks
                key={page.id}
                blocks={page.blocks}
                collections={collections}
                records={records}
                readOnly
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Faqe e re --------------------------------------------------------------------

/*
  "Faqe e re" opens here: a blank page, a built-in starter, or one of the
  admin's own templates. A template's collections are recreated, empty, for
  this customer.
*/
export function NewPageDialog({
  open,
  onOpenChange,
  ownerId,
  onBlank,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  onBlank: () => Promise<void>;
  onCreated: (page: CustomPage, collections: CustomCollection[]) => void;
}) {
  const [saved, setSaved] = React.useState<PageTemplate[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  // Fetched on every open, so a template saved a minute ago is already here.
  React.useEffect(() => {
    if (!open) {
      setSaved(null);
      return;
    }
    let cancelled = false;
    listTemplates()
      .then((rows) => !cancelled && setSaved(rows))
      .catch((err) => {
        if (cancelled) return;
        setSaved([]);
        notify.error('Shabllonet nuk u ngarkuan', (err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function useTemplate(template: PageTemplate) {
    setBusy(template.id);
    try {
      const result = await instantiate(template, ownerId, {
        title: template.name,
        icon: template.icon,
      });
      onCreated(result.page, result.collections);
      onOpenChange(false);
      notify.success(
        'Faqja u krijua.',
        result.collections.length
          ? `Me ${result.collections.length} koleksion${result.collections.length === 1 ? '' : 'e'} të reja, bosh.`
          : 'Nga shablloni, si draft.'
      );
    } catch (err) {
      notify.error('Faqja nuk u krijua', (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function blank() {
    setBusy('blank');
    try {
      await onBlank();
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  }

  async function remove(template: PageTemplate) {
    if (!window.confirm(`Ta fshijmë shabllonin “${template.name}”? Faqet e krijuara prej tij mbeten.`)) return;
    try {
      await deleteTemplate(template.id);
      setSaved((prev) => (prev ?? []).filter((t) => t.id !== template.id));
      notify.success('Shablloni u fshi.', template.name);
    } catch (err) {
      notify.error('Shablloni nuk u fshi', (err as Error).message);
    }
  }

  const card = (template: PageTemplate) => {
    const Icon = PAGE_ICON_COMPONENTS[template.icon] ?? File;
    const fields = template.collections.reduce((n, c) => n + c.fields.length, 0);
    return (
      <div key={template.id} className="group relative">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => useTemplate(template)}
          className="hover:border-primary flex h-full w-full flex-col gap-2 rounded-xl border p-4 text-left transition-colors disabled:opacity-60"
        >
          <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-lg">
            {busy === template.id ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
          </span>
          <span className="text-sm font-semibold">{template.name}</span>
          {template.description && (
            <span className="text-muted-foreground line-clamp-2 text-xs">{template.description}</span>
          )}
          <span className="text-muted-foreground mt-auto text-[11px]">
            {template.collections.length} koleksion · {fields} fusha
          </span>
        </button>
        {!template.builtin && (
          <button
            type="button"
            aria-label={`Fshi shabllonin ${template.name}`}
            onClick={() => remove(template)}
            className="text-muted-foreground hover:text-destructive absolute top-2 right-2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => busy === null && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Faqe e re</DialogTitle>
          <DialogDescription>
            Fillo bosh ose nga një shabllon. Koleksionet e shabllonit krijohen bosh për këtë klient;
            faqja krijohet si draft.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              disabled={busy !== null}
              onClick={blank}
              className="hover:border-primary flex flex-col gap-2 rounded-xl border border-dashed p-4 text-left transition-colors disabled:opacity-60"
            >
              <span className="bg-muted grid size-9 place-items-center rounded-lg">
                {busy === 'blank' ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
              </span>
              <span className="text-sm font-semibold">Faqe bosh</span>
              <span className="text-muted-foreground text-xs">Ndërtoje nga e para.</span>
            </button>
            {BUILTIN_TEMPLATES.map(card)}
          </div>

          <div>
            <p className="text-muted-foreground mb-2 text-[11px] font-bold tracking-[0.12em] uppercase">
              Shabllonet e tua
            </p>
            {saved === null ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> Po ngarkohen…
              </p>
            ) : saved.length === 0 ? (
              <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                Ende asnjë. Ruaj një faqe si shabllon nga menuja “Më shumë” në redaktues.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">{saved.map(card)}</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Ruaj si shabllon --------------------------------------------------------------

export function SaveTemplateDialog({
  open,
  onOpenChange,
  page,
  blocks,
  collections,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: CustomPage;
  blocks: Block[];
  collections: CustomCollection[];
}) {
  const [name, setName] = React.useState(page.title);
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(page.title);
      setDescription('');
    }
  }, [open, page.title]);

  const snapshot = snapshotOf(blocks, collections);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveTemplate(snapshot, { name: name.trim(), description: description.trim(), icon: page.icon });
      notify.success('Shablloni u ruajt.', `“${name.trim()}” del te “Faqe e re” për çdo klient.`);
      onOpenChange(false);
    } catch (err) {
      notify.error('Shablloni nuk u ruajt', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ruaj si shabllon</DialogTitle>
          <DialogDescription>
            Ruhet struktura e faqes dhe fushat e {snapshot.collections.length} koleksion
            {snapshot.collections.length === 1 ? 'it' : 'eve'} që përdor — asnjë e dhënë e klientit.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-name">Emri *</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-desc">Përshkrimi</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Për çfarë shërben kjo faqe"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Anulo
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="animate-spin" />}
            Ruaj shabllonin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Kopjo te një klient tjetër ----------------------------------------------------

export function CopyPageDialog({
  open,
  onOpenChange,
  page,
  blocks,
  collections,
  currentOwnerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: CustomPage;
  blocks: Block[];
  collections: CustomCollection[];
  currentOwnerId: string;
}) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<PageBusiness[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [copying, setCopying] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ owner: PageBusiness; pageTitle: string } | null>(null);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setDone(null);
    }
  }, [open]);

  // Debounced search through the same RPC the Bizneset page uses.
  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc('admin_users', {
        p_search: query.trim() || null,
        p_filter: 'all',
        p_limit: 20,
        p_offset: 0,
      });
      if (error) notify.error('Kërkimi dështoi', error.message);
      const rows = ((data as { rows?: PageBusiness[] })?.rows ?? []).filter((r) => r.id !== currentOwnerId);
      setResults(rows);
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, query, currentOwnerId]);

  async function copyTo(owner: PageBusiness) {
    setCopying(owner.id);
    try {
      const result = await instantiate(snapshotOf(blocks, collections), owner.id, {
        title: page.title,
        icon: page.icon,
        nav_group: page.nav_group,
      });
      setDone({ owner, pageTitle: result.page.title });
    } catch (err) {
      notify.error('Kopjimi dështoi', (err as Error).message);
    } finally {
      setCopying(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => copying === null && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kopjo “{page.title}” te një klient tjetër</DialogTitle>
          <DialogDescription>
            Faqja kopjohet si draft, me koleksionet e saj bosh. Të dhënat e këtij klienti nuk kopjohen.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="grid gap-4">
            <p className="bg-success/10 text-success rounded-lg px-4 py-3 text-sm font-medium">
              “{done.pageTitle}” u kopjua te {done.owner.business_name ?? done.owner.email} si draft.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDone(null)}>
                Kopjo te një tjetër
              </Button>
              <Button asChild>
                <a href={`/admin/faqet/${done.owner.id}`}>
                  Hap faqet e tij <ArrowRight />
                </a>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Emër biznesi, email ose NIPT…"
                className="pl-8"
                autoFocus
              />
            </div>
            <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
              {loading && results.length === 0 ? (
                <p className="text-muted-foreground flex items-center gap-2 px-4 py-6 text-sm">
                  <Loader2 className="size-4 animate-spin" /> Po kërkohet…
                </p>
              ) : results.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">Asnjë biznes.</p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={copying !== null}
                    onClick={() => copyTo(r)}
                    className="hover:bg-muted flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {r.business_name ?? 'Pa emër biznesi'}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {r.email}
                        {r.city ? ` · ${r.city}` : ''}
                      </span>
                    </span>
                    {copying === r.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="text-muted-foreground size-4" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Delete a page -------------------------------------------------------------------

export function DeletePageDialog({ open, onOpenChange, title, busy, onConfirm }: DeletePageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fshi faqen “{title}”?</DialogTitle>
          <DialogDescription>
            Faqja hiqet nga menuja e klientit. Koleksionet dhe të dhënat e tyre nuk preken.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Anulo
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Po, fshije
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
