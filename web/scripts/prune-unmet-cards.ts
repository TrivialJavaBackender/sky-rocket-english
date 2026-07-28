/**
 * Retires deck entries for words the learner has not actually met yet
 * (ARCHITECTURE.md §6.4, UC-15 deck dosing).
 *
 * Until batch dosing landed, `flashcards_intro` introduced a module's whole
 * deck from its Prime session — all 45 lexemes × 2 directions — while the
 * session protocol only presents batch 1 there and batches 2/3 in Input. Cards
 * for unmet words therefore came due days before their step, which is what made
 * daily review feel bottomless. New introductions are now gated on step state,
 * but the rows already in `card_state` are not undone by that change; this
 * script clears them.
 *
 * Only ever deletes rows that carry no progress: `reps = 0`, no
 * `last_reviewed_at`, no `card_review_log` history. A card that was already
 * graded is left alone whatever its batch, so nothing the learner has done is
 * thrown away. Deleted cards are not lost either — the next visit to
 * `/flashcards` or `/review` re-introduces them as soon as their `vocab` step
 * is done, with due dates spread over the following week.
 *
 * Usage: tsx scripts/prune-unmet-cards.ts --username=<name> [--dry-run]
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

/**
 * The eligibility ceiling, in SQL: how many of a module's ordered lexemes its
 * completed `vocab` steps cover. `partBounds` (domain/content-slicing.ts) gives
 * earlier batches the remainder, so batch B of N ends at
 * `floor(total/N)*B + min(B, total mod N)` — 45 lexemes in 3 batches end at
 * 15/30/45, 46 at 16/31/46.
 */
const MET_VOCAB_SQL = `
  with vocab_total as (
    select module_id, count(*)::int as total
      from vocab_entry
     group by module_id
  ),
  done_batches as (
    select s.module_id,
           coalesce((ss.config->>'batch')::int, 1) as batch,
           coalesce((ss.config->>'of')::int, 1)    as of_n
      from session_step ss
      join study_session s on s.id = ss.study_session_id
      join user_step_state uss on uss.session_step_id = ss.id
     where ss.kind = 'vocab'
       and uss.user_id = $1
       and uss.status = 'done'
  )
  select vt.module_id,
         coalesce(max(
           (vt.total / db.of_n) * db.batch + least(db.batch, vt.total % db.of_n)
         ), 0) as met
    from vocab_total vt
    left join done_batches db on db.module_id = vt.module_id
   group by vt.module_id, vt.total
`;

async function main() {
  const username = process.argv.find((a) => a.startsWith('--username='))?.split('=')[1];
  const dryRun = process.argv.includes('--dry-run');
  if (!username) {
    console.error('Usage: tsx scripts/prune-unmet-cards.ts --username=<name> [--dry-run]');
    process.exit(1);
  }

  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    const user = await client.query<{ id: string }>('select id from app_user where username = $1', [username]);
    if (user.rowCount === 0) {
      console.error(`No app_user with username "${username}".`);
      process.exit(1);
    }
    const userId = user.rows[0].id;

    const targets = `
      with met as (${MET_VOCAB_SQL})
      select cs.flashcard_id, c.slug as course, m.slug as module, v.term, v.position
        from card_state cs
        join flashcard f on f.id = cs.flashcard_id
        join vocab_entry v on v.id = f.vocab_entry_id
        join met on met.module_id = f.module_id
        join module m on m.id = f.module_id
        join block b on b.id = m.block_id
        join course c on c.id = b.course_id
       where cs.user_id = $1
         and v.position > met.met
         and cs.reps = 0
         and cs.last_reviewed_at is null
         and not exists (select 1 from card_review_log crl where crl.user_id = cs.user_id and crl.flashcard_id = cs.flashcard_id)
       order by c.slug, m.slug, v.position
    `;
    const rows = await client.query<{ flashcard_id: string; course: string; module: string; term: string; position: number }>(targets, [userId]);

    const byModule = new Map<string, { count: number; sample: string[] }>();
    for (const r of rows.rows) {
      const key = `${r.course} · ${r.module}`;
      const entry = byModule.get(key) ?? { count: 0, sample: [] };
      entry.count += 1;
      if (entry.sample.length < 3) entry.sample.push(`${r.term} (#${r.position})`);
      byModule.set(key, entry);
    }

    console.log(`${rows.rowCount} unmet, never-graded card(s) for "${username}":`);
    for (const [key, { count, sample }] of byModule) console.log(`  ${key}: ${count} — e.g. ${sample.join(', ')}`);
    if (rows.rowCount === 0) return;

    if (dryRun) {
      console.log('\n--dry-run: nothing deleted.');
      return;
    }

    const deleted = await client.query(
      `delete from card_state cs
        using flashcard f, vocab_entry v, (${MET_VOCAB_SQL}) met
        where cs.user_id = $1
          and f.id = cs.flashcard_id
          and v.id = f.vocab_entry_id
          and met.module_id = f.module_id
          and v.position > met.met
          and cs.reps = 0
          and cs.last_reviewed_at is null
          and not exists (select 1 from card_review_log crl where crl.user_id = cs.user_id and crl.flashcard_id = cs.flashcard_id)`,
      [userId],
    );
    console.log(`\nDeleted ${deleted.rowCount} card_state row(s). They return, spread over a week, once their vocab step is done.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
