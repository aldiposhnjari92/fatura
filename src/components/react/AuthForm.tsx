import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/react/button';
import { Input } from '@/components/ui/react/input';
import { PasswordField } from '@/components/ui/react/password-field';
import { Label } from '@/components/ui/react/label';
import { SearchableSelect } from '@/components/ui/react/searchable-select';

type Mode = 'login' | 'register';

interface Props {
  mode: Mode;
  next?: string;
  /** Overrides the submit label — the Pro signup is not "falas". */
  submitLabel?: string;
}

const ALBANIAN_CITIES = [
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

/** Supabase errors are English-only; these are the ones users actually hit. */
function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials'))
    return 'Email ose fjalëkalim i gabuar.';
  if (m.includes('email not confirmed'))
    return 'Konfirmo email-in fillimisht. Kontrollo kutinë postare.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Ky email është i regjistruar. Provo të hysh.';
  if (m.includes('password should be at least'))
    return 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.';
  /*
    Two very different 429s arrive here and must not read the same.

    "email rate limit exceeded" / over_email_send_rate_limit is a *project*
    limit, not a per-user one: Supabase's built-in sender allows only a handful
    of confirmation mails per hour and is explicitly not meant for production.
    Telling this person to "try again" is wrong — nothing they do resets it,
    and the account itself was usually created fine.
  */
  if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit'))
    return 'Nuk mundëm të dërgojmë email-in e konfirmimit tani (kufi i përkohshëm i dërgimit). Llogaria mund të jetë krijuar — provo të hysh, ose na shkruaj në aldiposhnjari@gmail.com.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Shumë përpjekje. Prit pak dhe provo sërish.';
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Adresa e email-it nuk është e vlefshme.';
  return message;
}

export default function AuthForm({ mode, next = '/app', submitLabel }: Props) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [businessName, setBusinessName] = React.useState('');
  const [city, setCity] = React.useState('Fier');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const isRegister = mode === 'register';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (isRegister) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { business_name: businessName.trim(), city },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });

        if (signUpError) throw signUpError;

        // Email confirmation on → no session yet, so tell them to check mail.
        if (!data.session) {
          setNotice(
            'Të dërguam një email konfirmimi. Hape linkun për të aktivizuar llogarinë.'
          );
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }

      // Full navigation, not a client route change: the server middleware has to
      // see the freshly written auth cookies.
      window.location.assign(next);
    } catch (err) {
      setError(translateError((err as Error).message ?? 'Gabim i papritur.'));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary"
        >
          {notice}
        </p>
      )}

      {isRegister && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="business_name">Emri i biznesit</Label>
            <Input
              id="business_name"
              name="business_name"
              autoComplete="organization"
              placeholder="p.sh. Bar Kafe Vlora"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              className="h-11"
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
              className="h-11"
              options={ALBANIAN_CITIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ti@biznesi.al"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11"
        />
      </div>

      <PasswordField
        id="password"
        name="password"
        label="Fjalëkalimi"
        value={password}
        onChange={setPassword}
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        placeholder={isRegister ? 'Të paktën 6 karaktere' : '••••••••'}
        minLength={6}
        className="h-11"
        showLabel="Shfaq fjalëkalimin"
        hideLabel="Fshih fjalëkalimin"
      />

      <Button type="submit" disabled={loading} className="h-11 w-full text-base">
        {loading && <Loader2 className="animate-spin" />}
        {submitLabel ?? (isRegister ? 'Krijo llogarinë falas' : 'Hyr')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isRegister ? (
          <>
            Ke llogari?{' '}
            <a href="/login" className="font-medium text-primary hover:underline">
              Hyr këtu
            </a>
          </>
        ) : (
          <>
            S'ke llogari?{' '}
            <a href="/regjistrohu" className="font-medium text-primary hover:underline">
              Krijo një falas
            </a>
          </>
        )}
      </p>
    </form>
  );
}
