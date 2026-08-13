#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql to the Supabase Postgres database.
 *
 *   npm run db:push          apply every pending migration
 *   npm run db:status        show applied / pending, change nothing
 *   npm run db:push -- --dry-run
 *   npm run db:push -- --force <name>   re-apply one migration
 *
 * Each file runs inside a single transaction and is recorded in
 * public._fatura_migrations, so re-running is safe and only new files execute.
 */
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(HERE, '..', 'supabase', 'migrations');
const LEDGER = 'public._fatura_migrations';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const STATUS_ONLY = args.includes('--status');
const forceIndex = args.indexOf('--force');
const FORCE = forceIndex !== -1 ? args[forceIndex + 1] : null;

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function die(message, hint) {
  console.error(`\n${c.red}✗ ${message}${c.reset}`);
  if (hint) console.error(`\n${hint}\n`);
  process.exit(1);
}

/** Read SUPABASE_DB_URL from the environment or from a local .env file. */
/** The placeholder shipped in .env — a clearer failure than a bogus password. */
function assertPasswordFilledIn(connectionString) {
  if (!/REPLACE_WITH_DB_PASSWORD/i.test(connectionString)) return connectionString;
  die(
    'SUPABASE_DB_URL still contains the REPLACE_WITH_DB_PASSWORD placeholder.',
    `Open ${c.cyan}.env${c.reset} and swap it for your database password:

  Supabase Dashboard → Project Settings → Database → Database password
  (never saved it? click "Reset database password" on that page)

  ${c.dim}That is the database password, not the publishable/anon key.
  Percent-encode any @ : / # in it — @ becomes %40, # becomes %23.${c.reset}`
  );
}

