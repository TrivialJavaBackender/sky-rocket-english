# Контент-пакет модуля — схема

Родовая схема, одинаковая для всех курсов. Каждый модуль — самодостаточный пакет в `courses/<slug>/content/module-{NN}/`. Пакеты синкаются в Neon идемпотентно по `content_hash`. Правило: **внутри файлов пакета нет ни слова на языке-посреднике** — весь контент на целевом языке курса, graded под его уровень.

Объёмы (сколько лексем, сколько заданий каждого типа, лимит теории) схемой не задаются — их объявляет «Профиль модуля» в `courses/<slug>/PLAN.md`, см. `docs/COURSE-DESIGN-GUIDE.md` §12. Примеры ниже английские, потому что взяты из en-c1; на схему это не влияет.

```
courses/<slug>/
  course.yaml            # → course + block + module + checkpoint + study_session + session_step
  content/
    module-01/
      meta.yaml          # → module: title, standfirst, goals[], grammar_points[]
      vocab.yaml         # → vocab_entry (+ 2 flashcard на запись — деривация)
      theory.yaml        # → grammar_spotlight + watchout + cloze_cards (→ exercise open_cloze, review-пул)
      text-main.yaml     # → reading_text(kind=main) + gloss
      text-extra.yaml    # → reading_text(kind=extra) + gloss
      exercises.yaml     # → exercise: core + review_pool (+ производные из theory.cloze_cards)
      writing.yaml       # → writing_task
    checkpoint-a/        # пакеты чек-пойнтов: exercises.yaml + writing.yaml
    diagnostic/          # диагностика: exercises.yaml + writing.yaml
```

Флеш-карточки не имеют отдельных файлов: sync деривирует таблицу `flashcard` из YAML-источников пакета (см. раздел «Флеш-карточки» ниже). Отдельные Anki-CSV отменены — карточки живут только в webapp-SRS.

## course.yaml — скелет курса

Карта курса до того, как написан контент: блоки, модули, чек-пойнты и недельный протокол. Sync апсертит её по натуральным ключам, поэтому новый курс не требует ни миграции, ни правок приложения — только строка в `COURSE_ROOTS` (`web/content.config.ts`).

```yaml
slug: de-a2
language: de                 # выбирает списки служебных слов content-gap-words/<lang>.ts
name: Deutsch
level_label: A1 → A2
position: 2
blocks:
  - slug: a
    name: Basis
    color: '#C9622E'
    tint: '#FAEDE6'
    modules:
      - { slug: m01, dir: module-01, title: Ich und du, standfirst: '…' }
checkpoints:
  - { slug: diagnostic, kind: diagnostic, dir: diagnostic, title: '…', pass_mark: null, planned_minutes: 60 }
  - { slug: cp-a, kind: block, block: a, dir: checkpoint-a, title: '…', pass_mark: 75, planned_minutes: 75 }
protocol:                    # применяется к каждому модулю курса
  - type: prime              # prime | input | workout | output
    title: Start
    planned_minutes: 55
    steps:
      - { kind: theory, title: 'Grammatik im Fokus · Teil 1', detail: '…', minutes: 16, config: { part: 1, of: 2 } }
```

Позиции берутся из порядка в массивах, а `planned_minutes` модуля — из суммы минут сессий протокола: дублировать числа значит позволить им разойтись. `title`/`standfirst` модуля здесь — карта до появления контента; `meta.yaml` перезаписывает их при синке пакета.

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
        example: She has led three product teams.       # example ИЛИ table — минимум одно
        note: Completed experience that matters now — the CV tense.
      - form: "Regelmäßige Verben: Stamm + Endung"      # парадигма → таблица, не цепочка через точку
        note: Der Stamm bleibt gleich. Nur die Endung wechselt.
        table:                                          # число ячеек в строке = числу headers
          headers: ["", "lernen", "wohnen"]
          rows:
            - ["ich", "lerne", "wohne"]
            - ["du", "lernst", "wohnst"]
watchouts:
  - title: since + present perfect
    bad: I am working here since 2019.
    good: I have been working here since 2019.
    note: A past starting point needs the perfect to reach the present.
