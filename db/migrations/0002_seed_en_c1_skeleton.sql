-- 0002_seed_en_c1_skeleton.sql — course skeleton for English B2+ → C1.
-- Course, blocks A–D, modules m01–m15, five checkpoints (diagnostic, A–C, final mock)
-- and the fixed weekly protocol: 4 study sessions × steps for every module.
-- Module content (texts, vocabulary, exercises, flashcards, writing tasks, goals)
-- is NOT seeded here — it arrives via the content sync from content/en-c1/.

begin;

insert into course (slug, language, name, level_label, position)
values ('en-c1', 'en', 'English', 'B2+ → C1', 1);

insert into block (course_id, slug, name, color, tint, position)
select c.id, v.slug, v.name, v.color, v.tint, v.position
from course c,
     (values
       ('a', 'Consolidate', '#2E7FC7', '#E8F0F8', 1),
       ('b', 'Expand',      '#3D63CE', '#E9EDFA', 2),
       ('c', 'Refine',      '#5A4AC8', '#ECEAF9', 3),
       ('d', 'Command',     '#7C3FB5', '#F2EAF8', 4)
     ) as v(slug, name, color, tint, position)
where c.slug = 'en-c1';

insert into module (block_id, slug, title, standfirst, position, planned_minutes)
select b.id, v.slug, v.title, v.standfirst, v.position, 270
from (values
  ('a', 'm01', 1, 'Work & Careers',
   'Narrative tenses, perfect aspect and future forms for career stories · 45 lexemes with use cases · a formal application email.'),
  ('a', 'm02', 2, 'Science & Technology',
   'Advanced passives and causatives for science writing · 45 lexemes · a recorded monologue.'),
  ('a', 'm03', 3, 'Media & Communication',
   'Reporting verbs and their patterns · 45 lexemes · an opinion article.'),
  ('a', 'm04', 4, 'Education & Learning',
   'Gerund vs infinitive pairs that change meaning · 45 lexemes · a recorded monologue.'),
  ('b', 'm05', 1, 'Environment & Sustainability',
   'Mixed and inverted conditionals · 45 lexemes · CAE essay #1.'),
  ('b', 'm06', 2, 'Society & Inequality',
   'Unreal past and the subjunctive · 45 lexemes · a recorded monologue.'),
  ('b', 'm07', 3, 'Health & Psychology',
   'Modality: speculation and degrees of certainty · 45 lexemes · an informal email.'),
  ('b', 'm08', 4, 'Globalisation & Travel',
   'Advanced relative and participle clauses · 45 lexemes · a recorded monologue.'),
  ('c', 'm09', 1, 'Culture & Arts',
   'Cleft sentences, fronting and emphasis · 45 lexemes · a review.'),
  ('c', 'm10', 2, 'Crime & Justice',
   'Inversion after negative adverbials · 45 lexemes · a recorded monologue.'),
  ('c', 'm11', 3, 'Business & Economy',
   'Nominalisation and formal register · 45 lexemes · a report.'),
  ('c', 'm12', 4, 'Language & Identity',
   'Ellipsis, substitution and discourse markers · 45 lexemes · a recorded monologue.'),
  ('d', 'm13', 1, 'Ethics & AI',
   'Hedging and concession for balanced argument · 45 lexemes · timed CAE essay #2.'),
  ('d', 'm14', 2, 'Consumer Society',
   'Dependent prepositions, comparison and quantifiers · 45 lexemes · a recorded monologue.'),
  ('d', 'm15', 3, 'Global Challenges',
   'Sentence architecture and cohesion for long-form writing · 45 lexemes · a proposal.')
) as v(block_slug, slug, position, title, standfirst)
join block b on b.slug = v.block_slug
join course c on c.id = b.course_id and c.slug = 'en-c1';

insert into checkpoint (course_id, block_id, kind, slug, title, pass_mark, planned_minutes, position)
select c.id,
       case when v.block_slug is null then null else b.id end,
       v.kind::checkpoint_kind, v.slug, v.title, v.pass_mark, v.minutes, v.position
