/**
 * Raw-SQL migration runner (ARCHITECTURE.md §3.2). Prisma does not own the
 * schema — db/migrations/*.sql is the source of truth and this script is
 * the only thing that applies it, locally and on the Netlify build. Doesn't
 * depend on `psql` (unavailable on Netlify's build image) — uses `pg` directly.
 *
 * Usage:
 *   tsx scripts/migrate.ts             # apply all pending migrations
 *   tsx scripts/migrate.ts --baseline  # mark all current files as applied
 *                                      # WITHOUT executing them (for a DB that
 *                                      # already has 0001/0002 applied by hand
 *                                      # and just needs the tracking table caught up)
 */

import 'dotenv/config';
import { Client } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'db', 'migrations');

const BASELINE = process.argv.includes('--baseline');

function connectionString(): string {
  // DIRECT_URL over DATABASE_URL: DDL misbehaves on Neon's pgbouncer pooler
  // (ARCHITECTURE §3.3). Locally both point at the same Docker Postgres.
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('DIRECT_URL (or DATABASE_URL) is not set.');
    process.exit(1);
  }
  return url;
}

async function ensureTrackingTable(client: Client): Promise<void> {
  await client.query(`
    create table if not exists schema_migrations (
      filename   text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function main() {
  console.log(`MIGRATIONS_DIR = ${MIGRATIONS_DIR}`);

  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  try {
    await ensureTrackingTable(client);

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    const { rows } = await client.query<{ filename: string }>('select filename from schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('No pending migrations — up to date.');
      return;
    }

    if (BASELINE) {
      for (const f of pending) {
        await client.query('insert into schema_migrations (filename) values ($1)', [f]);
        console.log(`baseline: marked ${f} as applied (not executed)`);
      }
      console.log(`Baselined ${pending.length} migration(s).`);
      return;
    }

    for (const f of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, f), 'utf8');
      console.log(`applying ${f} ...`);
      // Each file wraps itself in begin/commit — run it as one statement.
      // If it throws, its own transaction rolls back and the tracking
      // insert below never runs, so the next invocation retries this file.
      await client.query(sql);
      await client.query('insert into schema_migrations (filename) values ($1)', [f]);
      console.log(`applied ${f}`);
    }

    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
