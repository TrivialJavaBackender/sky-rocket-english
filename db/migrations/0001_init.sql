-- 0001_init.sql — SkyRocket: course engine schema (Neon / PostgreSQL 15+)
-- Course structure, module content, weekly session protocol, users,
-- and the three repetition lanes (flashcard SRS, exercise re-queue, module reviews).
-- Content tables carry content_hash for idempotent sync from content/<course>/.
-- Apply: psql "$DATABASE_URL" -f db/migrations/0001_init.sql

begin;

-- ============================================================ enums

create type checkpoint_kind  as enum ('diagnostic','block','final');
create type reading_kind     as enum ('main','extra');
create type exercise_pool    as enum ('core','review');
create type exercise_group   as enum ('grammar','reading','vocab');
create type task_mode        as enum ('writing','speaking');
create type note_type        as enum ('vocab','grammar_cloze','transformation');
create type flashcard_source as enum ('content','error_harvest','gloss','manual');
create type session_type     as enum ('prime','input','workout','output');
create type step_kind        as enum ('opener','theory','reading','vocab','exercise_set',
                                      'review_slot','harvest','production','self_check',
                                      'module_quiz','flashcards_intro');
create type module_status     as enum ('locked','upcoming','in_progress','completed','mastered');
create type checkpoint_status as enum ('locked','available','passed','failed');
create type progress_status   as enum ('not_started','in_progress','done');
create type attempt_context   as enum ('session','review_slot','module_quiz','module_review',
                                       'checkpoint','practice');
create type card_phase        as enum ('new','learning','review','relearning');
create type vocab_status      as enum ('new','learning','known','in_use');
create type grammar_status    as enum ('introduced','practising','reliable');
create type review_stage      as enum ('r7','r21');
create type error_source      as enum ('exercise','writing','manual');

-- ============================================================ users

