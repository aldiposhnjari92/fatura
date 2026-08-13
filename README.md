# Fatura.co

Fatura profesionale me NIPT dhe logo, në 2 minuta, nga telefoni — për bizneset e vogla
dhe të vetëpunësuarit në Shqipëri.

Invoicing MVP for Albania. Astro + React islands, Supabase, and **100% client-side PDF
generation** — no Edge Function ever touches an invoice, so marginal cost per invoice is
zero.

---

## Stack

| Layer      | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| Framework  | Astro 5 (SSR, `output: 'server'`) + React 18 islands        |
| Styling    | Tailwind CSS 4 (CSS-first) + Fulldev UI + shadcn/ui          |
| Backend    | Supabase — Auth, Postgres with RLS, Storage (`logos`)       |
| PDF        | jsPDF + jspdf-autotable, generated **in the browser only**  |
| Hosting    | Vercel (`@astrojs/vercel`), custom domain `fatura.co`       |

---

## Getting started

```bash
npm install
cp .env.example .env      # fill in your Supabase project values
npm run dev               # http://localhost:4321
```

### 1. Supabase setup

Create a project, then apply the schema with the deploy script — no SQL editor,
no manual steps:

```bash
npm run db:push
```

It needs one extra variable, the **database** connection string (not the anon key):

```env
SUPABASE_DB_URL=postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Get it from **Dashboard → Connect → Connection string → URI**, choosing *Session pooler*
or *Direct connection*, and replace `[YOUR-PASSWORD]`. Keep it in `.env` — it is
gitignored. Percent-encode any `@ : / #` in the password.

| Command             | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `npm run db:push`   | Applies every pending migration, then verifies tables + bucket   |
| `npm run db:status` | Shows applied / pending, changes nothing                         |
| `npm run deploy`    | `db:push` then `build`                                           |
| `... -- --dry-run`  | Lists what would run                                             |
| `... -- --force <name>` | Re-runs one migration                                       |

Each file runs in a single transaction and is recorded in `public._fatura_migrations`
with a checksum, so re-running is safe and only new files execute. A migration edited
after being applied is reported as `changed` rather than silently skipped. The runner
prints a verification block at the end confirming all four tables and the public `logos`
bucket exist, and it detects the one failure mode worth calling out — a role that cannot
create policies on `storage.objects` — with the Dashboard workaround.

To apply the SQL by hand instead, the same file works in the SQL editor:

```
supabase/migrations/0001_init.sql
```

`0001_init.sql` creates `profiles`, `clients`, `invoices` and `waitlist_fatura`, enables
RLS with owner-scoped policies on every table, and installs two helpers:

- `handle_new_user()` — trigger that auto-creates a `profiles` row on signup, seeding
  `business_name` and `city` from the signup metadata.
- `next_invoice_number(p_year)` — returns the next number for the current user, e.g.
  `FAT-2025-004`.

`0002_storage.sql` creates the public `logos` bucket and its folder-per-user policies.
It is a **separate file on purpose**: each migration runs in one transaction, and policies
on `storage.objects` can fail with `insufficient_privilege` depending on the role. Bundled
with the table DDL, that failure rolled the whole schema back — the database looked
untouched while the app reported *"Could not find the table 'public.profiles'"*. Everything
in `0002` is now wrapped in exception handlers, so it reports what it skipped and never
rolls anything back.

> **Symptom guide.** *"Could not find the table 'public.profiles' in the schema cache"* →
> migrations never applied; run `npm run db:push`. *"Bucket not found"* → `0002` never ran.
> *Row-level-security error on upload* → the bucket exists but its policies do not; the
> runner prints the exact Dashboard steps.

Then, in **Authentication → URL Configuration**, add the redirect URLs:

```
http://localhost:4321/auth/callback
https://fatura.co/auth/callback
```

### 2. Environment

