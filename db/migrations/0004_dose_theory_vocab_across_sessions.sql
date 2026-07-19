-- 0004 · Dose theory and vocabulary across all four sessions (PLAN.md §3 revision).
--
-- Replaces the 0002 step matrix for every en-c1 module: theory is split into
-- two parts (Prime part 1, Workout part 2 right before the drills), vocabulary
-- into three batches (Prime 1/3, Input 2/3 + 3/3), and step `detail` texts are
-- rewritten as learner-facing micro-goals. Slicing is content-agnostic: the
-- app resolves {"part":P,"of":N} / {"batch":B,"of":N} against the module's
-- ordered spotlights/vocab at render time, so modules with different content
-- counts degrade gracefully.
--
-- Progress impact (accepted by the owner): deleting session_step cascades
-- user_step_state, and user_session_state for en-c1 is reset explicitly —
-- the old statuses describe step lists that no longer exist. Everything else
-- (user_module_state, card_state, review_queue_item, module_review,
-- user_vocab_state, user_grammar_state, attempts, daily activity) is untouched.

begin;

delete from session_step ss
using study_session s, module m, block b, course c
where ss.study_session_id = s.id
  and s.module_id = m.id
  and m.block_id = b.id
  and b.course_id = c.id
  and c.slug = 'en-c1';

delete from user_session_state uss
using study_session s, module m, block b, course c
where uss.study_session_id = s.id
  and s.module_id = m.id
  and m.block_id = b.id
  and b.course_id = c.id
  and c.slug = 'en-c1';

insert into session_step (study_session_id, position, kind, title, detail, planned_minutes, config)
select s.id, v.position, v.kind::step_kind, v.title, v.detail, v.minutes, v.config::jsonb
from study_session s
join module m on m.id = s.module_id
join block b  on b.id = m.block_id
join course c on c.id = b.course_id and c.slug = 'en-c1'
join (values
  -- Session 1 · Prime — enter the topic
  ('prime',   1, 'opener',           'Unit opener',
   'See what this module builds toward — each goal lights up as you earn it', 5,  '{}'),
  ('prime',   2, 'reading',          'Skim the long-read',
   'Get the gist in one pass — no dictionary, glosses off',                   10, '{"reading_kind":"main","mode":"skim"}'),
  ('prime',   3, 'theory',           'Grammar spotlight · part 1',
   'Master the first half of the module''s constructions',                    20, '{"part":1,"of":2}'),
  ('prime',   4, 'vocab',            'Vocabulary studio · 1 of 3',
   'Meet the first batch of lexemes and mark your priority items',            20, '{"batch":1,"of":3}'),
  ('prime',   5, 'flashcards_intro', 'New cards into rotation',
   'Put the module''s decks into your daily review queue',                    5,  '{}'),
  -- Session 2 · Input — deep reading + vocabulary
  ('input',   1, 'review_slot',      'Review Slot',
   'Clear 10 items from the exercise re-queue',                               12, '{"count":10}'),
  ('input',   2, 'vocab',            'Vocabulary in focus · 2 of 3',
   'Meet the second batch — you''ll spot these in the text next',             10, '{"batch":2,"of":3}'),
  ('input',   3, 'reading',          'Close reading with glosses',
   'Hunt the target constructions and focus lexemes in the long-read',        20, '{"reading_kind":"main","mode":"close"}'),
  ('input',   4, 'exercise_set',     'Check the reading',
   'Prove you caught the detail, not just the gist',                          8,  '{"types":["reading_comprehension"]}'),
  ('input',   5, 'vocab',            'Vocabulary in focus · 3 of 3',
   'Meet the final batch before you drill the full set',                      8,  '{"batch":3,"of":3}'),
  ('input',   6, 'exercise_set',     'Vocabulary set',
   'Nail the module''s lexis: MC cloze · collocation match · word formation', 17, '{"group_key":"vocab"}'),
  -- Session 3 · Workout — grammar under pressure
  ('workout', 1, 'review_slot',      'Review Slot',
   'Clear 10 items from the exercise re-queue',                               12, '{"count":10}'),
  ('workout', 2, 'theory',           'Grammar spotlight · part 2',
   'Master the remaining constructions — you drill them next',                15, '{"part":2,"of":2}'),
  ('workout', 3, 'exercise_set',     'Grammar drill · open cloze',
   'Apply both spotlight parts under pressure',                               20, '{"types":["grammar_drill","open_cloze"]}'),
  ('workout', 4, 'exercise_set',     'Transformations · error correction',
   'Beat the exam formats and your typical L1 errors',                        18, '{"types":["key_word_transformation","error_correction"]}'),
  ('workout', 5, 'harvest',          'Harvest errors',
   'Turn every mistake into a flashcard and an error-map entry',              10, '{}'),
  -- Session 4 · Output — production and closing
  ('output',  1, 'reading',          'Extra text',
   'Read the module''s second genre — fuel for the production task',          12, '{"reading_kind":"extra","mode":"close"}'),
  ('output',  2, 'production',       'Writing / speaking task',
   'Put the module''s grammar and lexis to work in the CAE-genre task',       30, '{}'),
  ('output',  3, 'self_check',       'Model answer & checklist',
   'Compare with the model answer and tick the self-check list',              8,  '{}'),
  ('output',  4, 'module_quiz',      'Module quiz',
   'Score 10 review-pool items — module Completed, reviews at +7 and +21 days',
                                                                              10, '{"count":10,"pool":"review"}')
) as v(stype, position, kind, title, detail, minutes, config)
  on v.stype = s.session_type::text;

commit;
