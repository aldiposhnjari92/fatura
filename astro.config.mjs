import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://fatura.co',
  output: 'server',
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
