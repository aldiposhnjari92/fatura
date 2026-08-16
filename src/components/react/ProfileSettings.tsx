import * as React from 'react';
import { Loader2, Upload, Trash2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { Label } from '@/components/ui/react/label';
import { SearchableSelect } from '@/components/ui/react/searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/react/card';
import LogoCropper from '@/components/react/LogoCropper';
import { isValidNipt } from '@/lib/utils';
import type { Profile } from '@/lib/types';

interface Props {
  profile: Profile | null;
  userId: string;
  email: string;
  welcome?: boolean;
}

const CITIES = [
  'Fier',
  'Tiranë',
  'Durrës',
  'Vlorë',
  'Elbasan',
  'Shkodër',
  'Korçë',
  'Berat',
  'Lushnjë',
  'Sarandë',
  'Gjirokastër',
  'Kukës',
  'Lezhë',
  'Pogradec',
  'Tjetër',
];

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Storage failures are opaque in English. The bucket case in particular means
 * the migration was never applied, so say that instead of "Bucket not found".
 */
function translateStorageError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('bucket not found')) {
    return 'Bucket-i "logos" nuk ekziston në Supabase. Ekzekuto migrimin supabase/migrations/0001_init.sql, ose krijo një bucket publik me emrin "logos" te Storage.';
  }
  if (m.includes('row-level security') || m.includes('violates row-level')) {
    return 'Nuk ke leje për të shkruar në bucket-in "logos". Sigurohu që politikat e Storage nga migrimi janë aplikuar.';
  }
  if (m.includes('payload too large') || m.includes('entity too large')) {
    return 'Skedari është shumë i madh për serverin. Provo një imazh më të vogël.';
  }
  if (m.includes('jwt') || m.includes('expired')) {
    return 'Sesioni skadoi. Rifresko faqen dhe hyr sërish.';
  }
  return message;
}

export default function ProfileSettings({ profile, userId, email, welcome }: Props) {
  const [businessName, setBusinessName] = React.useState(profile?.business_name ?? '');
  const [nipt, setNipt] = React.useState(profile?.nipt ?? '');
  const [address, setAddress] = React.useState(profile?.address ?? '');
  const [city, setCity] = React.useState(profile?.city ?? 'Fier');
  const [phone, setPhone] = React.useState(profile?.phone ?? '');
  const [logoUrl, setLogoUrl] = React.useState(profile?.logo_url ?? '');

  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Don't leak the object URL if the user navigates away mid-crop.
  React.useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const niptWarning =
    nipt.trim() && !isValidNipt(nipt)
      ? 'NIPT-i zakonisht ka formatin L72119451K (shkronjë, 8 shifra, shkronjë).'
      : null;

  React.useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(id);
  }, [saved]);

  /** Picking a file only opens the editor — nothing uploads until it's cropped. */
  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let the same file be re-picked after a cancel.
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setError(null);

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setError('Logo duhet të jetë PNG, JPG ose WebP.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Logo është shumë e madhe (maksimumi 2 MB).');
      return;
    }

    setCropSrc((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  }

  function closeCropper() {
    setCropSrc((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
  }

  async function handleCropped(blob: Blob) {
    setUploading(true);
    setError(null);
    try {
      // Cropping always emits PNG, so the stored object matches its extension.
      const path = `${userId}/logo-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(path, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/png',
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('logos').getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ logo_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setLogoUrl(publicUrl);
      setSaved(true);
      closeCropper();
    } catch (err) {
      setError(`Ngarkimi dështoi: ${translateStorageError((err as Error).message)}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveLogo() {
    setUploading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ logo_url: null })
        .eq('id', userId);
      if (updateError) throw updateError;
      setLogoUrl('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // upsert, not update: covers the rare case where the signup trigger
      // never fired and the profile row is missing.
      const { error: upsertError } = await supabase.from('profiles').upsert(
        {
          id: userId,
          business_name: businessName.trim() || null,
          nipt: nipt.trim() || null,
          address: address.trim() || null,
          city: city || null,
          phone: phone.trim() || null,
        },
        { onConflict: 'id' }
      );

      if (upsertError) throw upsertError;

      setSaved(true);
      if (welcome) window.location.assign('/app/faturat/e-re');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Të dhënat e biznesit</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="business_name">Emri i biznesit *</Label>
            <Input
              id="business_name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Bar Kafe Vlora"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nipt">NIPT</Label>
            <Input
              id="nipt"
              value={nipt}
              onChange={(e) => setNipt(e.target.value.toUpperCase())}
              placeholder="L72119451K"
            />
            {niptWarning && <p className="text-xs text-warning">{niptWarning}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefoni</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+355 69 123 4567"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Adresa</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rr. Jakov Xoxa, Nr. 12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city">Qyteti</Label>
            {/* Long enough to be worth typing into rather than scrolling. */}
            <SearchableSelect
              id="city"
              value={city}
              onValueChange={setCity}
              aria-label="Qyteti"
              options={CITIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email">Email (llogaria)</Label>
            <Input id="email" value={email} disabled readOnly />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo e biznesit"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-3xl">🏢</span>
              )}
            </div>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoChange}
                className="hidden"
                id="logo-input"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                  {logoUrl ? 'Ndrysho logon' : 'Ngarko logon'}
                </Button>

                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={uploading}
                    onClick={handleRemoveLogo}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 /> Hiq
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG ose WebP · maksimumi 2 MB. Del lart majtas në çdo faturë.
                Pas zgjedhjes mund ta presësh dhe ta rrotullosh.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving} size="lg">
          {saving ? <Loader2 className="animate-spin" /> : null}
          {welcome ? 'Ruaj dhe krijo faturën e parë' : 'Ruaj ndryshimet'}
        </Button>

        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
            <Check className="h-4 w-4" /> U ruajt
          </span>
        )}
      </div>

      <LogoCropper
        imageSrc={cropSrc}
        open={cropSrc !== null}
        saving={uploading}
        onCancel={closeCropper}
        onCropped={handleCropped}
      />
    </form>
  );
}
