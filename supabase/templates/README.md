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

1. **Redirect URLs** — Authentication → URL Configuration → Redirect URLs must include
   `http://localhost:4321/auth/callback` and `https://fatura.co/auth/callback`.
   `{{ .ConfirmationURL }}` points at whatever `emailRedirectTo` the signup passed, and
   Supabase refuses any URL not on that allow-list.
2. **Sender** — the built-in SMTP is rate-limited and lands in spam under Supabase's own
   domain. For production add your own SMTP (Authentication → Emails → SMTP Settings) so
   mail comes from `fatura.co` with SPF/DKIM.

## Why they are written this way

Email clients are not browsers. These use table layout, inline styles only, literal hex
colours (CSS variables do not resolve), no web fonts, no external CSS and no background
images — Gmail strips `<style>` blocks and Outlook renders through Word. The button is
wrapped in a `bgcolor` table cell so it still looks like a button in Outlook, and the raw
URL is printed underneath for clients that mangle links.
