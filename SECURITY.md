# Security posture

Last audited 2026-09-02. Re-run with `npm audit --omit=dev`.

```
found 0 vulnerabilities
```

The tree carried **9 advisories (1 critical, 6 high)** before this pass. All are
cleared. What follows is how, and what to watch when these packages move again.

## What was upgraded

| Package | From | To | Cleared |
|---|---|---|---|
| `astro` | 5.18.2 | 7.2.10 | 5 XSS (2 high), Host-header SSRF (high), server-island replay |
| `@astrojs/vercel` | 8.2.11 | 11.0.9 | Unauthenticated path override via `x-astro-path` (GHSA-mr6q-rp88-fx84) |
| `@astrojs/react` | 4.x | 6.0.5 | — (peer of Astro 7; React stays on 18) |
| `jspdf` | 2.5.2 | 4.2.1 | ReDoS / DoS (**critical**), transitive `dompurify` XSS |
| `jspdf-autotable` | 3.8.4 | 5.0.8 | inherited `jspdf` advisories |
| `path-to-regexp` | 6.1.0 | 6.3.0 (override) | ReDoS (high) ×3 |

`@vercel/routing-utils` pins `path-to-regexp` at exactly `6.1.0`, so the only
way to patch it is the `overrides` entry in `package.json`. It is reached at
build time, where the adapter generates Vercel's routing config — never in the
request path. Drop the override once the adapter's own dependency moves.

## Three things the upgrade broke, and the fixes

These were caught by the verification below, not by the build — two of them
build perfectly and are wrong at runtime.

1. **`@` stopped resolving inside CSS.** Vite 8 resolves CSS with Rolldown,
   which does not read `tsconfig` paths, so the `@reference "@/styles/globals.css"`
   that every `ui/typography` component uses to reach Tailwind failed. JS
   imports kept working, which made it look like a CSS-only bug. Fixed with an
   explicit `resolve.alias` in `astro.config.mjs`.

2. **`cookie` resolved to the wrong major.** Astro 7 needs `cookie@2`
   (`parseCookie`), `@supabase/ssr` needs `cookie@^0.7` (`parse`), and npm
   hoisted the 0.7 copy to the root — where Vite's module runner found it.
   Fixed by making `cookie@^2` a direct devDependency, which pushes 0.7 down
   under `@supabase/ssr` where it belongs.

3. **Astro 7's HTML compressor eats significant whitespace.** It drops the
   space between a text node and an inline element on the next line, which
   Astro 5 collapsed to one space. `Fatura profesionale në\n<span>2 minuta</span>`
   rendered as **"në2 minuta"**, and the same happened to the
   "shkruaj në `<a>`" sentences on `/cmimet` and `/privatesia` — seven sites in
   all. `compressHTML: false` is now set: whitespace between words is content,
   not formatting, and the alternative is every such line carrying an entity
   the next contributor has to know about. Costs ~1 KB gzip on the homepage.

## Hardening kept in application code

In [`src/middleware.ts`](src/middleware.ts), and still worth keeping now that
the adapter is patched:

- **`x-astro-path` / `x_astro_path` are refused with a `400`** before anything
  reads the path.
- **Every authorization decision runs on a fully decoded path.** Astro has
  shipped router/middleware normalisation mismatches repeatedly
  (CVE-2025-64765 and its follow-up bypasses); this does not go stale when the
  next one lands. Malformed escapes, `..`, backslashes and NUL bytes are `400`.

## Defence in depth that was already here

Worth stating, because it is why the path-override advisory was a redirect
bypass rather than a data breach:

- Row-level security on every table; admin tables additionally require `is_admin()`.
- Admin RPCs are `SECURITY DEFINER` and re-check `is_admin()` / `is_manager()`.
- The invoice quota is enforced by a database trigger, not by the UI.
- `getClaims()` verifies the JWT signature against the project JWKS; every
  query is re-validated independently by PostgREST.

## Known weakness, not addressed

`script-src` still carries `'unsafe-inline'` (see `securityHeaders()`), because
Astro emits inline hydration bootstrappers. That materially weakens the CSP
against injected script. Astro's CSP support can emit hashes instead and would
let `'unsafe-inline'` go, but it has to be reconciled with the hand-written
header in `middleware.ts` first.

## Verification

Run `npm run build && npm run preview`, then:

```bash
# must be refused
curl -so/dev/null -w'%{http_code}\n' localhost:4321/login -H 'x-astro-path: /admin/perdoruesit'   # 400
curl -so/dev/null -w'%{http_code}\n' 'localhost:4321/login?x_astro_path=/admin/perdoruesit'       # 400

# must redirect to /login, not serve
curl -so/dev/null -w'%{redirect_url}\n' 'localhost:4321/%61pp/faturat'                            # /login?next=/app/faturat
curl -so/dev/null -w'%{redirect_url}\n' 'localhost:4321/%61dmin/perdoruesit'                      # /login?next=/admin/perdoruesit

# must still serve
for p in / /cmimet /login /regjistrohu /kushtet /privatesia; do
  curl -so/dev/null -w"$p %{http_code}\n" "localhost:4321$p"
done
```

The invoice PDF is the thing most likely to regress silently on a `jspdf` bump.
Compare against a known-good file with `pdftotext -layout` and a
`pdftoppm`-rendered page — the 2.5.2 → 4.2.1 upgrade was verified
**pixel-identical** that way.
