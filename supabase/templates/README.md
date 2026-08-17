# Email templates

Supabase renders these; they are **not** wired up by `npm run db:push`. Auth email
templates live in project config, not in the database, so they have to be pasted in
once:

> **Dashboard → Authentication → Emails**

| File | Template | Suggested subject |
| ---- | -------- | ----------------- |
| `confirm-signup.html` | Confirm signup | `Konfirmo llogarinë tënde në Fatura.co` |
| `reset-password.html` | Reset password | `Rivendos fjalëkalimin — Fatura.co` |

## Before they work

1. **Site URL** — Authentication → URL Configuration → Site URL must be the production
   origin (`https://fatura.co`, or `https://fatura-co.vercel.app` until the domain is
   live). This is not cosmetic: when a requested redirect is not on the allow-list below,
   Supabase does **not** error — it silently substitutes the Site URL. A Site URL left at
   `http://localhost:4321` is why confirmation emails arrive pointing at localhost.

2. **Redirect URLs** — Authentication → URL Configuration → Redirect URLs. Every origin
   users can sign up from needs an entry, each ending in `/**`:

   - `http://localhost:4321/**` — dev
   - `https://fatura.co/**` and `https://www.fatura.co/**` — production
   - `https://fatura-co.vercel.app/**` — the Vercel production alias
   - `https://fatura-co-*.vercel.app/**` — branch/preview deployments

   The `/**` suffix is required, not tidiness. `signUp()` passes
   `…/auth/callback?next=%2Fapp`, and the allow-list is glob-matched against the whole
   URL including its query string, so a bare `https://fatura.co/auth/callback` entry does
   not match and falls back to the Site URL. In Supabase globs `.` and `/` are separators:
   `*` stops at them, `**` crosses them. Prefer `fatura-co-*.vercel.app` over
   `*.vercel.app` — the latter would let any Vercel deployment on earth receive your auth
   codes.

   `{{ .ConfirmationURL }}` points at whatever `emailRedirectTo` the signup passed, so
   signing up on a preview URL correctly confirms back to that same preview.

3. **Sender** — the built-in SMTP is rate-limited and lands in spam under Supabase's own
   domain. For production add your own SMTP (Authentication → Emails → SMTP Settings) so
   mail comes from `fatura.co` with SPF/DKIM.

## Why they are written this way

Email clients are not browsers. These use table layout, inline styles only, literal hex
colours (CSS variables do not resolve), no web fonts, no external CSS and no background
images — Gmail strips `<style>` blocks and Outlook renders through Word. The button is
wrapped in a `bgcolor` table cell so it still looks like a button in Outlook, and the raw
URL is printed underneath for clients that mangle links.
