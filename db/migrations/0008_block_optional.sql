-- Optional blocks: a block whose modules are open from the start, gate nothing
-- and count toward no hour budget.
--
-- Motivation (courses/de-a2): the course assumes the learner already holds the
-- level below it, so the refresher material for that level must be available
-- without standing in the way. Before this column the only way to ship such a
-- module was to put it in the linear chain, where it became the course entry
-- point — and, having no checkpoint of its own, permanently sealed the block
-- after it (see lib/use-cases/checkpoint.ts, which opens the next block only on
-- a passed block checkpoint).
--
-- Consumers: ensureFirstModuleUnlocked skips optional blocks when picking the
-- course entry module; ensureOptionalModulesUnlocked opens every module inside
-- one; getNextBlock steps over them.

alter table block add column if not exists optional boolean not null default false;

comment on column block.optional is
  'Block outside the linear gate: its modules open immediately, it unlocks nothing and carries no checkpoint.';
