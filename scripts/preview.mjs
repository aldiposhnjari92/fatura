/*
  Local preview of the production build.

  `astro preview` refuses to run under the Vercel adapter, because the adapter
  emits a serverless function rather than a standalone server. The build output
  is still perfectly runnable though: .vc-config.json names a Node handler, and
  the static assets sit beside it. This wires the two together so the real
  built app — bundled, minified, one request per chunk — can be checked on a
  laptop before it goes anywhere near production.

  This is a development convenience, not part of the deploy. Vercel ignores it.
*/
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve('.vercel/output');
const STATIC = join(ROOT, 'static');
const HANDLER = join(ROOT, 'functions/_render.func/dist/server/entry.mjs');
const PORT = Number(process.env.PORT ?? 4321);

if (!existsSync(HANDLER)) {
  console.error('No build found. Run `npm run build` first.');
  process.exit(1);
}

const { default: handler } = await import(pathToFileURL(HANDLER).href);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/** Resolve a URL to a file in the static output, if one exists. */
function staticFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]);
  // Reject traversal before touching the filesystem.
  const target = resolve(join(STATIC, clean));
  if (!target.startsWith(STATIC)) return null;

  for (const candidate of [target, join(target, 'index.html'), `${target}.html`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

createServer((req, res) => {
  const file = staticFile(req.url ?? '/');
  if (file) {
    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    // Match the long-lived caching Vercel applies to hashed assets, so the
    // preview reflects real repeat-visit behaviour.
    if (file.includes('/_astro/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    createReadStream(file).pipe(res);
    return;
  }
  handler(req, res);
}).listen(PORT, () => {
  console.log(`\n  Production build running at http://localhost:${PORT}\n`);
});
