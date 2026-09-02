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
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

const ROOT = resolve('.vercel/output');
const STATIC = join(ROOT, 'static');
const HANDLER = join(ROOT, 'functions/_render.func/dist/server/entry.mjs');
const PORT = Number(process.env.PORT ?? 4321);

if (!existsSync(HANDLER)) {
  console.error('No build found. Run `npm run build` first.');
  process.exit(1);
}

const { default: entry } = await import(pathToFileURL(HANDLER).href);

/*
  @astrojs/vercel 11 exports a Web `fetch` handler — `{ default: { fetch } }` —
  where 8 exported a Node `(req, res)` function. Both shapes are accepted so
  this script does not become another thing to remember on the next adapter
  bump; the bridge below is only used for the fetch form.
*/
const fetchHandler =
  typeof entry === 'function' ? null : typeof entry?.fetch === 'function' ? entry.fetch : null;

if (!fetchHandler && typeof entry !== 'function') {
  console.error('Unrecognised adapter entrypoint: expected a function or { fetch }.');
  process.exit(1);
}

/** Node IncomingMessage -> Web Request. */
function toWebRequest(req) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
  });
}

/** Web Response -> Node ServerResponse. */
async function sendWebResponse(response, res) {
  // set-cookie is the one header that legitimately repeats.
  const cookies = response.headers.getSetCookie?.() ?? [];
  for (const [key, value] of response.headers) {
    if (key.toLowerCase() === 'set-cookie') continue;
    res.setHeader(key, value);
  }
  if (cookies.length) res.setHeader('set-cookie', cookies);

  res.writeHead(response.status);
  if (!response.body) return res.end();
  await pipeline(Readable.fromWeb(response.body), res);
}

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
  if (!fetchHandler) return entry(req, res);

  Promise.resolve(fetchHandler(toWebRequest(req)))
    .then((response) => sendWebResponse(response, res))
    .catch((error) => {
      console.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end('Internal Server Error');
    });
}).listen(PORT, () => {
  console.log(`\n  Production build running at http://localhost:${PORT}\n`);
});