create table app_user (
  id            bigint generated always as identity primary key,
  username      text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- ============================================================ course structure

create table course (
  id          bigint generated always as identity primary key,
  slug        text not null unique,          -- 'en-c1', 'de-a1'
  language    text not null,                 -- 'en', 'de'
  name        text not null,                 -- 'English'
  level_label text not null,                 -- 'B2+ → C1'
  position    int  not null default 1,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table block (
  id        bigint generated always as identity primary key,
  course_id bigint not null references course(id) on delete cascade,
  slug      text not null,                   -- 'a'..'d'
  name      text not null,                   -- 'Каркас' → seeded in English: 'Consolidate'…
  color     text not null,                   -- block accent, hex
  tint      text not null,                   -- block background tint, hex
  position  int  not null,
  unique (course_id, slug),
  unique (course_id, position)
);

create table module (
  id              bigint generated always as identity primary key,
  block_id        bigint not null references block(id) on delete cascade,
  slug            text not null,             -- 'm01'
  title           text not null,             -- 'Work & Careers'
  standfirst      text,                      -- unit subtitle line
  goals           jsonb not null default '[]',  -- ["can-do …", …]
  planned_minutes int  not null default 270,
  position        int  not null,
  content_hash    text,
  unique (block_id, slug),
  unique (block_id, position)
);

-- Gates: block checkpoints, the course diagnostic and the final mock.
-- Rendered as block footers on the course map (diagnostic: before block 1).
create table checkpoint (
  id              bigint generated always as identity primary key,
  course_id       bigint not null references course(id) on delete cascade,
  block_id        bigint references block(id) on delete cascade,
  kind            checkpoint_kind not null,
  slug            text not null,
  title           text not null,
  pass_mark       int,                       -- null for diagnostic (no gate)
  planned_minutes int not null default 120,
  position        int not null,
  content_hash    text,
  unique (course_id, slug),
  constraint checkpoint_block_by_kind check (
    (kind = 'diagnostic' and block_id is null)
    or (kind in ('block','final') and block_id is not null)
  )
);

-- ============================================================ module content

create table grammar_spotlight (
  id           bigint generated always as identity primary key,
  module_id    bigint not null references module(id) on delete cascade,
  title        text not null,
  intro        text,
  items        jsonb not null default '[]',  -- [{form, example, note}]
  position     int not null default 1,
  content_hash text,
  unique (module_id, position)
);

create table watchout (
  id           bigint generated always as identity primary key,
  module_id    bigint not null references module(id) on delete cascade,
  title        text not null,                -- 'since + present perfect'
  bad_example  text not null,
  good_example text not null,
  note         text,
  position     int not null default 1,
  content_hash text,
  unique (module_id, position)
);

-- Constructions of the module (for the Reliable ladder: 39/72 on the Progress screen).
create table grammar_point (
  id           bigint generated always as identity primary key,
  module_id    bigint not null references module(id) on delete cascade,
  title        text not null,
  position     int not null default 1,
  content_hash text,
  unique (module_id, title)
);

create table reading_text (
  id           bigint generated always as identity primary key,
  module_id    bigint not null references module(id) on delete cascade,
  kind         reading_kind not null,
  kicker       text,                         -- 'LONG-READ · PART B'
  title        text not null,
  meta         text,                         -- '≈ 6 min · dotted words carry glosses'
  body         jsonb not null,               -- [[{"t":"…"}|{"g":"gloss_key"}], …] paragraphs of segments
  word_count   int,
  position     int not null default 1,
  content_hash text,
  unique (module_id, kind, position)
);

-- Tap-to-reveal glosses inside reading texts; each is harvestable into the deck.
create table gloss (
  id              bigint generated always as identity primary key,
  reading_text_id bigint not null references reading_text(id) on delete cascade,
  key             text not null,             -- referenced from reading_text.body segments
  term            text not null,
  pos_label       text,                      -- 'idiom', 'verb · business register'
  definition      text not null,
  example         text,
  unique (reading_text_id, key)
);

create table vocab_entry (
  id            bigint generated always as identity primary key,
  module_id     bigint not null references module(id) on delete cascade,
  term          text not null,
  tag           text,                        -- badge: 'neutral', 'idiom · often ironic'
  definition    text not null,
  use_cases     jsonb not null default '[]', -- ["example 1", "example 2", …]
  collocations  text,
  register_note text,
  position      int not null,
  content_hash  text,
  unique (module_id, term)
);

create table exercise_type (
  code        text primary key,
  label       text not null,
  interaction text not null                  -- choice | text_input | word_tap | match
);

create table exercise (
  id               bigint generated always as identity primary key,
  module_id        bigint references module(id) on delete cascade,
  checkpoint_id    bigint references checkpoint(id) on delete cascade,
  type_code        text not null references exercise_type(code),
  pool             exercise_pool not null default 'core',   -- core 66 / review 30 per module
  group_key        exercise_group,                          -- unit launchers: grammar/reading/vocab
  grammar_point_id bigint references grammar_point(id) on delete set null,
  reading_text_id  bigint references reading_text(id) on delete set null,
  content          jsonb not null,           -- type-specific, shapes mirror the design player
  explanation      text not null,            -- English-only answer explanation
  position         int not null default 1,
  content_hash     text,
  constraint exercise_owner check ((module_id is null) <> (checkpoint_id is null))
);
create index exercise_module_idx     on exercise (module_id, pool);
create index exercise_checkpoint_idx on exercise (checkpoint_id);

create table writing_task (
  id              bigint generated always as identity primary key,
  module_id       bigint references module(id) on delete cascade,
  checkpoint_id   bigint references checkpoint(id) on delete cascade,
  mode            task_mode not null,
  genre           text not null,             -- 'formal application email', 'essay', 'proposal'…
  prompt_md       text not null,
  model_answer_md text,
  checklist       jsonb not null default '[]',
  position        int not null default 1,
  content_hash    text,
  constraint writing_task_owner check ((module_id is null) <> (checkpoint_id is null))
);

create table flashcard (
  id                 bigint generated always as identity primary key,
  module_id          bigint references module(id) on delete set null,
  note_type          note_type not null,
  fields             jsonb not null,         -- {front, main, cases: [], extra}
  source             flashcard_source not null default 'content',
  vocab_entry_id     bigint references vocab_entry(id) on delete set null,
  source_exercise_id bigint references exercise(id) on delete set null,
  source_gloss_id    bigint references gloss(id) on delete set null,
  created_by_user_id bigint references app_user(id) on delete set null,
  archived           boolean not null default false,
  content_hash       text,
  created_at         timestamptz not null default now()
);
create index flashcard_module_idx on flashcard (module_id);

-- ============================================================ weekly session protocol

create table study_session (
  id              bigint generated always as identity primary key,
  module_id       bigint not null references module(id) on delete cascade,
  session_type    session_type not null,
  position        int not null,              -- 1..4
  title           text not null,             -- 'Prime', 'Input', 'Workout', 'Output'
  planned_minutes int not null,
  unique (module_id, session_type),
  unique (module_id, position)
);

create table session_step (
  id               bigint generated always as identity primary key,
  study_session_id bigint not null references study_session(id) on delete cascade,
  position         int not null,
  kind             step_kind not null,
  title            text not null,
  detail           text,
  planned_minutes  int not null default 10,
  config           jsonb not null default '{}',  -- {"group_key":"vocab"} / {"reading_kind":"main"} / {"count":10}
  unique (study_session_id, position)
);

-- ============================================================ user progress

create table user_course (
  user_id    bigint not null references app_user(id) on delete cascade,
  course_id  bigint not null references course(id) on delete cascade,
  started_at timestamptz not null default now(),
  is_active  boolean not null default true,
  primary key (user_id, course_id)
);

create table user_module_state (
  user_id      bigint not null references app_user(id) on delete cascade,
  module_id    bigint not null references module(id) on delete cascade,
  status       module_status not null default 'locked',
  started_at   timestamptz,
  completed_at timestamptz,                  -- session 4 module quiz done
  quiz_score   numeric(5,2),
  mastered_at  timestamptz,                  -- both module reviews passed
  primary key (user_id, module_id)
);

create table user_checkpoint_state (
  user_id       bigint not null references app_user(id) on delete cascade,
  checkpoint_id bigint not null references checkpoint(id) on delete cascade,
  status        checkpoint_status not null default 'locked',
  best_score    numeric(5,2),
  taken_at      timestamptz,
  primary key (user_id, checkpoint_id)
);

create table user_session_state (
  user_id          bigint not null references app_user(id) on delete cascade,
  study_session_id bigint not null references study_session(id) on delete cascade,
  status           progress_status not null default 'not_started',
  started_at       timestamptz,
  completed_at     timestamptz,
  primary key (user_id, study_session_id)
);

create table user_step_state (
  user_id         bigint not null references app_user(id) on delete cascade,
  session_step_id bigint not null references session_step(id) on delete cascade,
  status          progress_status not null default 'not_started',
  completed_at    timestamptz,
  primary key (user_id, session_step_id)
);

create table exercise_attempt (
  id           bigint generated always as identity primary key,
  user_id      bigint not null references app_user(id) on delete cascade,
  exercise_id  bigint not null references exercise(id) on delete cascade,
  context      attempt_context not null,
  given_answer jsonb,
  is_correct   boolean not null,
  time_ms      int,
  answered_at  timestamptz not null default now()
);
create index attempt_user_time_idx on exercise_attempt (user_id, answered_at);
create index attempt_user_ex_idx   on exercise_attempt (user_id, exercise_id);

-- Lane 2: failed exercises return as fresh variants at +2 / +7 / +21 days.
create table review_queue_item (
  id                  bigint generated always as identity primary key,
  user_id             bigint not null references app_user(id) on delete cascade,
  exercise_id         bigint not null references exercise(id) on delete cascade,
  stage               smallint not null default 1 check (stage between 1 and 3),
  due_at              timestamptz not null,
  source_attempt_id   bigint references exercise_attempt(id) on delete set null,
  resolved_at         timestamptz,
  resolved_attempt_id bigint references exercise_attempt(id) on delete set null,
  created_at          timestamptz not null default now()
);
create unique index review_queue_open_uniq on review_queue_item (user_id, exercise_id)
  where resolved_at is null;
create index review_queue_due_idx on review_queue_item (user_id, due_at)
  where resolved_at is null;

-- Lane 3: +7-day and +21-day module quizzes; both ≥ pass promote the module to Mastered.
create table module_review (
  id        bigint generated always as identity primary key,
  user_id   bigint not null references app_user(id) on delete cascade,
  module_id bigint not null references module(id) on delete cascade,
  stage     review_stage not null,
  due_at    timestamptz not null,
  taken_at  timestamptz,
  score     numeric(5,2),
  passed    boolean,
  unique (user_id, module_id, stage)
);
create index module_review_due_idx on module_review (user_id, due_at)
  where taken_at is null;

-- Lane 1: per-card scheduling state. Algorithm-agnostic (SM-2 / FSRS both fit).
create table card_state (
  user_id          bigint not null references app_user(id) on delete cascade,
  flashcard_id     bigint not null references flashcard(id) on delete cascade,
  phase            card_phase not null default 'new',
  due_at           timestamptz not null default now(),
  interval_days    numeric(8,2) not null default 0,
  ease             numeric(5,2) not null default 2.5,
  reps             int not null default 0,
  lapses           int not null default 0,
  last_reviewed_at timestamptz,
  primary key (user_id, flashcard_id)
);
create index card_state_due_idx on card_state (user_id, due_at);

create table card_review_log (
  id           bigint generated always as identity primary key,
  user_id      bigint not null references app_user(id) on delete cascade,
  flashcard_id bigint not null references flashcard(id) on delete cascade,
  rating       smallint not null check (rating between 1 and 4),  -- Again/Hard/Good/Easy
  prev_phase   card_phase,
  new_due_at   timestamptz,
  reviewed_at  timestamptz not null default now()
);
create index card_log_user_time_idx on card_review_log (user_id, reviewed_at);

create table writing_submission (
  id              bigint generated always as identity primary key,
  user_id         bigint not null references app_user(id) on delete cascade,
  writing_task_id bigint not null references writing_task(id) on delete cascade,
  body_md         text not null,
  duration_min    int,
  self_check      jsonb,                     -- checklist ticks
  attachment_url  text,                      -- speaking recording
  submitted_at    timestamptz not null default now()
);
create index submission_user_idx on writing_submission (user_id, submitted_at);

create table user_vocab_state (
  user_id              bigint not null references app_user(id) on delete cascade,
  vocab_entry_id       bigint not null references vocab_entry(id) on delete cascade,
  status               vocab_status not null default 'new',
  in_use_submission_id bigint references writing_submission(id) on delete set null,
  updated_at           timestamptz not null default now(),
  primary key (user_id, vocab_entry_id)
);

create table user_grammar_state (
  user_id          bigint not null references app_user(id) on delete cascade,
  grammar_point_id bigint not null references grammar_point(id) on delete cascade,
  status           grammar_status not null default 'introduced',
  success_count    int not null default 0,
  updated_at       timestamptz not null default now(),
  primary key (user_id, grammar_point_id)
);

create table error_map_entry (
  id                   bigint generated always as identity primary key,
  user_id              bigint not null references app_user(id) on delete cascade,
  module_id            bigint references module(id) on delete set null,
  source               error_source not null,
  source_attempt_id    bigint references exercise_attempt(id) on delete set null,
  source_submission_id bigint references writing_submission(id) on delete set null,
  error_text           text not null,
  rule_note            text,
  flashcard_id         bigint references flashcard(id) on delete set null,
  created_at           timestamptz not null default now(),
  resolved_at          timestamptz
);
create index error_map_user_idx on error_map_entry (user_id, created_at);

-- Streak and heatmap without heavy aggregate queries; app upserts one row per active day.
create table daily_activity (
  user_id        bigint not null references app_user(id) on delete cascade,
  activity_date  date not null,
  exercises_done int not null default 0,
  cards_reviewed int not null default 0,
  minutes        int not null default 0,
  primary key (user_id, activity_date)
);

-- ============================================================ reference seed

insert into exercise_type (code, label, interaction) values
  ('mc_cloze',                'Multiple-choice cloze',    'choice'),
  ('open_cloze',              'Open cloze',               'text_input'),
  ('word_formation',          'Word formation',           'text_input'),
  ('key_word_transformation', 'Key-word transformation',  'text_input'),
  ('grammar_drill',           'Grammar drill',            'choice'),
  ('error_correction',        'Error correction',         'word_tap'),
  ('collocation_match',       'Collocation match',        'match'),
  ('reading_comprehension',   'Reading comprehension',    'choice');

commit;
