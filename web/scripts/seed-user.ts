/**
 * Creates/updates the single hardcoded app_user (ARCHITECTURE.md §8, D10).
 * No registration flow exists yet — this script is the only way a user row
 * gets created. Uses `pg` directly (same rationale as migrate.ts/sync.ts:
 * no dependency on the generated Prisma client, so it can run before the
 * first `prisma db pull`).
 *
 * Usage: tsx scripts/seed-user.ts
 * Reads APP_USER_USERNAME / APP_USER_PASSWORD from the environment (.env).
 */

import 'dotenv/config';
import { Client } from 'pg';
import { hash } from 'bcryptjs';

async function main() {
  const username = process.env.APP_USER_USERNAME;
  const password = process.env.APP_USER_PASSWORD;
  if (!username || !password) {
    console.error('APP_USER_USERNAME and APP_USER_PASSWORD must be set (see .env.example).');
    process.exit(1);
  }

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DIRECT_URL (or DATABASE_URL) is not set.');
    process.exit(1);
  }

  const passwordHash = await hash(password, 12);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      `insert into app_user (username, password_hash) values ($1, $2)
       on conflict (username) do update set password_hash = excluded.password_hash`,
      [username, passwordHash],
    );
    console.log(`User "${username}" created/updated.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