cloze_cards:                           # 10 шт. → exercise(open_cloze, pool=review)
  - text: "She {{c1::has been working}} here since 2019 — and she still loves it."
    hint: work                         # обязательно — базовая форма ответа
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
core:                                  # разбивка по типам — из «Профиля модуля» курса.
                                       # en-c1: 8 mc_cloze · 8 open_cloze · 8 word_formation ·
                                       #   8 key_word_transformation · 10 grammar_drill ·
                                       #   8 error_correction · 10 collocation_match · 6 reading_comprehension = 66
                                       # de-a2: 6 · 8 · 6 · 4 · 8 · 6 · 8 · 6 = 52
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
review_pool: []                        # смешанные короткие задания той же формы; объём — из профиля
```

#### Правило восстановимости пропуска (open_cloze)

Пропуск честен, только если ответ **восстанавливается из предложения**. Иначе это угадайка: «He denied ▁▁▁ anything about the missing files» одинаково допускает *knowing*, *taking*, *hearing*, *saying*.

| Что в пропуске | Подсказка | Пример |
|---|---|---|
| Служебное слово (предлог, союз, артикль, вспомогательный, модальный, местоимение, частица) | не нужна — грамматика вынуждает ответ | `All complaints are dealt ▁▁▁ by an ombudsman.` → `with` |
| Знаменательное слово в устойчивой рамке | не нужна — рамку задаёт окружение | `It is well ▁▁▁ revisiting.` → `worth` |
| Класс задан грамматикой, слово — нет | не нужна, но `answers` перечисляет **весь** класс (≥4) | `It is ▁▁▁ that every child have…` → essential, vital, imperative, crucial, important, necessary |
| Знаменательное слово, выбранное лексически | **`hint` обязателен** — словарная базовая форма | `He denied ▁▁▁ anything…` → `hint: know` |

```yaml
  - type: open_cloze
    group: reading
    content:
      pre: "He denied "
      post: " anything about the missing files."
      hint: know                       # ← базовая форма, рендерится чипом над строкой
      answers: [knowing]
      answer_shown: knowing
```

Подсказка — это **базовая форма ответа**, а не название части речи: писать `preposition`/`auxiliary` не нужно. Служебные пропуски идут без подсказки намеренно — в en-c1 это формат CAE Reading & Use of English Part 2 (`courses/en-c1/PLAN.md` §6), и ослаблять его метками класса нельзя.

**Правило языко-зависимо.** Что именно вынуждено грамматикой, решает язык курса: `makeOpenClozeContentSchema(language)` (`web/lib/content-schema.ts`) валит sync, если знаменательный ответ идёт без `hint` и без полного набора `answers`. Списки служебных слов и устойчивых рамок — `web/lib/content-gap-words/<lang>.ts`, язык берётся из `course.yaml`; новая рамка добавляется туда, и добавление — это утверждение, что контекст её вынуждает. Языка без своего файла sync не пропустит.

Флективные языки ложатся на этот формат лучше аналитических: в немецком пропуск на артикле или предлоге однозначно задан падежом (`Ich fahre ▁▁▁ dem Bus` → только `mit`, `Ich sehe ▁▁▁ Mann` → только `den`), поэтому в de-a2 `open_cloze` несёт основную нагрузку по грамматике.

Отдельно: `answers` должен содержать **все** валидные варианты. `were not ▁▁▁ to use dictionaries` без `supposed`, `It is ▁▁▁ that every child have` без `important` и `necessary` — это не строгость, а ложные ошибки в грейдинге.

### writing.yaml → `writing_task`
```yaml
mode: writing                          # writing | speaking
genre: formal application email
word_target: [220, 260]                # опционально; у speaking его не бывает
prompt: |
  You have seen this advertisement…
model_answer: |
  Dear Ms Carter, …
checklist:
  - Opens and closes in a consistently formal register
  - 220–260 words