```env
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

Both are browser-safe — RLS is what protects the data, not key secrecy.

### 3. Deploy to Vercel

```bash
vercel            # link the project
vercel --prod
```

Add the same two env vars in the Vercel dashboard, then point `fatura.co` at the project
under **Settings → Domains**. The adapter is already configured; no `vercel.json` needed.

---

## Routes

### Marketing (prerendered; ~16 KB gzipped JS from the Fulldev header + FAQ)

| Route          | What it is                                                   |
| -------------- | ------------------------------------------------------------ |
| `/`            | Landing — Fulldev hero-1, features-2, pricing-2, faqs-1, cta-1 plus three custom sections (problem, 3 steps, waitlist). |
| `/cmimet`      | Pricing + feature comparison table                            |
| `/kushtet`     | Terms of service                                              |
| `/privatesia`  | Privacy policy                                                |
| `/404`         | Not found                                                     |

### Auth

| Route             | What it is                                            |
| ----------------- | ----------------------------------------------------- |
| `/login`          | Sign in (React island)                                |
| `/regjistrohu`    | Sign up with business name + city (React island)      |
| `/auth/callback`  | Exchanges the email-confirmation code for a session   |
| `/auth/signout`   | Clears the session cookies                            |
| `/faleminderit`   | Waitlist thank-you / error page                       |

### App (SSR, auth-gated by middleware)

| Route                  | What it is                                                 |
| ---------------------- | ---------------------------------------------------------- |
| `/app`                 | Dashboard — totals, plan usage, 5 most recent invoices     |
| `/app/faturat`         | Invoice list with status filters and number search          |
| `/app/faturat/e-re`    | New invoice editor                                          |
| `/app/faturat/[id]`    | Edit an invoice, or delete it                               |
| `/app/klientet`        | Client CRUD                                                 |
| `/app/cilesimet`       | Business profile, NIPT, logo upload + crop editor, plan     |

### API

| Route           | What it is                                                        |
| --------------- | ----------------------------------------------------------------- |
| `/api/waitlist` | Accepts the landing page's plain HTML form POST (and JSON), with a honeypot field |

---

## How the PDF works

Everything lives in [`src/lib/pdf.ts`](src/lib/pdf.ts) and runs **only in the browser**:

1. jsPDF and jspdf-autotable are `import()`ed dynamically, so they never enter the SSR
   bundle (also enforced via `vite.ssr.external` in `astro.config.mjs`).
2. The logo is fetched from the public `logos` bucket and inlined as a data URL. If that
   fails for any reason, the invoice still renders — the business name is used instead.
3. `computeTotals()` in [`src/lib/types.ts`](src/lib/types.ts) is the single source of
   truth for the arithmetic, shared by the editor UI and the PDF, so the number on screen
   and the number on paper can never drift.
4. Three outputs: `downloadInvoicePdf()`, `invoicePdfObjectUrl()` for a preview tab, and
   `shareInvoicePdf()` which uses the Web Share API on mobile (WhatsApp/Viber) and falls
   back to a download on desktop.

Invoices are bilingual: `language` is `sq` or `en`, and the strings come from
[`src/lib/i18n.ts`](src/lib/i18n.ts). The app UI itself is Albanian throughout.

## UI libraries — who owns what

Two libraries, split by rendering model. This is a hard boundary, not a preference:

| Layer                         | Library                     | Why                                        |
| ----------------------------- | --------------------------- | ------------------------------------------ |
| Marketing pages (Astro)       | **Fulldev UI** (`@fulldev`) | Astro components + prebuilt content blocks |
| App islands (React, hydrated) | **shadcn/ui** (React)       | Fulldev is Astro-only; it cannot hold React state |

Fulldev components are Astro files — they cannot be rendered inside a hydrated React
island, so the invoice editor, clients manager, settings, auth form and logo cropper stay
on shadcn/ui React. Both are installed as source you own, both consume the same Tailwind
v4 tokens, so they look identical.

To avoid the two `Button`s resolving to the same import path, the React primitives live
in `src/components/ui/react/` and Fulldev's own in `src/components/ui/<name>/`.

Add more blocks with the registry already configured in `components.json`:

```bash
npx shadcn@latest add @fulldev/testimonials-1
```

### Local edits to installed blocks

These are your files now, so two were patched after install:

- `blocks/pricing-2.astro` — rewritten. The stock block renders every plan as a flat
  `border-none shadow-none` card with no recommended option. It now takes three extra
  per-plan props — `featured`, `badge`, `note` — and the featured plan gets an ink surface,
  teal accents, a lift and a ribbon. Two gotchas worth knowing if you touch it:
  the featured card carries the `dark` class so nested primitives flip their tokens
  (`PriceValue` writes `text-foreground` on an *inner* span, so without it the price is
  dark-on-dark and invisible), and `PriceUnit` already renders the leading `/`, so pass
  `muaj`, not `/ muaj`.
  It also gained a `locale` prop (default `sq-AL`). Fulldev's `Price` runs
  `Intl.NumberFormat` with `style: "currency"`, which needs an **ISO code**, so plans pass
  `currency: 'ALL'`, not `'Lekë'`. With `sq-AL` that renders exactly `990 Lekë`.
- `ui/typography/*` — the registry ships `@reference "@/styles/global.css"`; this project's
  file is `globals.css`. Left unfixed, the build breaks the moment Typography is used.

### JavaScript cost

The landing page previously shipped **0 JS**. Fulldev's header and FAQ are interactive, so
it now ships ~47 KB raw / ~16 KB gzipped:

| Script          | Raw     | What it buys                    |
| --------------- | ------- | ------------------------------- |
| navigation-menu | 31.1 KB | Desktop nav                     |
| accordion       | 10.2 KB | FAQ open/close                  |
| sheet           |  5.4 KB | Mobile drawer menu (new)        |

The mobile drawer is a genuine gain — the hand-built header had no mobile menu. To return
to zero JS, swap `header-1`/`faqs-1` for a plain nav and `<details>`-based FAQ; everything
else on the page (hero, features, pricing, CTA) is static and costs nothing.

## Auth-aware CTAs on static pages

The marketing pages are prerendered, so the server cannot know whether a visitor is
signed in — but showing "Hyr / Fillo falas" to someone already logged in is wrong.

Both variants are rendered into the static HTML and marked `data-auth-show="anon"` /
`"user"`; CSS hides one. A synchronous inline script in `<head>` checks for the
`sb-fatura` session cookie and stamps `data-auth` on `<html>`. Because it runs before
first paint there is no flash of the wrong button, and the pages stay fully static and
edge-cacheable — no SSR, no Supabase round trip on the landing page.

Cookie presence is treated as *probably* signed in. That is deliberate: this is only a
navigation affordance, and if the token has expired the middleware bounces `/app` back to
`/login`, which is self-correcting. The cookie is readable from JS because `@supabase/ssr`
requires it for the browser client — it is not an extra exposure.

Note `hero-1` and `cta-1` pick a button variant by array index, so a signed-in button
sitting at index 1 silently renders as `secondary`; the auth variants pin
`variant: 'default'` explicitly.

## Email templates

Branded Albanian templates live in [`supabase/templates/`](supabase/templates/) —
confirm-signup and reset-password. They are **not** applied by `npm run db:push`: auth
email templates are project config, not database, so paste them once into
**Dashboard → Authentication → Emails**. See that folder's README for the subjects, the
redirect-URL requirement and why they are written table-first with inline styles.

## Payments — `/app/abonimi`

### Why there is no Stripe

**Albania is not a supported Stripe merchant country**, and PayPal receiving on an
Albanian account is account-dependent at best. So the schema records *a payment* with a
method and a provider reference rather than modelling one gateway. Adding a processor
later is configuration, not a migration.

| Method | State | Needs |
| --- | --- | --- |
| Bank transfer | **Working today** | `BANK_*` env vars only |
| Card | Real code, dormant | PayPal Advanced Card Payments approval |
| PayPal | Real code, dormant | `PUBLIC_PAYPAL_CLIENT_ID` + `PAYPAL_SECRET` |

Card and PayPal render as clearly unavailable with the reason stated — never as buttons
that fail. PayPal Checkout covers both, since it accepts cards from guests, so one
integration lights up both rows.

### Choosing a plan before signing up

The pricing cards link to `/regjistrohu?plan=pro&muaj=N`. That parameter is validated
against `PLAN_OPTIONS` and carried through as the post-signup `next`, so the visitor lands
on `/app/abonimi?muaj=N` with their term already selected.

**Signing up never grants Pro** — nothing has been paid. The account starts free and
switches when a payment is confirmed; the checkout says so explicitly. This was a real
bug: the Pro card used to link to a bare `/regjistrohu`, which hardcoded
`next="/app/cilesimet?welcome=1"`, so the chosen plan was silently discarded and every
signup landed on free.

Because the intent lives in the URL, it also survives email confirmation —
`{{ .ConfirmationURL }}` carries `next=/app/abonimi?muaj=N` back through the callback.

### Bank transfer flow

`create_payment()` issues a unique reference (`FAT-XXXXXXXX`) and **computes the amount
server-side**; the client only picks a method and a term. The customer quotes that
reference in the transfer description, an admin confirms it in the panel, and Pro
activates. Paying early *extends* from the current expiry rather than resetting it.

### What stops a free subscription

| Attack | Stopped by |
| --- | --- |
| Insert a 1-Lek payment row directly | **No insert policy at all** — `create_payment()` is `SECURITY DEFINER` and is the only way in |
| `UPDATE payments SET status='confirmed'` on your own row | No update policy, plus `protect_payment_status` trigger |
| Set your own `pro_until` far in the future | `protect_profile_plan` pins it for non-admins |
| Call `confirm_paid_payment()` from the browser after a fake capture | Restricted to the service role or an admin; the server route uses a service key never shipped to the client |
| Replay a PayPal capture to extend twice | `confirm_paid_payment` is idempotent on `status = 'confirmed'` |

Verified with RLS genuinely enforced (as a real `authenticated` role, not the table owner
— testing as superuser silently bypasses RLS and passes everything).

## Admin console — `/admin`

A **separate application shell** from `/app`, not a page inside the customer dashboard.
The two have different jobs, and rendering operator tools inside customer chrome makes it
far too easy to ship a control to the wrong audience. Dark sidebar so it is never mistaken
for the client view. `/app/admin` 301s here.

| Route | What it does |
| --- | --- |
| `/admin` | Metrics, 30-day activity chart, pending payments, recent businesses |
| `/admin/perdoruesit` | Every business — search, filters (Pro/free/admin/inactive), paginated. Grant or revoke Pro (1/3/12 months), grant or revoke admin |
| `/admin/pagesat` | Revenue KPIs, the approval queue, and full payment history by status |
| `/admin/lista` | Waitlist submissions with one-click WhatsApp links |
| `/admin/regjistri` | Immutable audit log of every admin write action |

### Where an admin lands

An admin's home is the console: after signing in, and whenever they hit `/app`, they are
redirected to `/admin`.

Admins usually also run a business of their own, so `/app` is not sealed off — the client
pages (`/app/faturat`, `/app/klientet`, …) stay directly reachable, and **`/app?klient=1`**
opens their own dashboard. That escape hatch is not cosmetic: without it the console's
"Kthehu te aplikacioni" link would bounce straight back to `/admin` in a loop. The in-app
"Paneli" link and logo carry the same parameter for admins, so navigating inside the client
app never kicks them out of it.

Grant the first admin from the SQL editor (a normal session cannot — see below):

```sql
update public.profiles set is_admin = true
 where id = (select id from auth.users where email = 'you@example.com');
```

**RLS is not relaxed for admins.** They get no blanket "select any row" policy. Every read
and write goes through `SECURITY DEFINER` functions that each re-check `is_admin()`, so
there is exactly one place to audit.

**A deliberate limit:** the console shows business metadata, counts and money totals — it
never exposes *invoice contents or client lists*. An admin can see that a business issued
14 invoices worth 630 000 Lekë; they cannot see who was billed or for what. That is the
customers' own commercial data. Say the word if you want that opened up for support
purposes — it is a policy decision, not a technical limit.

Every write action (`pro.grant`, `pro.revoke`, `admin.grant`, `admin.revoke`,
`payment.approve`, `payment.reject`, `user.delete`) is recorded in `admin_audit` with
actor, target and detail. Two guards stop the irreversible mistake: you cannot demote
yourself, and the last remaining admin cannot be demoted.

### Deleting a business

Irreversible, and it cascades to their invoices, clients and payment records — so the
paying-customer check is a **database guard, not a dialog**:

```
admin_delete_user(user, p_acknowledge_paid => false)
  -> USER_HAS_PAID_SUBSCRIPTION   when the account has active Pro or any confirmed payment
```

`admin_user_delete_preview()` feeds the dialog, which spells out the active subscription,
how much was paid and when, and exactly what will be destroyed. For a paying customer the
delete button stays disabled until the admin types the business name; a free account needs
only a click. Enforcing it in the database means calling the RPC directly cannot skip the
warning.

The audit row is written **before** the delete — afterwards the target row is gone — and
keeps the business name, email and amount paid, so the record survives the customer.

Guards: cannot delete yourself, cannot delete the last admin, non-admins cannot even call
the preview.

Three independent guards, all verified from a real browser session as a non-admin:

| Attack | Result |
| --- | --- |
| `GET /app/admin` | redirected to `/app` by the middleware |
| Calling `admin_stats()` directly from the console, bypassing the UI | `NOT_AUTHORISED` |
| `PATCH /profiles` setting `is_admin: true` on yourself | silently reverted, stays `false` |

That third one matters: RLS *does* let a user update their own profile row, so without the
`protect_profile_plan` trigger anyone could grant themselves the entire panel with one
request. The trigger pins `is_pro` and `is_admin` to their old values whenever the request
carries a JWT, while leaving an operator in the SQL editor (no JWT) able to grant them.

## Security model

| Control | Where | What it stops |
| --- | --- | --- |
| Row Level Security | every table, owner-scoped | reading or writing another business's data |
| `enforce_invoice_quota` trigger | `invoices` BEFORE INSERT | **bypassing the free plan** by POSTing straight to PostgREST |
| `protect_profile_plan` trigger | `profiles` BEFORE UPDATE | a user setting their own `is_pro = true` |
| Storage policies | `logos` bucket | writing outside your own `<user-id>/` folder |
| CSP + friends | `src/middleware.ts` | XSS injection targets, clickjacking, MIME sniffing, referrer leakage |
| POST-only sign-out | `UserMenu` | cross-site forced logout |

The quota used to live only in the UI. The anon key is shipped to every browser by
design — RLS is what protects the data — so anyone could read that key out of the page and
create unlimited invoices via the REST API. RLS proved *ownership* but never *quantity*.
It is now a database trigger, verified by test: the 6th free invoice is rejected with
`FREE_PLAN_LIMIT_REACHED`, Pro is unlimited, the cap is per-owner, and self-promotion to
Pro is silently reverted.

Response headers are set for every route in the middleware. The CSP allows `blob:` in
`img-src` (the PDF preview) and `'unsafe-inline'` in `style-src` (Astro's inlined critical
CSS); `script-src` is `'self'` plus Astro's inline hydration bootstrappers, and
`connect-src` is limited to self plus the Supabase project origin.

## Performance

### The icon component (biggest single win)

Fulldev's `ui/icon/icon.astro` ships with:

```js
import.meta.glob([
  '/node_modules/lucide-static/icons/*.svg',
  '/node_modules/simple-icons/icons/*.svg',
], { eager: true })
```

That is **5,478 SVG modules** (2,025 lucide + 3,453 simple-icons) pulled into the module
graph by any page rendering a single icon — and since the header and footer use icons,
that is every page. Measured in dev:

| Page | Eager glob | Lazy `?raw` |
| --- | --- | --- |
| `/cmimet` (cold) | 10,256 ms | **208 ms** |
| `/kushtet` | 11,669 ms | **394 ms** |
| `/faleminderit` | 11,142 ms | **45 ms** |
| `/cmimet` (warm) | — | **55 ms** |

The component now globs lazily with `query: '?raw'`, so Vite emits import thunks and only
transforms the handful of icons actually requested. The public API is unchanged. Icon
names are interpolated into file paths, so they are validated against
`/^[a-z0-9][a-z0-9-]*$/` first — `../../../etc/passwd` is rejected.

**If you add more Fulldev blocks, check them for `eager: true` globs.**


Per-request round trips to Supabase, for an app page:

| | Before | After |
| --- | --- | --- |
| Dashboard | 7 | 3 |
| Faturat / Klientët / Cilësimet | 3–4 | 2–3 |

`app_bootstrap()` returns the profile *and* the month's invoice count in one call from the
middleware; `AppLayout` and `/app/cilesimet` now issue no queries of their own.

Payload, measured against the live database with 304 invoices:

| Query | Before | After |
| --- | --- | --- |
| Dashboard totals | 9,734 B (304 rows) | **190 B** (1 row) |
| Invoice list | 157,093 B (200 rows) | **4,683 B** (25 rows) |

The dashboard used to `select status,total` for **every invoice ever created** and sum them
in JavaScript — unbounded growth. `dashboard_stats()` aggregates in Postgres. The list used
`select('*')`, dragging each invoice's `items` JSONB across the wire for a table that never
shows it; it is now column-scoped and paginated at 25. `EXPLAIN ANALYZE` confirms the new
`invoices_owner_issue_date_idx` is used (Index Scan, not Seq Scan), and invoice-number
search has a `pg_trgm` GIN index because `ilike '%…%'` cannot use a btree.

## Colour system

| Token   | Hex       | Role                                             |
| ------- | --------- | ------------------------------------------------ |
| ink     | `#222831` | Dark chrome — hero, footer, table headers, avatars |
| slate   | `#393E46` | Secondary text, elevated dark surfaces            |
| teal    | `#00ADB5` | The signature accent                              |
| mist    | `#EEEEEE` | Page ground, alternating sections, text on ink    |

**One deliberate deviation.** `#00ADB5` measures **2.75:1 on white** — below even the
3.0 large-text floor — so it cannot legibly carry text on a light surface, nor take white
text on top. So:

- On **light** surfaces, the interactive teal is deepened to `hsl(183 100% 25%)`
  (`#00767D`) — 5.40:1 on white, 4.66:1 on mist. That is `--primary`: links, buttons,
  focus rings.
- On **ink**, `#00ADB5` is exact and unmodified (5.40:1). That is `--brand`: the hero,
  the dark Pro card, the footer, the logo mark, and the entire dark theme's `--primary`.

So the signature colour is still everywhere it reads well, and never where it doesn't.
If you'd rather force exact `#00ADB5` for light-mode text too, change `--primary` in
[`src/styles/globals.css`](src/styles/globals.css) — the contrast note is right above it.

The same rule governs the PDF: the items table header is filled `#222831` with white
text, headings and totals use `#00767D`, and `#00ADB5` appears as the accent rule under
the header, where it carries no text.

Both themes are defined. Dark mode activates on `.dark` on `<html>`; there is no toggle
in the UI yet, so the app currently renders light.

Tailwind v4 is CSS-first: there is **no `tailwind.config.mjs` and no `postcss.config.js`**.
Tokens live in `@theme inline` in [`src/styles/globals.css`](src/styles/globals.css), and
Tailwind is wired as a Vite plugin in `astro.config.mjs`.

## Stale PDF chunk ("Failed to fetch dynamically imported module")

The PDF engine is code-split and only fetched on first use — often many minutes into a
session. By then its URL may be gone:

- **Production:** a deploy rotates the hashed chunk filenames. A tab opened before the
  deploy asks for a file that no longer exists.
- **Dev:** installing any new dependency makes Vite re-optimise and rotate the `?v=` hash
  the open tab is holding.

Either way the browser throws *"Failed to fetch dynamically imported module"*, which says
nothing useful to a user whose page simply needs reloading.

`isPdfEngineLoadError()` in [`src/lib/pdf.ts`](src/lib/pdf.ts) recognises that failure
across browser wordings (Chrome/Firefox/Safari) and the editor swaps the red error for an
actionable banner with a **Rifresko faqen** button. It never auto-reloads — that would
discard an unsaved invoice.

Verified by blocking `*jspdf*` at the network layer in a real browser and pressing
"Shkarko PDF": the banner appears instead of the raw error.

`optimizeDeps.include` in `astro.config.mjs` additionally pre-bundles jspdf at dev-server
startup so first use never triggers a re-optimise.

## Form controls

No native `<select>`, date input or bare `<input>` survives in the app. The split follows
the same rule as everything else — Astro pages use Fulldev, hydrated islands use shadcn:

| Control      | Component                                   | Notes                                        |
| ------------ | ------------------------------------------- | -------------------------------------------- |
| Select       | `ui/react/select.tsx` (Radix)               | Client, status, language, VAT, city          |
| Date         | `ui/react/date-picker.tsx`                  | Popover + react-day-picker, Albanian, Mon-first |
| Slider       | `ui/react/slider.tsx`                       | Logo crop zoom                                |
| Avatar       | `ui/react/avatar.tsx`                       | Falls back to initials when there's no logo   |
| Input/Button | `ui/input`, `ui/button` (Fulldev, Astro)    | Waitlist form, invoice list search + filters  |

The date picker keeps the `yyyy-mm-dd` string shape the database already used, so nothing
downstream changed. It parses that string as a **local** date on purpose —
`new Date('2025-03-12')` is UTC midnight, which lands on the previous day west of GMT.

The app header's right side is a single `UserMenu` island: avatar (business logo, or
initials), business name, email, plan badge, a usage bar for the free monthly cap, links,
and sign-out. Sign-out submits a hidden **POST** form rather than linking to the endpoint,
so it cannot be triggered cross-site.

## Number and date formatting — deliberately not Intl

`groupThousands()` and `formatDate()` in [`src/lib/utils.ts`](src/lib/utils.ts) format by
hand instead of calling `Intl`. This is not premature optimisation — it fixes a real bug:

Node ships full ICU, but **many browsers have no Albanian locale data at all**. In testing,
Chrome returned `Intl.NumberFormat.supportedLocalesOf(['sq-AL', 'sq']) === []` and silently
resolved to `en-US`. The server rendered `27.03.2025` / `45 000` while the client rendered
`03/27/2025` / `45,000` — wrong for Albanian users, and a React hydration mismatch that
tore down and re-rendered the whole island.

Formatting by hand makes server and client byte-identical on every browser. The PDF shares
`groupThousands()` for the same reason, so paper and screen can never disagree. The
thousands separator is U+00A0, which is 0xA0 in WinAnsi and renders correctly in the PDF.

## Logo cropping

Picking a logo opens an editor rather than uploading straight away — phone photos of a
sign or card are rarely framed usefully. `react-easy-crop` handles drag/zoom, and
[`src/lib/crop-image.ts`](src/lib/crop-image.ts) turns the selection into bytes on a
canvas: rotate onto a bounding-box canvas first, then cut the selected rectangle out of
it, downscaling to an 800px max edge in the same pass.

Output is **always PNG** — logos are usually flat colour or transparent, and JPEG would
both fringe the edges and paint black behind the alpha channel. Position is unrestricted,
so dragging past the edge deliberately pads the logo with transparency.

## Money

Every monetary column is a whole-Lek `integer`. There are no cents in everyday Albanian
invoicing, so floats never enter the system. Discount applies to the subtotal, VAT applies
after the discount.

## Plan limits

The free plan is capped at `FREE_INVOICE_LIMIT` (5) invoices per calendar month; Pro
(`profiles.is_pro`) lifts it. The dashboard and the editor both surface the remaining
count.

> Note: the limit is currently enforced in the UI only. Before charging for Pro, add a
> Postgres trigger or an RLS policy that counts the month's invoices, so the cap holds
> even against direct API calls.

## Project layout

```
src/
├── components/
│   ├── react/          # islands: AuthForm, InvoiceEditor, ClientsManager,
│   │                   #          ProfileSettings, DeleteInvoiceButton
│   ├── ui/             # shadcn/ui primitives
│   ├── Logo.astro
│   └── StatusBadge.astro
├── layouts/            # BaseLayout (SEO), MarketingLayout, AppLayout
├── lib/                # supabase clients, types + totals, pdf, i18n, utils
├── pages/
└── middleware.ts       # session lookup, route guard, onboarding redirect
supabase/migrations/
```

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run preview     # preview the build
npm run typecheck   # astro check
```
