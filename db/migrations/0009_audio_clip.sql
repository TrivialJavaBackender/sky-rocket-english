-- 0009 · audio_clip: content-addressed TTS output (courses/<slug>/audio/manifest.json).
--
-- Course audio (docs/ARCHITECTURE.md §4.8) is generated offline by tts-mcp and
-- synced from a committed manifest — Netlify never runs TTS (no GPU on the
-- build). The row's natural key is (lang, text_hash, profile), a sha256 of
-- normalizeAudioText(text), not a (module_id, position) pointer — for the same
-- reason content tables already carry a content_hash gate instead of trusting
-- position: a positional key would keep silently serving the *old* clip the
-- moment a sentence is edited or the paragraph reordered, because the row
-- would still sit at that slot. Keying by the text itself fails safe instead —
-- editing a sentence changes its hash, the old row simply stops being looked
-- up, the ▶ button disappears until the next `pnpm audio`, and nothing ever
-- plays stale pronunciation under a fresh sentence.
--
-- `clip_key` and `path` are tts-mcp's own content-addressed identity (sha256 of
-- engine+voice+profile+profile_version+text, see tts-mcp's core/keys.py) —
-- carried through verbatim so this app never reimplements that formula. The
-- app only ever looks things up by its own `text_hash`; `clip_key`/`path` are
-- just where the answer points.
--
-- `profile` stays a column even though exactly one profile (`normal`) exists
-- today: tts-mcp's manifest already carries a profile per clip at no cost, the
-- (lang, text_hash, profile) key falls out of that for free, and dropping the
-- column now would mean widening the unique key again the day a second
-- profile (e.g. `slow`) ships. The one-profile rule is enforced above the DB,
-- in lib/audio/config.ts's AUDIO_PROFILE constant — there is no profile picker
-- in the UI — so adding a profile later is additive, not a migration.
--
-- Clips are not owned by a course: two German courses saying the same sentence
-- share one row, because the key is (lang, text_hash, profile). scripts/sync.ts
-- prunes this table globally per language for the same reason, not per course.

begin;

create table if not exists audio_clip (
  id            bigserial primary key,
  lang          text     not null,
  text_hash     char(64) not null,   -- sha256(normalizeAudioText(text)) — the lookup key the app uses
  profile       text     not null,   -- always 'normal' today; see header
  clip_key      char(64) not null,   -- tts-mcp's own content_key (the blob's filename)
  path          text     not null,   -- '/audio/de/a3/<key>.opus' — served straight from web/public
  duration_ms   integer  not null,
  bytes         integer  not null,
  voice         text     not null,
  source_text   text     not null,   -- normalized original text: coverage reports and debugging
  unique (lang, text_hash, profile)
);
create index if not exists audio_clip_lookup_idx on audio_clip (lang, text_hash);

comment on column audio_clip.text_hash is
  'sha256(normalizeAudioText(text)) — how the app asks "is there a clip for this string", independent of tts-mcp''s own key formula.';
comment on column audio_clip.clip_key is
  'tts-mcp content_key (engine+voice+profile+profile_version+text) — the blob''s filename on disk; this app never recomputes it.';
comment on column audio_clip.profile is
  'Always ''normal'' today (lib/audio/config.ts AUDIO_PROFILE, no UI picker) — kept as a column because it is free from tts-mcp''s manifest and widening the unique key later would be worse than carrying it now.';

-- Gate hash over courses/<slug>/audio/manifest.json, mirroring course.skeleton_hash
-- (0006): a matching hash lets scripts/sync.ts skip a course's audio in 0 queries.
alter table course add column if not exists audio_manifest_hash text;

commit;
