import * as React from 'react';
import { ImageUp, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { notify } from '@/lib/toast';
import { newId, safeImageSrc } from '@/lib/page-builder';
import { Field } from './BlockInspector';
import type { ImageUploadProps } from '@/models/page-builder-ui';

const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Uploads into the page-assets bucket — the only place a page's images may come from. */
export default function ImageUpload({ src, onChange }: ImageUploadProps) {
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const shown = safeImageSrc(src);

  async function upload(file: File) {
    if (!TYPES.includes(file.type)) {
      notify.error('Format i pambështetur', 'Përdor PNG, JPG, WebP ose GIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      notify.error('Imazhi është shumë i madh', 'Maksimumi është 3 MB.');
      return;
    }
    setBusy(true);
    try {
      const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
      const path = `pages/${newId()}${newId()}.${ext}`;
      const { error } = await supabase.storage
        .from('page-assets')
        .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
      if (error) throw error;
      onChange(supabase.storage.from('page-assets').getPublicUrl(path).data.publicUrl);
    } catch (err) {
      notify.error('Ngarkimi dështoi', (err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <Field label="Imazhi">
      {shown && <img src={shown} alt="" className="max-h-40 w-full rounded-lg border object-contain" />}
      <input
        ref={input}
        type="file"
        accept={TYPES.join(',')}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <ImageUp />}
          {shown ? 'Ndrysho imazhin' : 'Ngarko imazh'}
        </Button>
        {shown && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
            Hiqe
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-[11px]">PNG, JPG, WebP ose GIF, deri 3 MB.</p>
    </Field>
  );
}