async function resolveConnectionString() {
  if (process.env.SUPABASE_DB_URL)
    return assertPasswordFilledIn(process.env.SUPABASE_DB_URL.trim());

  for (const file of ['.env.local', '.env']) {
    try {
      const raw = await readFile(path.join(HERE, '..', file), 'utf8');
      const match = raw.match(/^\s*SUPABASE_DB_URL\s*=\s*(.+)\s*$/m);
      if (match) {
        return assertPasswordFilledIn(match[1].trim().replace(/^["']|["']$/g, ''));
      }
    } catch {
      /* file simply isn't there */
    }
  }

  die(
    'SUPABASE_DB_URL is not set.',
    `${c.bold}How to get it:${c.reset}
  Supabase Dashboard → your project → Connect → Connection string → URI
  Pick ${c.bold}Session pooler${c.reset} (or Direct connection). Replace [YOUR-PASSWORD]
  with your database password, then add it to ${c.cyan}.env${c.reset}:

    SUPABASE_DB_URL=postgresql://postgres.abcdefgh:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres

  ${c.dim}Note: this is the database password, not the anon key. Never commit it —
  .env is gitignored.${c.reset}`
  );
}

/**
 * Supabase terminates TLS with its own CA, and verifying it would need a bundle
 * we don't ship — so encrypt without verifying. A local or self-hosted Postgres
 * usually has no TLS at all, so detect that instead of failing on it.
 */
function resolveSsl(connectionString) {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get('sslmode');
    if (sslmode === 'disable') return false;

    const host = url.hostname;
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local');
    if (isLocal && !sslmode) return false;

    return { rejectUnauthorized: false };
  } catch {
    return { rejectUnauthorized: false };
  }
}

function describeConnection(connectionString) {
  try {
    const url = new URL(connectionString);
    return `${url.hostname}:${url.port || 5432}${url.pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
}

async function loadMigrations() {
  let entries;
  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch {
    die(`No migrations directory at ${MIGRATIONS_DIR}`);
  }

  const files = entries.filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) die('No .sql files found in supabase/migrations/');

  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(path.join(MIGRATIONS_DIR, name), 'utf8');
      return {
        name,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex').slice(0, 12),
      };
    })
  );
}

async function main() {
  const connectionString = await resolveConnectionString();
  const migrations = await loadMigrations();

  console.log(`\n${c.bold}Fatura.co — database migrations${c.reset}`);
  console.log(`${c.dim}→ ${describeConnection(connectionString)}${c.reset}\n`);

  const client = new pg.Client({
    connectionString,
    ssl: resolveSsl(connectionString),
    statement_timeout: 120_000,
  });

  // Migrations report skipped/optional work through NOTICE (see 0002_storage.sql),
  // which is silent unless we listen for it.
  const notices = [];
  client.on('notice', (notice) => {
    const text = (notice.message ?? '').trim();
    if (!text) return;
    // Routine chatter from `drop ... if exists` / `create ... if not exists`.
    if (/does not exist, skipping|already exists, skipping/i.test(text)) return;

    notices.push(text);
    const isSkip = /SKIPPED/i.test(text);
    console.log(
      `      ${isSkip ? c.yellow : c.dim}${text.replace(/^\[fatura\]\s*/, '')}${c.reset}`
    );
  });

  try {
    await client.connect();
  } catch (error) {
    die(
      `Could not connect: ${error.message}`,
      `Check that the password in SUPABASE_DB_URL is correct and URL-encoded
  (a literal @ / : / # in the password must be percent-encoded).`
    );
  }

  try {
    await client.query(`
      create table if not exists ${LEDGER} (
        name        text primary key,
        checksum    text        not null,
        applied_at  timestamptz not null default now()
      );
    `);

    const { rows } = await client.query(
      `select name, checksum from ${LEDGER}`
    );
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));

    // ---- report ----------------------------------------------------
    let pending = [];
    for (const migration of migrations) {
      const previous = applied.get(migration.name);
      if (!previous) {
        console.log(`  ${c.yellow}pending${c.reset}  ${migration.name}`);
        pending.push(migration);
      } else if (previous !== migration.checksum) {
        console.log(
          `  ${c.yellow}changed${c.reset}  ${migration.name} ${c.dim}(applied as ${previous}, now ${migration.checksum})${c.reset}`
        );
      } else {
        console.log(`  ${c.green}applied${c.reset}  ${migration.name}`);
      }
    }

    if (FORCE) {
      const forced = migrations.find((m) => m.name === FORCE || m.name.startsWith(FORCE));
      if (!forced) die(`--force: no migration matching "${FORCE}"`);
      console.log(`\n${c.yellow}Forcing re-run of ${forced.name}${c.reset}`);
      pending = [forced];
    }

    if (STATUS_ONLY) {
      console.log(
        `\n${pending.length} pending, ${applied.size} already applied.\n`
      );
      return;
    }

    if (pending.length === 0) {
      console.log(`\n${c.green}✓ Database is up to date.${c.reset}\n`);
      return;
    }

    if (DRY_RUN) {
      console.log(
        `\n${c.dim}--dry-run: would apply ${pending.length} migration(s), nothing executed.${c.reset}\n`
      );
      return;
    }

    // ---- apply -----------------------------------------------------
    console.log('');
    for (const migration of pending) {
      console.log(`  applying ${migration.name} …`);
      try {
        await client.query('begin');
        await client.query(migration.sql);
        await client.query(
          `insert into ${LEDGER} (name, checksum) values ($1, $2)
             on conflict (name) do update set checksum = excluded.checksum, applied_at = now()`,
          [migration.name, migration.checksum]
        );
        await client.query('commit');
        console.log(`      ${c.green}✓ done${c.reset}`);
      } catch (error) {
        await client.query('rollback').catch(() => {});
        console.log(`      ${c.red}✗ failed — this file was rolled back entirely${c.reset}`);
        die(`${migration.name}: ${error.message}`);
      }
    }

    // ---- verify ----------------------------------------------------
    const { rows: tables } = await client.query(`
      select table_name from information_schema.tables
       where table_schema = 'public'
         and table_name in ('profiles','clients','invoices','waitlist_fatura')
       order by table_name;
    `);
    const { rows: buckets } = await client
      .query(`select id, public from storage.buckets where id = 'logos'`)
      .catch(() => ({ rows: [] }));
    const { rows: policies } = await client
      .query(
        `select policyname from pg_policies
          where schemaname = 'storage' and tablename = 'objects'
            and policyname like 'logos_%'`
      )
      .catch(() => ({ rows: [] }));

    console.log(`\n${c.bold}Verification${c.reset}`);

    let healthy = true;
    for (const expected of ['clients', 'invoices', 'profiles', 'waitlist_fatura']) {
      const found = tables.some((t) => t.table_name === expected);
      if (!found) healthy = false;
      console.log(
        `  ${found ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`} table ${expected}`
      );
    }

    const bucket = buckets[0];
    if (!bucket) healthy = false;
    console.log(
      `  ${bucket ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`} storage bucket logos${
        bucket ? (bucket.public ? ' (public)' : `${c.yellow} — NOT public${c.reset}`) : ''
      }`
    );

    // Without these, logo upload fails with a row-level-security error even
    // though the bucket exists — so check them explicitly.
    const policyOk = policies.length >= 4;
    if (!policyOk) healthy = false;
    console.log(
      `  ${policyOk ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`} storage policies (${policies.length}/4)`
    );

    if (!policyOk) {
      console.log(`\n${c.yellow}${c.bold}Logo upload will fail until the storage policies exist.${c.reset}
  Your database role cannot create policies on storage.objects, so add them by hand:

    Dashboard → Storage → logos → Policies → New policy

    1. SELECT   · target roles: public         · USING:      bucket_id = 'logos'
    2. INSERT   · target roles: authenticated  · WITH CHECK: bucket_id = 'logos'
                  and (storage.foldername(name))[1] = auth.uid()::text
    3. UPDATE   · target roles: authenticated  · same expression, USING + WITH CHECK
    4. DELETE   · target roles: authenticated  · same expression, USING`);
    }

    console.log(
      healthy
        ? `\n${c.green}✓ Migrations applied. Database is ready.${c.reset}\n`
        : `\n${c.yellow}⚠ Migrations applied, but the checks above need attention.${c.reset}\n`
    );
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\n${c.red}✗ Unexpected error:${c.reset} ${error.stack || error.message}\n`);
  process.exit(1);
});
