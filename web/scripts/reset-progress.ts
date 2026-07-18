/**
 * Wipes every progress row for the seeded user, leaving content (module/
 * exercise/vocab_entry/gloss/writing_task/content-sourced flashcards/...)
 * and the app_user row itself untouched — gives stage 4 (or a re-run of
 * verify-backend.ts) a clean slate without re-running migrate/sync/seed-user.
 *
 * Deletes are ordered so FK references clear before their targets (e.g.
 * review_queue_item/error_map_entry before exercise_attempt) even though
 * every relevant FK is ON DELETE CASCADE/SET NULL and would tolerate any
 * order — explicit ordering just keeps the intent readable.
 *
 * User-created flashcards (source='gloss'|'error_harvest'|'manual', i.e.
 * created_by_user_id set) only exist *because of* progress the learner
 * made, so they're deleted outright rather than orphaned; content-sourced
 * flashcards (source='content', created_by_user_id null) are untouched.
 *
 * Usage: tsx scripts/reset-progress.ts [--username=pavel]
 */
import 'dotenv/config';
import { Client } from 'pg';

function connectionString(): string {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('DIRECT_URL (or DATABASE_URL) is not set.');
    process.exit(1);
  }
  return url;
}

const PROGRESS_TABLES_BY_USER_ID = [
  'review_queue_item',
  'module_review',
  'error_map_entry',
  'exercise_attempt',
  'writing_submission',
  'card_review_log',
  'card_state',
  'daily_activity',
  'user_vocab_state',
  'user_grammar_state',
  'user_module_state',
  'user_session_state',
  'user_step_state',
  'user_checkpoint_state',
  'user_course',
] as const;

async function main() {
  const usernameArg = process.argv.find((a) => a.startsWith('--username='));
  const username = usernameArg ? usernameArg.split('=')[1] : (process.env.APP_USER_USERNAME ?? 'pavel');

  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    const userRow = await client.query<{ id: number }>('select id from app_user where username = $1', [username]);
    if (userRow.rowCount === 0) {
      console.error(`No app_user with username "${username}" — nothing to reset.`);
      process.exit(1);
    }
    const userId = userRow.rows[0].id;

    const flashcardResult = await client.query('delete from flashcard where created_by_user_id = $1', [userId]);
    console.log(`flashcard (user-created: gloss/error_harvest/manual): -${flashcardResult.rowCount ?? 0}`);

    for (const table of PROGRESS_TABLES_BY_USER_ID) {
      const result = await client.query(`delete from ${table} where user_id = $1`, [userId]);
      console.log(`${table}: -${result.rowCount ?? 0}`);
    }

    console.log(`\nProgress reset for user "${username}" (id=${userId}). Content tables untouched.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
