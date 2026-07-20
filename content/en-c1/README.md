# Контент-пакет модуля — схема (курс en-c1)

Каждый модуль — самодостаточный пакет в `content/en-c1/module-{NN}/`. Пакеты синкаются в Neon идемпотентно по `content_hash` (паттерн `scripts/sync.ts` из interview-prep). Правило: **внутри файлов пакета нет ни слова по-русски** — весь контент graded English (learner's dictionary style). Новый язык = новый корень (`content/de-a1/`) с той же схемой.

```
content/en-c1/
  module-01/
    meta.yaml            # → module: title, standfirst, goals[], grammar_points[]
    vocab.yaml           # → vocab_entry: 45 записей (+ 2 flashcard на запись — деривация)
    theory.yaml          # → grammar_spotlight + watchout + cloze_cards (→ exercise open_cloze, review-пул)
    text-main.yaml       # → reading_text(kind=main) + gloss
    text-extra.yaml      # → reading_text(kind=extra) + gloss
    exercises.yaml       # → exercise: core 66 + review_pool 30 (+10 из theory.cloze_cards)
    writing.yaml         # → writing_task
  checkpoint-a/          # пакеты чек-пойнтов: exercises.yaml (40) + writing.yaml
  diagnostic/            # 60 заданий + writing.yaml
```

Флеш-карточки не имеют отдельных файлов: sync деривирует таблицу `flashcard` из YAML-источников пакета (см. раздел «Флеш-карточки» ниже). Отдельные Anki-CSV отменены — карточки живут только в webapp-SRS.

## Форматы файлов

### meta.yaml
```yaml
slug: m01
title: Work & Careers
standfirst: Narrative tenses, perfect aspect and future forms for career stories · 45 lexemes · a formal application email.
goals:                     # каждая цель привязана к сессии, которая её закрывает (achieved_by:
                           # prime | input | workout | output) — на странице модуля цели загораются
                           # по мере прохождения сессий. Голая строка тоже валидна (= output).
  - text: Use narrative tenses confidently when telling a career story
    achieved_by: workout
  - text: Deploy 45 high-value career collocations in your own sentences
    achieved_by: input
  - text: Write a formal application email in the right register
    achieved_by: output
grammar_points:            # → grammar_point (статусы Reliable считаются по ним)
  - Narrative tenses and past habits (would / used to)
  - Perfect aspect: result vs activity
  - Future forms incl. future perfect (continuous)
  - Future in the past
```

### vocab.yaml → `vocab_entry`
```yaml
entries:
  - term: hand in your notice
    tag: neutral                       # badge: neutral | idiom | formal …
    definition: to formally tell your employer you are leaving
    use_cases:
      - She handed in her notice the day her visa cleared.
      - He had been threatening to hand it in for a year before he finally did.
    collocations: give in / work your notice · notice period
    register: "Formal: resign · Informal: quit"
```

### theory.yaml → `grammar_spotlight`, `watchout`, `flashcard(note_type=grammar_cloze)`
```yaml
spotlights:
  - title: The perfect aspect in career narratives
    intro: English connects past experience to the present with the perfect…
    items:
      - form: have + past participle
        example: She has led three product teams.
        note: Completed experience that matters now — the CV tense.
watchouts:
  - title: since + present perfect
    bad: I am working here since 2019.
    good: I have been working here since 2019.
    note: A past starting point needs the perfect to reach the present.
cloze_cards:                           # 10 шт. → exercise(open_cloze, pool=review)
  - text: "She {{c1::has been working}} here since 2019 — and she still loves it."
    hint: work                         # опционально
    rule: since + past starting point → present perfect; continuous for ongoing activity
```

### text-main.yaml / text-extra.yaml → `reading_text`, `gloss`
```yaml
kind: main                             # main | extra
kicker: LONG-READ
title: The Death of the Nine-to-Five
meta: ≈ 6 min · dotted words carry glosses — tap to reveal
word_count: 800
body:                                  # абзацы из сегментов; {g: key} — тап-глосса
  - - t: "For most of the twentieth century, a career was a ladder: you joined a firm, accumulated "
    - g: tenure
    - t: ", and climbed until you retired."
glosses:
  - key: tenure
    term: tenure
    pos_label: noun
    definition: the length of time you hold a position; also the secure form of it
    example: Professors with tenure cannot easily be dismissed.
```

### exercises.yaml → `exercise`
`content` — типоспецифичный, формы совпадают с плеером дизайна (`docs/design/skyrocket/content.js`, массив `exercises`).

```yaml
core:                                  # ровно: 8 mc_cloze · 8 open_cloze · 8 word_formation ·
                                       # 8 key_word_transformation · 10 grammar_drill ·
                                       # 8 error_correction · 10 collocation_match · 6 reading_comprehension
  - type: grammar_drill
    group: grammar                     # grammar | reading | vocab (лончеры юнита)
    grammar_point: Future in the past  # опционально → grammar_point
    content:
      pre: "By the time she turned thirty, she "
      post: " two startups."
      prompt: RUN
      options: [ran, has run, had run, had been running]
      answer: 2
    explanation: '"By the time + past" sets an earlier-past frame…'
  - type: error_correction
    group: grammar
    content: {words: [I, am, working, for, this, company, since, "2021."], wrong: 1, correction: "am → have been"}
    explanation: '"Since 2021" anchors the sentence to a past starting point…'
  - type: key_word_transformation
    group: grammar
    content: {s1: I started this job three years ago., key: BEEN, pre: "I have ", post: " three years.",
              answers: [been in this job for, been doing this job for], hint: 3–6 words, answer_shown: been in this job for}
    explanation: …
  - type: collocation_match
    group: vocab
    content: {left: [hand in, take on, meet, carve out], right: [a niche, your notice, a deadline, responsibility],
              pairs: {0: 1, 1: 3, 2: 2, 3: 0}}
    explanation: …
review_pool: []                        # 30 смешанных коротких заданий той же формы
```

### writing.yaml → `writing_task`
```yaml
mode: writing                          # writing | speaking
genre: formal application email
prompt: |
  You have seen this advertisement…
model_answer: |
  Dear Ms Carter, …
checklist:
  - Opens and closes in a consistently formal register
  - 220–260 words
```

### Флеш-карточки → `flashcard` (деривация, отдельных файлов нет)
Колода — **только лексика**, по две карточки на запись `vocab.yaml` (90 на модуль):
- `note_type=vocab` — узнавание: front=term, back=definition + первые 2 use cases + collocations + register.
- `note_type=vocab_reverse` — воспроизведение: front=definition, back=term + те же use cases. Use cases держатся на обороте: они содержат термин.

Заданий в колоде нет (решение 2026-07, миграция `0005`): `cloze_cards` из `theory.yaml` синкаются как упражнения `open_cloze` в review-пул модуля — `{{c1::X}}` разбирается в `{pre, post, answers:[X]}`, `hint` становится подсказкой-основой, `rule` — разбором. Трансформации и так лежат в `exercises.yaml`. Промах по любому из них возвращает **само задание** через очередь повторений (+2/+7/+21 д), а не карточку.

Теги: `en-c1::m{NN}` (префикс ident'а, между модулями карточки не коллидируют).

Шаблон ТЗ на генерацию модуля и Definition of Done: `docs/MODULE-TASK-TEMPLATE.md`.