from (values
  (null, 'diagnostic', 'diagnostic',
   'Diagnostic · 60 Use of English items + essay + monologue', null, 120, 0),
  ('a',  'block', 'cp-a', 'Checkpoint A · modules 1–4',  75, 120, 1),
  ('b',  'block', 'cp-b', 'Checkpoint B · modules 5–8',  75, 120, 2),
  ('c',  'block', 'cp-c', 'Checkpoint C · modules 9–12', 75, 120, 3),
  ('d',  'final', 'final',
   'Final mock · CAE Reading & Use of English + Writing', 65, 270, 4)
) as v(block_slug, kind, slug, title, pass_mark, minutes, position)
join course c on c.slug = 'en-c1'
left join block b on b.course_id = c.id and b.slug = v.block_slug
where v.block_slug is null or b.id is not null;

-- ---------------------------------------------------------- weekly protocol

insert into study_session (module_id, session_type, position, title, planned_minutes)
select m.id, v.stype::session_type, v.position, v.title, v.minutes
from module m
join block b  on b.id = m.block_id
join course c on c.id = b.course_id and c.slug = 'en-c1'
cross join (values
  ('prime',   1, 'Prime',   60),
  ('input',   2, 'Input',   75),
  ('workout', 3, 'Workout', 75),
  ('output',  4, 'Output',  60)
) as v(stype, position, title, minutes);

insert into session_step (study_session_id, position, kind, title, detail, planned_minutes, config)
select s.id, v.position, v.kind::step_kind, v.title, v.detail, v.minutes, v.config::jsonb
from study_session s
join module m on m.id = s.module_id
join block b  on b.id = m.block_id
join course c on c.id = b.course_id and c.slug = 'en-c1'
join (values
  -- Session 1 · Prime — enter the topic
  ('prime',   1, 'opener',           'Unit opener',
   'Goals and can-do statements for the week',                        5,  '{}'),
  ('prime',   2, 'reading',          'Skim the long-read',
   'No dictionary — gist only',                                       10, '{"reading_kind":"main","mode":"skim"}'),
  ('prime',   3, 'theory',           'Grammar spotlight',
   'Rules, examples and Watch out! boxes',                            25, '{}'),
  ('prime',   4, 'vocab',            'Vocabulary studio',
   '45 lexemes with use cases — mark 10 priority items',              15, '{"count":45}'),
  ('prime',   5, 'flashcards_intro', 'New cards into rotation',
   'Module decks join the daily review queue',                        5,  '{}'),
  -- Session 2 · Input — deep reading
  ('input',   1, 'review_slot',      'Review Slot',
   '10 items from the exercise re-queue',                             12, '{"count":10}'),
  ('input',   2, 'reading',          'Close reading with glosses',
   'Mark target constructions in the long-read',                      25, '{"reading_kind":"main","mode":"close"}'),
  ('input',   3, 'exercise_set',     'Check the reading',
   'Reading comprehension',                                           10, '{"types":["reading_comprehension"]}'),
  ('input',   4, 'exercise_set',     'Vocabulary set',
   'MC cloze · collocation match · word formation',                   28, '{"group_key":"vocab"}'),
  -- Session 3 · Workout — grammar
  ('workout', 1, 'review_slot',      'Review Slot',
   '10 items from the exercise re-queue',                             12, '{"count":10}'),
  ('workout', 2, 'exercise_set',     'Grammar drill · open cloze',
   'Target constructions under pressure',                             25, '{"types":["grammar_drill","open_cloze"]}'),
  ('workout', 3, 'exercise_set',     'Transformations · error correction',
   'Key-word transformations and typical L1-interference errors',     25, '{"types":["key_word_transformation","error_correction"]}'),
  ('workout', 4, 'harvest',          'Harvest errors',
   'Every mistake becomes a flashcard and an error-map entry',        13, '{}'),
  -- Session 4 · Output — production and closing
  ('output',  1, 'reading',          'Extra text',
   'Second genre of the module',                                      12, '{"reading_kind":"extra"}'),
  ('output',  2, 'production',       'Writing / speaking task',
   'CAE genre (odd modules) or recorded monologue (even modules)',    30, '{}'),
  ('output',  3, 'self_check',       'Model answer & checklist',
   'Compare and tick the self-check list',                            8,  '{}'),
  ('output',  4, 'module_quiz',      'Module quiz',
   '10 items from the review pool → module Completed, reviews scheduled at +7 and +21 days',
                                                                      10, '{"count":10,"pool":"review"}')
) as v(stype, position, kind, title, detail, minutes, config)
  on v.stype = s.session_type::text;

commit;
