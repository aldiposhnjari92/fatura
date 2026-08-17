import * as React from 'react';
import { Check, KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { PasswordField } from '@/components/ui/react/password-field';
import { useTranslations, type Lang } from '@/lib/i18n';

interface Props {
  email: string;
  lang: Lang;
}

const MIN_LENGTH = 8;

export default function ChangePassword({ email, lang }: Props) {
  const t = useTranslations(lang);
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (next.length < MIN_LENGTH) {
      setError(t('pw.errTooShort', { n: MIN_LENGTH }));
      return;
    }
    if (next !== confirm) {
      setError(t('pw.errMismatch'));
      return;
    }

    setBusy(true);
    try {
      /*
        The current password is not asked for: the session is treated as proof
        enough. That is a deliberate product decision — it means whoever holds
        an already-signed-in browser can change this password.
      */
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;

      setDone(true);
      setNext('');
      setConfirm('');
    } catch (err) {
      setError((err as Error).message || t('common.unexpectedError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {done && (
        <p className="border-primary/25 bg-accent/40 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium">
          <Check className="text-primary size-4 shrink-0" />
          {t('pw.updated')}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm font-medium"
        >
          {error}
        </p>
      )}

      {/* Present for password managers: they need to know which account this is. */}
      <input type="hidden" name="username" autoComplete="username" value={email} readOnly />

      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordField
          id="new-password"
          label={t('pw.new')}
          value={next}
          onChange={setNext}
          minLength={MIN_LENGTH}
          showLabel={t('pw.show')}
          hideLabel={t('pw.hide')}
        />
        <PasswordField
          id="confirm-password"
          label={t('pw.confirm')}
          value={confirm}
          onChange={setConfirm}
          showLabel={t('pw.show')}
          hideLabel={t('pw.hide')}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">
          {t('pw.hint', { n: MIN_LENGTH })}
        </p>
        <Button type="submit" disabled={busy} className="press">
          {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
          {t('pw.submit')}
        </Button>
      </div>
    </form>
  );
}
