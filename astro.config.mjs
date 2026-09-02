import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://fatura.co',
  output: 'server',
  /*
    Astro 7's HTML compressor drops the whitespace between a text node and an
    inline element that follows it on the next line, which Astro 5 collapsed to
    a single space. That turned markup like

      Fatura profesionale në
      <span>2 minuta</span>, jo 2 orë.

    into "në2 minuta" in the hero, and did the same to the "shkruaj në <a>"
    sentences on /cmimet and /privatesia. Whitespace between words is content,
    not formatting, so the compressor is off rather than every such line being
    rewritten with an entity that the next contributor would have to know about.
    Gzip reclaims almost all of the difference.
  */
  compressHTML: false,
  security: {
    // Astro only trusts `Host`/`X-Forwarded-Host` for hosts listed here; every
    // other host collapses to `localhost`. Behind Vercel's proxy that made
    // `Astro.url.origin` "https://localhost", so the built-in origin check saw
    // the real `Origin` header as cross-site and 403'd every form POST
    // ("Cross-site POST form submissions are forbidden" on /api/waitlist).
    allowedDomains: [
      { hostname: 'fatura.co', protocol: 'https' },
      { hostname: '**.fatura.co', protocol: 'https' },
      // Production alias plus every preview/branch deployment.
      { hostname: '**.vercel.app', protocol: 'https' },
      // `npm run preview` serves the real Vercel handler over plain HTTP.
      { hostname: 'localhost' },
    ],
  },
  adapter: vercel({
    webAnalytics: { enabled: false },
    imageService: false,
  }),
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/app/') && !page.includes('/auth/'),
    }),
  ],
  vite: {
    /*
      `@` has to be declared here, not only in tsconfig paths. Vite 8 resolves
      CSS with Rolldown, which does not read tsconfig — so the
      `@reference "@/styles/globals.css"` that every typography component uses
      to reach Tailwind stopped resolving on the Astro 7 upgrade. JS imports
      kept working, which is what made the failure look like a CSS-only bug.
    */
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // Tailwind v4 is a Vite plugin now — there is no @astrojs/tailwind
    // integration and no postcss.config.js.
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Pre-bundle the PDF engine at dev-server startup. It is only reached
      // through a dynamic import inside an island, so leaving it to lazy
      // discovery makes Vite re-optimise on first "Shkarko PDF" and invalidate
      // the `?v=` hash an already-open tab is holding.
      include: ['jspdf', 'jspdf-autotable'],
    },
    ssr: {
      // jsPDF must never be pulled into the server bundle — PDF is 100% client-side.
      external: ['jspdf', 'jspdf-autotable'],
    },
  },
});
