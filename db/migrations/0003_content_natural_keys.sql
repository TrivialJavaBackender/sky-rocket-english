-- 0003_content_natural_keys.sql — stable natural keys for exercise, writing_task, flashcard.
-- 0001 gave these tables no unique natural key: a full re-sync that recreates
-- rows (or keys them by position) would change their ids on any content
-- reorder, orphaning exercise_attempt / review_queue_item / card_state / module_review.
-- `ident` is a deterministic, content-derived (or author-supplied) key that
-- scripts/sync.ts upserts on, so ids stay stable across re-sync.
-- Apply: applied by scripts/migrate.ts (or psql "$DATABASE_URL" -f db/migrations/0003_content_natural_keys.sql)

begin;

alter table exercise add column ident text;
create unique index exercise_module_ident_uniq
  on exercise (module_id, ident) where module_id is not null;
create unique index exercise_checkpoint_ident_uniq
  on exercise (checkpoint_id, ident) where checkpoint_id is not null;

alter table writing_task add column ident text;
create unique index writing_task_module_ident_uniq
  on writing_task (module_id, ident) where module_id is not null;
create unique index writing_task_checkpoint_ident_uniq
  on writing_task (checkpoint_id, ident) where checkpoint_id is not null;

alter table flashcard add column ident text;
create unique index flashcard_ident_uniq on flashcard (ident);

commit;