```

### Флеш-карточки → `flashcard` (деривация, отдельных файлов нет)
Колода — **только лексика**, по две карточки на каждую запись `vocab.yaml`:
- `note_type=vocab` — узнавание: front=term, back=definition + первые 2 use cases + collocations + register.
- `note_type=vocab_reverse` — воспроизведение: front=definition, back=term + те же use cases. Use cases держатся на обороте: они содержат термин.

Заданий в колоде нет (решение 2026-07, миграция `0005`): `cloze_cards` из `theory.yaml` синкаются как упражнения `open_cloze` в review-пул модуля — `{{c1::X}}` разбирается в `{pre, post, answers:[X]}`, `hint` становится подсказкой-основой, `rule` — разбором. Трансформации и так лежат в `exercises.yaml`. Промах по любому из них возвращает **само задание** через очередь повторений (+2/+7/+21 д), а не карточку.

Теги: `{course_slug}::m{NN}` (префикс ident'а — карточки не коллидируют ни между модулями, ни между курсами).

## Аудио — `courses/<slug>/audio/manifest.json` (деривация, отдельных полей в пакете нет)

Курсы с `language: de` озвучивают фиксированный список полей, а не весь текст модуля целиком:

| Источник | Поле | Где играет |
|---|---|---|
| `vocab.yaml` | `term` | `VocabStudio` → /module и /session (шаг `vocab`) |
| `vocab.yaml` | каждый `use_cases[]` | там же |
| `theory.yaml` | `spotlights[].items[].example` | `GrammarSpotlight` → /module и /session (шаг `theory`) |
| `theory.yaml` | `watchouts[].good` | `WatchoutBox`, только строка ✓ |
| `text-main.yaml` / `text-extra.yaml` | абзацы `body[]`, склеенные в plain text — один клип на абзац (`READING_CLIP_GRANULARITY`, `ARCHITECTURE.md` §8 D15) | `ReadingText` → /module и /session (шаг `reading`) |

**Сознательно не озвучиваются:** `watchouts[].bad` — это заведомо неправильный немецкий, услышанный голосом диктора он читается как образец, а не как предостережение; содержимое `exercises.yaml` — аудио выдало бы ответ на задание. Глоссы, коллокации и флешкарты — вне текущей итерации; экстрактор (`web/scripts/audio.ts`) устроен так, что добавить источник — значит дописать один сборщик фраз в фазе `plan`, а не менять схему пакета.

**Манифест и блобы.** `courses/<slug>/audio/manifest.json` коммитится в репозиторий: список клипов с нормализованным текстом, его `text_hash`, списком `refs` (откуда взята фраза — для отладки и отчёта покрытия, синком не читается) и путём до блоба на профиль (`normal` — единственный сейчас). Сами `.opus`-файлы лежат в `web/public/audio/<lang>/<xx>/<key>.opus` и тоже коммитятся, отдаются как обычная статика. `pnpm sync` читает манифест и заливает таблицу `audio_clip`; сам sync никогда не обращается к TTS — генерация («plan → synth → import», `pnpm audio`) и синк — два независимых шага. Подробности пайплайна и адресации по тексту — `docs/ARCHITECTURE.md` §4.8 и решение D15.

**После правки любого озвученного текста нужен `pnpm audio`.** Клип ищется по `sha256(normalizeAudioText(text))` — правка `term`, `use_cases[]`, `spotlights[].items[].example`, `watchouts[].good` или любого предложения внутри абзаца текста меняет хеш строки, старый клип просто перестаёт находиться. Кнопка ▶ исчезает до следующего прогона `pnpm audio -- --course <slug>` + `pnpm sync` — она никогда не продолжает играть старую озвучку под новым текстом (в этом весь смысл адресации по тексту, а не по позиции).

**Замена референсного голоса в `tts-mcp` — это регенерация всего аудио курса.** `voice_id` (в `tts-mcp` — `"chatterbox-mtl-de-" + sha1(байты assets/reference_de.wav)[:10]`) входит в собственный ключ `tts-mcp`, а значит и в путь каждого блоба. Замена `assets/reference_de.wav` меняет `voice_id` → у всех фраз курса меняется путь блоба, ближайший `pnpm audio` пересинтезирует их заново под новым голосом (старые файлы останутся на диске под старыми ключами до прунинга). Референсный файл — не то, что трогают по ходу работы над контентом.

Шаблон ТЗ на генерацию модуля и Definition of Done: `docs/MODULE-TASK-TEMPLATE.md` · как выводятся объёмы профиля: `docs/COURSE-DESIGN-GUIDE.md`.
