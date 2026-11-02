import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';
import { notify } from '@/lib/toast';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { Label } from '@/components/ui/react/label';
import type { Client } from '@/models/client';
import type { NewClientFormProps } from '@/models/invoice';

const EMPTY = { name: '', nipt: '', email: '', address: '' };

/** The inline "new client" form, so a first invoice never dead-ends. */
export default function NewClientForm({ onCreated, onCancel, onError }: NewClientFormProps) {
  const t = useTranslations();
  const [client, setClient] = React.useState(EMPTY);
  const [creating, setCreating] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!client.name.trim()) return;

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t('inv.errSessionExpired'));

      const { data, error } = await supabase
        .from('clients')
        .insert({
          owner_id: user.id,
          name: client.name.trim(),
          nipt: client.nipt.trim() || null,
          email: client.email.trim() || null,
          address: client.address.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      const created = data as Client;
      setClient(EMPTY);
      onCreated(created);
      notify.success(t('inv.clientAdded'), t('inv.clientAddedDesc', { name: created.name }));
    } catch (err) {
      onError(t('inv.errClientTitle'), (err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="nc-name">{t('inv.clientNameLabel')} *</Label>
        <Input
          id="nc-name"
          value={client.name}
          onChange={(e) => setClient((c) => ({ ...c, name: e.target.value }))}
          placeholder="Alba Construction sh.p.k."
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nc-nipt">{t('cli.nipt')}</Label>
        <Input
          id="nc-nipt"
          value={client.nipt}
          onChange={(e) => setClient((c) => ({ ...c, nipt: e.target.value.toUpperCase() }))}
          placeholder="K81430022M"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nc-email">{t('cli.email')}</Label>
        <Input
          id="nc-email"
          type="email"
          value={client.email}
          onChange={(e) => setClient((c) => ({ ...c, email: e.target.value }))}
          placeholder="info@klienti.al"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="nc-address">{t('cli.address')}</Label>
        <Input
          id="nc-address"
          value={client.address}
          onChange={(e) => setClient((c) => ({ ...c, address: e.target.value }))}
          placeholder="Rr. Jakov Xoxa, Fier"
        />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={creating} size="sm">
          {creating && <Loader2 className="animate-spin" />}
          {t('inv.saveClient')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('action.cancel')}
        </Button>
      </div>
    </form>
  );
}
