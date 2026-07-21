-- 0006 · Course skeleton moves from hand-written SQL to courses/<slug>/course.yaml.
--
-- Until now the course map (course, blocks, modules, checkpoints, the 4-session
-- protocol and its steps) was seeded by 0002 and re-seeded by 0004, so a second
-- course — or any edit to the protocol — meant another migration. scripts/sync.ts
-- now upserts the whole skeleton from courses/<slug>/course.yaml by natural key
-- (ARCHITECTURE.md §4.1), which reverses the earlier rule that sync only ever
-- *updates* structure it never creates.
--
-- 0002 and 0004 stay applied and are not edited (they are history). courses/en-c1/
-- course.yaml was extracted from them verbatim, so the first sync after this
-- migration matches every existing row and changes nothing but the hash.
--
-- No data migration is needed: every table already carries the natural keys the
-- upsert targets (course.slug, block(course_id,slug), module(block_id,slug),
-- checkpoint(course_id,slug), study_session(module_id,session_type),
-- session_step(study_session_id,position)).

begin;

-- Gate hash over the raw bytes of course.yaml — the skeleton equivalent of
-- module.content_hash (§4.4). Matching hash ⇒ sync skips the course in 0 queries.
alter table course add column if not exists skeleton_hash text;

commit;
