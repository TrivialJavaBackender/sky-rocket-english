# SkyRocket — Design Brief

> Бриф, по которому создан утверждённый дизайн (файлы: `docs/design/skyrocket/`,
> исходная ссылка: https://claude.ai/design/p/9177ce3b-33e3-4547-a17b-5d1ffcae6e6a).
> `content.js` в папке дизайна — образцовые формы данных всех экранов; схема БД (`docs/DATA-MODEL.md`) следует им.

```text
Design brief — SkyRocket: a self-study language platform with a coursebook soul

CONTEXT
Personal web app for one adult learner (a software engineer). Stack: Next.js +
Prisma + Neon Postgres on Netlify; mobile-first PWA; later the same deploy gets
wrapped as a Telegram Mini App (daily-review reminders via bot). The engine is
course-agnostic: the first course is English B2+ → C1 (16 modules in 4 blocks
plus checkpoints); a German course will reuse the same engine. UI and all
learning content are 100% English. Content ships as typed data per module
(YAML/CSV); the app renders it.

THE PRODUCT IS A SYSTEM, NOT A LIBRARY
Core loop: one module = one week = 4 fixed sessions (Prime 60', Input 75',
Workout 75', Output 60') + daily 10–15' of flashcards. Three repetition lanes
the UI must make tangible:
1) flashcard SRS — vocab (use cases on the back), grammar cloze, transformations;
2) exercise re-queue — failed items return at 2/7/21 days; sessions 2–3 open
   with a 10-item Review Slot taken from this queue;
3) module reviews — quizzes at +7 and +21 days after finishing a module;
   both at 80%+ promote the module to Mastered.
Item states: lexeme New → Learning → Known → In use; construction Introduced →
Practising → Reliable; module In progress → Completed → Mastered; block
checkpoints are gates (75%+). Every mistake is harvested into a flashcard —
make error harvesting a first-class, one-tap flow.

SCREENS
1. Today — answers "what do I do right now": current session with its step
   plan, review queue size, cards due, streak; one primary call to action.
2. Course map — blocks, modules, checkpoints and their states.
3. Module unit — the coursebook experience (see below).
4. Exercise player — 8 typed interactions: multiple-choice cloze, open cloze,
   word formation, key-word transformation, grammar drill, error correction,
   collocation match, reading comprehension. Instant check, English
   explanations, harvest-on-error.
5. Review hub — the three lanes, what is due and what is overdue.
6. Flashcard player — three note types, use cases shown on the back.
7. Writing / speaking flow — task, timer, submit, model-answer reveal,
   self-check checklist.
8. Progress — course map plus % lexis Known+, constructions Reliable,
   retention, streak.
9. Course switcher and settings (multi-course from day one).

THE COURSEBOOK FEEL — the heart of this brief
A module page should read like a beautifully typeset modern coursebook unit,
not a feed: unit opener with goals; Grammar Spotlight panels; the long-read
with tap-to-reveal glosses on target items; vocabulary boxes that always show
use cases (2–3 example sentences, collocations, register notes); "Watch out!"
error boxes; exercises interleaved right after the input they practise;
a closing unit-review page. Reading typography is first-class on a phone;
interactive elements clearly look interactive.

CONSTRAINTS
Mobile-first, comfortable one-handed; light and dark themes; a quiet, adult,
print-inspired aesthetic (Cambridge coursebook meets modern editorial web);
no childish gamification — progress reads as craft and mastery, not confetti;
color-code the four course blocks; tabular numerals for all stats; reading
views tolerate flaky connectivity.

DELIVERABLES
1. Information architecture and navigation model.
2. Design tokens (color, type, spacing) for both themes.
3. A high-fidelity interactive HTML mockup (phone + desktop) covering: Today,
   Course map, Module unit, Exercise player with at least 4 exercise types
   working, Flashcard player, Progress.
4. Interaction spec per exercise type: input handling, validation states,
   explanation reveal, error-harvest affordance.
5. Empty and edge states: nothing due today, checkpoint locked, overdue
   reviews, course completed.
```
