import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://fatura.co',
  output: 'server',
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
