-- 0007 · Per-task word target for writing_task.
--
-- WritingEditor hardcoded [220, 260] — the CAE essay length — and showed it as
-- "(220–260 target)" under every writing task in every course. On de-a2, where
-- the diagnostic asks for 30–40 words and module tasks for 50–60, the editor
-- contradicted the prompt directly above it. Same class of bug as the hardcoded
-- "German · A2 → B1 · SOON" nav row: the frontend asserting course facts it has
-- no business knowing (ARCHITECTURE.md §8 D4).
--
-- Nullable on purpose: `mode: speaking` tasks have no word count, and a course
-- may legitimately decline to set one. The editor shows a plain word count when
-- both columns are null instead of inventing a target.

begin;

alter table writing_task add column if not exists word_min int;
alter table writing_task add column if not exists word_max int;

alter table writing_task
  add constraint writing_task_word_target_sane
  check (
    (word_min is null and word_max is null)
    or (word_min is not null and word_max is not null and word_min > 0 and word_min <= word_max)
  );

commit;
