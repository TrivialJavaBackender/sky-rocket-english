# SkyRocket — архитектура веб-приложения

> **Назначение.** Канонический проектный документ, по которому три исполнителя реализуют приложение: **этап 2** — каркас `web/` + синк контента, **этап 3** — бэкенд (доменные модели, use cases, server actions, SSR-выборки), **этап 4** — фронтенд по утверждённому дизайну. Документ не содержит кода приложения — только контракты, решения и ТЗ.
>
> **Источники истины (в порядке приоритета при конфликте):**
> 1. Схема БД — raw SQL миграции `db/migrations/*.sql` (+ `docs/DATA-MODEL.md` как их описание).
> 2. Контент — пакеты `courses/<slug>/content/module-*/` и скелеты `courses/<slug>/course.yaml` (+ `docs/CONTENT-PACKAGE-SCHEMA.md` как схема).
> 3. План курса — `courses/<slug>/PLAN.md` (роадмап и профиль модуля); правила проектирования — `docs/COURSE-DESIGN-GUIDE.md`.
> 4. Дизайн — `docs/design/skyrocket/` (`content.js` — формы данных экранов, `Skyrocket.dc.html` — вёрстка и логика плеера упражнений/карточек).
> 5. Референс инженерии — `../concurrency/web` (Next.js 15 + Prisma + sync-скрипт + Netlify).
>
> Правило CLAUDE.md: **контент — только на целевом языке курса**; документы для пользователя (включая этот) — по-русски; идентификаторы кода — как есть.

---

## 0. Утверждённые рамки (не пересматриваются)

- **Стек:** Next.js 15 (App Router, SSR/RSC) + React 19, Server Actions вместо отдельного API-сервера. Деплой на Netlify через `@netlify/plugin-nextjs`. БД — Neon Postgres (прод) / Postgres 16 в Docker (локально).
- **Расположение:** приложение в каталоге `web/` этого репозитория; `netlify.toml` в корне репо с `base = "web"`.
- **Пользователь:** один, без регистрации/логина (захардкоженный `app_user`). Но все прогресс-таблицы уже несут `user_id` — весь код параметризуется `userId`, чтобы мультиюзер добавлялся без переписывания.
- **Контент vs прогресс:** контент-таблицы синкаются идемпотентно по `content_hash`; прогресс пользователя синк не трогает.
- **Миграции — source of truth схемы.** Prisma их **не** владеет (никакого `prisma migrate`).

---

## 1. Полный каталог use cases

Ниже — все пользовательские сценарии, выведенные из `PLAN.md` (§3 протокол, §4 три колеи), схемы БД и экранов мокапа. Формат: **триггер → шаги → таблицы (R=чтение, W=запись) → что рендерится**. Каждый use case реализуется как функция application-слоя (`lib/use-cases/*`), вызываемая либо из RSC-страницы (чтение), либо из server action (запись).

> Везде далее `U` = текущий `user_id` (сейчас константа, см. §2.7).

### 1.1. Обзор и навигация

**UC-01 · Dashboard / Today (главный экран).**
- Триггер: заход на `/` (или таб «Today»).
- Шаги: определить текущий модуль и сессию пользователя; собрать шаги сессии; посчитать «что горит сегодня» по трём колеям; показать стрик.
- R: `user_course`, `module` + `user_module_state` (найти `in_progress`), `study_session` + `user_session_state` (текущая сессия «N of 4»), `session_step` (+ `user_step_state`), `card_state` (due ≤ now — счётчик карточек), `review_queue_item` (open, due ≤ now — счётчик очереди), `module_review` (due ≤ now — квизы ревью), `daily_activity` (стрик).
- W: —.
- Рендер: карточка текущей сессии + кнопка «Continue Session N · {название активного шага}», плитки «cards due / queue due», список оставшихся шагов сессии (detail каждого шага = его микро-цель), баннер overdue (если бэклог), стрик. Формы — `SKY.today` в `content.js`. Крайние состояния: `session-due` / `nothing-due` / `overdue-reviews` (см. `todayState` в мокапе).

**UC-02 · Course map (карта курса).**
- Триггер: таб «Course» / `/course`.
- Шаги: собрать дерево `course → block → module` со статусами модулей и футерами-чек-пойнтами.
- R: `block`, `module` + `user_module_state`, `checkpoint` + `user_checkpoint_state`, `course.level_label`.
- W: —.
- Рендер: 4 блока (цвет/tint из `block`), в каждом — модули с бейджем статуса (`Locked/Upcoming/In progress/Completed/Mastered`), футер блока = чек-пойнт (`passed · 86%` / `Locked — hint`). Формы — `SKY.blocks`. Тап по открытому модулю → UC-05.

**UC-03 · Переключение курса.**
- Триггер: меню курс-свитчера в шапке.
- Шаги: сменить активный `user_course.is_active`; перегрузить дерево для другого курса.
- R: `course` (все активные), `user_course`.
- W: `user_course.is_active`.
- Рендер: обновлённая карта/Today для выбранного курса. Пока курс один (`en-c1`) — свитчер показывает «German · A2 → B1» как заглушку (`SKY.course.other`), фактическое переключение включится со вторым курсом.

**UC-04 · Progress (метрики).**
- Триггер: таб «Progress» / `/progress`.
- Шаги: агрегаты по статусам единиц + ретеншн + стрик + прогресс-бары блоков; лестница статусов; ближайшие события.
- R: `user_vocab_state` (доля Known+/In use), `user_grammar_state` (доля Reliable), `card_review_log` (30-дневный first-try retention), `daily_activity` (стрик), `block`+`module`+`user_module_state` (проценты блоков), `module_review`+`review_queue_item` (upcoming).
- W: —.
- Рендер: 4 стата (`SKY.progress.stats`), лестница `Lexeme/Construction/Module`, бары блоков, список upcoming. Состояние «course completed» (`courseState`) — отдельный экран с CTA на следующий курс.

### 1.2. Прохождение модуля

**UC-05 · Unit hub (страница модуля).**
- Триггер: тап по модулю на карте / `/course/[courseSlug]/module/[moduleSlug]`.
- Шаги: собрать шапку модуля; цели с прогрессом (D12: каждая цель привязана к сессии через `achieved_by`, статус `todo/in_progress/achieved` считается из состояния сессий); ленту 4 сессий с ячейками `done/current/locked` (D11) и превью шагов каждой сессии (в превью Output видны production-задание и extra-текст); цель «Continue» = текущая сессия + её первый непройденный шаг; свёрнутые справочные секции.
- R: `module` (`title`, `standfirst`, `goals jsonb [{text, achieved_by}]`), `study_session`+`user_session_state`, `session_step`+`user_step_state` (превью и continue-target), `grammar_spotlight`/`watchout`/`reading_text` (main+extra)/`vocab_entry` для справочника, exercise-наличие для лончеров.
- W: при первом входе — `user_module_state` → `in_progress` (если было `upcoming`), `started_at`.
- Рендер: **хаб, а не свалка контента** — сверху `GoalsProgress`, CTA «Continue Session N · шаг», `SessionRibbon` (ряды сессий: done → «revisit»-ссылка, current → «Up next», locked → не-ссылка с «Finish Session N−1 first»); ниже — вся теория/лексика/тексты/free practice в свёрнутых `ReferenceSection` (`<details>`), т.к. учёба идёт внутри сессий, а сюда возвращаются за справкой.

**UC-06 · Grammar spotlight + Watch-outs (теория).**
- Триггер: шаг `theory` (Prime — часть 1, Workout — часть 2), либо справочная секция хаба.
- Шаги: показать панели правил и блоки «Watch out!» **дозированно**: config шага `{"part":P,"of":N}` → P-я сбалансированная непрерывная доля упорядоченных spotlights и watchouts (`lib/domain/content-slicing.ts`; 5 spotlights при N=2 → 3+2). Пустая доля (модуль с одним spotlight) — валидный случай, рендерится заглушка «covered earlier».
- R: `grammar_spotlight` (`items jsonb [{form,example,note}]`), `watchout` (`bad_example/good_example/note`), `session_step.config`.
- W: `user_step_state` (done) при завершении шага.
- Рендер: кикер «Part P of N» + `SKY.unit.spotlight` (title/intro/rows) + `SKY.unit.watchout`.

**UC-07 · Reading с тап-глоссами (close/skim reading).**
- Триггер: шаг `reading` (Prime skim / Input close / Output extra — `config {"reading_kind":...,"mode":...}`).
- Шаги: рендер абзацев из сегментов; **режимы визуально различены** (`ReadingModeBanner`): skim — баннер «gist only» и глоссы выключены (`glossesEnabled=false`, сегменты рендерятся простым текстом), close — баннер «hunt the constructions», тап по глоссированному слову раскрывает определение; «Add to deck» создаёт карточку из глоссы.
- R: `reading_text` (`body jsonb` — массив абзацев из сегментов `{t}`/`{g:key}`), `gloss` (по `reading_text_id`+`key`).
- W: `user_step_state` (done); «Add to deck» → `flashcard(source=gloss, source_gloss_id, note_type=vocab)` + `card_state` (новая) для U.
- Рендер: текст с пунктирными глосс-спанами; всплывающий блок глоссы (word/pos/def/example + кнопка Add to deck). Формы — `SKY.unit.reading.paras`. **Отличие от мокапа:** в БД сегмент несёт только `{g:key}` (не инлайн-объект) — фронт **джойнит** глоссу по ключу (см. §8, разн. D3).

**UC-08 · Vocabulary studio (лексика).**
- Триггер: шаг `vocab` (Prime — партия 1, Input — партии 2 и 3), либо справочная секция хаба.
- Шаги: пролистать **партию** единиц с use cases (config `{"batch":B,"of":N}` → B-я доля упорядоченных 45 единиц, 15/15/15 через `content-slicing`); отметить приоритетные.
- R: `vocab_entry` (`term`, `tag`, `definition`, `use_cases jsonb`, `collocations`, `register_note`), `user_vocab_state`, `session_step.config`.
- W: `user_vocab_state` (`new→learning` при отметке приоритета — см. §8 разн. D6), `user_step_state`.
- Рендер: карточки лексем `SKY.unit.vocab.entries` + метка диапазона «Lexemes X–Y of 45».

**UC-09 · Exercise set (набор упражнений).**
- Триггер: (а) шаг `exercise_set` сессии (config: `{"types":[...]}` или `{"group_key":"vocab"}`), (б) лончер юнита (`grammar`/`reading`/`vocab`), (в) `review_slot`, (г) `module_quiz`, (д) чек-пойнт, (е) свободная практика.
- Шаги: набрать очередь упражнений по критерию; проиграть по одному; для каждого — принять ответ, проверить на сервере, показать объяснение; на ошибке предложить harvest; в конце — сводка.
- R: `exercise` (+ `exercise_type`) отфильтрованные по `module_id`/`checkpoint_id` + `pool` + `group_key`/`type_code`; `session_step.config`.
- W: на каждый ответ — `exercise_attempt` (`context`, `given_answer jsonb`, `is_correct`); на ошибку в контексте сессии — `review_queue_item` (stage 1, due +2д) [колея 2]; harvest → `error_map_entry` (карточка больше не создаётся — см. §5 и D9); закрытие `review_slot`-элемента → `review_queue_item.resolved_at`/`resolved_attempt_id`, при успехе — продвижение stage (+7/+21) или закрытие; `daily_activity.exercises_done++`.
- Рендер: плеер упражнения (стем/варианты/поле ввода/матч/тап), полоса прогресса-точек, фидбек (verde/rojo), объяснение, кнопки Harvest/Next; финальная сводка (score, harvested, re-queue). Алгоритмы проверки — §5, формы — `SKY.exercises`.

**UC-10 · Writing production (письменное задание).**
- Триггер: шаг `production` сессии Output в нечётных модулях (`writing_task.mode='writing'`), либо чек-пойнт с письмом.
- Шаги: показать prompt; пользователь пишет текст (счётчик слов); submit.
- R: `writing_task` (`prompt_md`, `genre`, `checklist jsonb`, `model_answer_md`).
- W: `writing_submission` (`body_md`, `duration_min`, `self_check`), `user_step_state`.
- Рендер: prompt + редактор + счётчик слов (220–260). После submit → UC-12.

**UC-11 · Speaking production (монолог).**
- Триггер: шаг `production` в чётных модулях (`writing_task.mode='speaking'`).
- Шаги: показать карточку задания; пользователь записывает монолог (или отмечает выполненным); прикрепляет запись.
- R: `writing_task`.
- W: `writing_submission` (`attachment_url` = запись), `user_step_state`.
- Рендер: prompt монолога, таймер/запись, кнопка submit. **Хранение аудио — открытый вопрос D8.**

**UC-12 · Self-check + model answer.**
- Триггер: шаг `self_check` после production.
- Шаги: показать модельный ответ и чек-лист; пользователь отмечает пункты.
- R: `writing_task.model_answer_md`, `writing_task.checklist`, последний `writing_submission`.
- W: `writing_submission.self_check jsonb` (отметки), `user_step_state`.
- Рендер: свой текст ↔ модельный ответ + чек-лист.

### 1.3. Протокол 4 сессий

**UC-13 · Ход сессии (session runner).**
- Триггер: «Continue Session N» / вход в сессию.
- Шаги: **жёсткий гейтинг (D11)** — `getSession` считает ячейки `computeSessionCells` и для `locked`-сессии возвращает `{kind:'locked'}` → страница делает `redirect` на хаб модуля; авто-старт `not_started→in_progress` только для `current`-сессии, `done` открыты для повтора. Дальше — последовательно проводить шаги `session_step` по `position`; каждый шаг — соответствующий UC (06–12, 15); отмечать `user_step_state`; при завершении последнего шага — закрыть `user_session_state`, открыть следующую сессию (она станет `current`).
- R: `study_session` (все сессии модуля — для гейтинга), `session_step` (+config), `user_session_state`, `user_step_state`.
- W: `user_session_state` (`in_progress`/`done`, `started_at`/`completed_at`), `user_step_state`, `daily_activity.minutes`.
- Рендер: заголовок сессии (Prime/Input/Workout/Output, planned_minutes), список шагов с чекбоксами, карточка «Step K of M · Goal» с микро-целью активного шага (`session_step.detail`), активный шаг; по завершении — CTA «Go to Session N+1».
- **Возврат к пройденным шагам:** `?step=N` (1-based) открывает панель любого шага со статусом `done` (или активного) — строки таких шагов в списке кликабельны; при просмотре не-активного шага рендерится баннер «Revisiting a completed step» со ссылкой назад, `MarkStepDone` заменяется инертным «✓ Step already done», а `done` `module_quiz` перезапустить нельзя (инфо-карточка). `advanceStep` идемпотентен: для уже-`done` шага — ранний выход без записи и без повторного `daily_activity.minutes`.
- **Пустой Review Slot:** при 0 due-элементов очереди шаг рендерит объяснение (очередь наполняется ошибками, возвраты +2/+7/+21 д) + `MarkStepDone` «Nothing due — continue» — сессия не блокируется.
- **Текст рядом с вопросами:** `exercise_set` с `reading_comprehension` в `types` дополнительно грузит main-текст, уплощает его в plain-абзацы на сервере и передаёт в `ExercisePlayer`, который показывает его сворачиваемой панелью «Show the text» над упражнением.

**UC-14 · Закрытие модуля (module quiz → Completed).**
- Триггер: шаг `module_quiz` сессии Output (config `{"count":10,"pool":"review"}`).
- Шаги: провести 10 упражнений из review-пула (UC-09 в контексте `module_quiz`); посчитать score; при завершении — модуль `Completed`, запланировать ревью +7/+21.
- R: `exercise` (`pool='review'`, `module_id`).
- W: `user_module_state` (`status='completed'`, `completed_at`, `quiz_score`), `module_review` (2 строки: stage `r7` due +7д, `r21` due +21д, `taken_at=null`), `user_session_state`/`user_step_state`.
- Рендер: квиз + экран завершения модуля («reviews scheduled at +7 and +21 days»).

### 1.4. Три колеи повторений

**UC-15 · Колея 1 — Flashcards (SRS).**
- Триггер: ежедневный ритуал (кнопка «Start · ≈12 min» на Today/Review) или `flashcards_intro`.
- Шаги: набрать карточки, у которых `card_state.due_at ≤ now` (+ новые из модуля); показать front → flip → оценка Again/Hard/Good/Easy; пересчитать расписание (SRS); лог.
- R: `card_state` (due для U), `flashcard` (`fields jsonb {front,main,cases,extra}`, `note_type`).
- W: `card_state` (`phase`,`due_at`,`interval_days`,`ease`,`reps`,`lapses`,`last_reviewed_at`), `card_review_log` (`rating 1–4`, `prev_phase`, `new_due_at`), `daily_activity.cards_reviewed++`.
- Рендер: карточка (тип-бейдж, front/back с cases/extra), 4 кнопки оценки с интервалами. Формы — `SKY.flashcards`. Алгоритм — §6.4 (SM-2, интервалы на кнопках из мокапа: Again 10 min / Hard 2 d / Good 4 d / Easy 8 d).
- Заметка: новые карточки модуля попадают в колею через `flashcards_intro` (создаётся `card_state phase='new'` для всех `flashcard` модуля, `due_at` раскидан по 7 дням — §6.4 `spreadInitialDueDate`).
- Заметка: колода — **только лексика**, по две карточки на слово (`vocab` — term→definition, `vocab_reverse` — definition→term, миграция `0005`). Grammar cloze и transformation из колеи убраны: это задания, их место — колея 2. Отдельные строки, а не двусторонний показ одной ноты, потому что узнавание и воспроизведение планируются независимо (отменяет D9).
- Заметка: `flashcards_intro` разовый, поэтому карточки, появившиеся у модуля позже (например reverse-сторона после `0005`), вводит `catchUpModuleIntroductions` — он вызывается при рендере `/flashcards` и `/review` и добирает всё непредставленное в модулях с уже начатой колодой.

**UC-16 · Колея 2 — Exercise re-queue (Review Slot).**
- Триггер: шаг `review_slot` сессий Input/Workout (config `{"count":10}`), либо кнопка «Run the Review Slot».
- Шаги: взять до 10 `review_queue_item` (open, due ≤ now) по `due_at`; для каждого проиграть свежий вариант того же `exercise` (UC-09, context=`review_slot`); при успехе — продвинуть stage (1→2→3, due +7/+21) или закрыть на stage 3; при повторной ошибке — сбросить due (правило §6.2).
- R: `review_queue_item` (open, due), связанные `exercise`.
- W: `exercise_attempt` (context=`review_slot`), `review_queue_item` (`stage`,`due_at`,`resolved_at`,`resolved_attempt_id`), `daily_activity`.
- Рендер: тот же плеер + счётчик «10 items from the re-queue». Формы — `SKY.review.lanes[1]`.

**UC-17 · Колея 3 — Module reviews (r7/r21).**
- Триггер: наступил `module_review.due_at` (виден на Today/Review как «+7-day quiz due today»); кнопка «Take quiz».
- Шаги: провести квиз из 10 новых вариантов заданий модуля (UC-09, context=`module_review`); посчитать score; отметить `passed = score≥80`; если оба ревью (r7 и r21) passed → модуль `Mastered`; иначе темы возвращаются в колею 2.
- R: `exercise` (модуля, `pool='review'`), `module_review`.
- W: `module_review` (`taken_at`,`score`,`passed`), при обоих passed — `user_module_state` (`status='mastered'`, `mastered_at`); при провале — `review_queue_item` по слабым темам.
- Рендер: квиз + результат; на карте модуль → Mastered. Формы — `SKY.review.lanes[2]`.

### 1.5. Чек-пойнты (ворота)

**UC-18 · Диагностика.**
- Триггер: старт курса (первый экран), `checkpoint.kind='diagnostic'`, `pass_mark=null`.
- Шаги: 60 заданий Use of English (UC-09, context=`checkpoint`) + письмо (UC-10) + монолог; результат — карта пробелов (не ворота, ничего не блокирует).
- R: `exercise`/`writing_task` (`checkpoint_id`).
- W: `exercise_attempt`, `writing_submission`, `user_checkpoint_state` (`status='passed'` формально, `best_score`), опционально `error_map_entry` по промахам.
- Рендер: длинный набор + сводка-«карта пробелов».

**UC-19 · Чек-пойнт блока (A/B/C) и Final mock.**
- Триггер: все модули блока `Completed`/`Mastered` → чек-пойнт `available`; тап «Take checkpoint». Final — после чек-пойнта C.
- Шаги: 40 заданий (block) / полный mock (final) + письмо; порог `pass_mark` (75 / 65); при passed — блок пройден, следующий блок открывается; при провале — неделя ревизии.
- R: `checkpoint`+`user_checkpoint_state`, `exercise`/`writing_task` по `checkpoint_id`.
- W: `user_checkpoint_state` (`status`,`best_score`,`taken_at`); при passed — разблокировка модулей следующего блока (`user_module_state locked→upcoming`).
- Рендер: тест + разбор; на карте футер блока → passed/failed.

### 1.6. Служебные / кросс-сценарии

**UC-20 · Error map (карта ошибок).** R/W: `error_map_entry` (создаётся из harvest UC-09 и из письма); просмотр реестра ошибка→правило; на чек-пойнтах — свериться, ушли ли старые ошибки (`resolved_at`). Само задание при этом возвращается колеёй 2, а не карточкой.

**UC-21 · Manual flashcard.** W: `flashcard(source='manual', created_by_user_id=U)` + `card_state`. Ручное добавление карточки (и `source='gloss'` из читалки — UC-07). Harvest ошибки в колоду больше не пишет: с `0005` колода лексическая.

**UC-22 · Streak / daily activity.** W: любой продуктивный шаг апсертит `daily_activity(U, today)` (exercises_done/cards_reviewed/minutes). Read на Today/Progress для стрика и heatmap.

**UC-23 · Vocab/Grammar promotion (фоновые статусы).** При успешных применениях: `user_grammar_state.success_count++`, `introduced→practising→reliable` (≥5 успешных, см. PLAN §4); лексема `known→in_use` при употреблении в `writing_submission` (`in_use_submission_id`). Вызывается как побочный эффект UC-09/UC-10.

**Служебное (не UC): сброс прогресса.** Карточка «Danger zone» внизу `/progress` (двухшаговое подтверждение) → server action → `lib/use-cases/maintenance.ts` → `lib/repositories/maintenance.repo.ts::resetAllProgress` — транзакция, зеркалящая `scripts/reset-progress.ts`: все прогресс-таблицы пользователя + пользовательские флэшкарты; контент и `app_user` не трогаются. Тестовая аффорданс single-user периода.

---

## 2. Слои и структура каталогов `web/`

Слоистая архитектура: **domain (чистая логика) → use-cases (оркестрация) → repositories (доступ к БД) → app/components (UI)**. Направление зависимостей строго внутрь: UI → use-cases → repositories → db; domain не зависит ни от чего (тестируется без БД).

```
web/
  app/                                  # Next.js App Router: страницы (RSC) + server actions
    layout.tsx                          # оболочка, нав-рельса/боттом-нав, шрифты
    globals.css
    page.tsx                            # UC-01 Today  (RSC)
    course/
      page.tsx                          # UC-02 Course map (RSC)
      [courseSlug]/module/[moduleSlug]/
        page.tsx                        # UC-05 Unit overview (RSC)
        session/[sessionType]/
          page.tsx                      # UC-13 Session runner (RSC + client-острова шагов)
    review/page.tsx                     # UC-16/17 Review hub (RSC)
    progress/page.tsx                   # UC-04 Progress (RSC)
    flashcards/page.tsx                 # UC-15 SRS player (client-остров)
    actions/                            # 'use server' — тонкие врапперы над use-cases
      exercises.ts  flashcards.ts  sessions.ts  reviews.ts  writing.ts  course.ts
  components/
    player/                             # клиентские острова
      ExercisePlayer.tsx                # UC-09 плеер всех 8 типов
      FlashcardPlayer.tsx               # UC-15
      exercise-types/                   # McCloze, OpenCloze, WordFormation, Kwt,
                                        #   GrammarDrill, ErrorCorrection, CollocationMatch, ReadingComprehension
    reading/ReadingText.tsx             # UC-07 глоссы (client — тап-раскрытие)
    audio/                               # §4.8 — общий плеер и офлайн-доставка озвучки
      AudioProvider.tsx                  # 'use client' — один <audio> на всё приложение; play/playSequence/stop/prefetch
      PlayButton.tsx                     # ▶/⏸ одного клипа; null, если клипа нет
      DownloadModuleAudio.tsx            # «Save audio offline» — префетч всех клипов модуля через SW
    map/  today/  progress/  unit/      # презентационные (server) компоненты экранов
    ui/                                 # примитивы (Badge, Card, ProgressBar, BottomNav, SideRail)
  lib/
    domain/                             # ЧИСТАЯ логика, без БД и без 'server' — юнит-тестируемо
      srs.ts                            # SRS-планировщик (колея 1) — §6.4
      review-queue.ts                   # +2/+7/+21 стадии (колея 2) — §6.2
      module-review.ts                  # r7/r21 → Mastered (колея 3) — §6.3
      grading/                          # проверка ответов — §5
        index.ts                        # gradeAttempt(type_code, content, given) -> {is_correct, correctAnswer}
        normalize.ts                    # normalize(text)
        graders/*.ts                    # по одному на type_code
      module-state.ts                   # машина статусов модуля/блока/чек-пойнта — §1.5, §6.5
      progress.ts                       # агрегаты статусов (доли Known+/Reliable/retention)
      time.ts                           # startOfDay/addDays (из референса leitner.ts)
      types.ts                          # доменные типы (ExerciseContent-юнион, GivenAnswer, статусы)
      audio-text.ts                     # normalizeAudioText/splitSentences — общий код sync, scripts/audio.ts и страниц (§4.8)
    use-cases/                          # application-слой, 'server-only'; оркестрирует repo + domain
      today.ts  course-map.ts  unit.ts  session.ts  exercise-set.ts
      flashcards.ts  review.ts  module-review.ts  checkpoint.ts  progress.ts  writing.ts  course-switch.ts  audio.ts
    repositories/                       # доступ к БД через Prisma; ТОЛЬКО здесь Prisma
      course.repo.ts  module.repo.ts  content.repo.ts  exercise.repo.ts
      progress.repo.ts  srs.repo.ts  review.repo.ts  writing.repo.ts  activity.repo.ts  audio.repo.ts
    db.ts                               # PrismaClient singleton (из референса)
    serialize.ts                        # BigInt → number на границе repo (§3, разн. D7)
    current-user.ts                     # getCurrentUserId(): id из cookie-сессии (§8 D10)
    auth/
      tokens.ts                         # подпись/проверка access+refresh JWT (jose, edge-safe)
      cookies.ts                        # имена и флаги httpOnly-кук (единственное место)
      session.ts                        # чтение сессии из кук в RSC/Server Actions
    content-schema.ts                   # zod-типы YAML пакета (общие для sync и рантайма)
    audio/
      config.ts                         # AUDIO_PROFILE/AUDIO_LANGS, пути блобов — общие для scripts/audio.ts и sync.ts (§4.8)
  prisma/
    schema.prisma                       # ИНТРОСПЕКТИРОВАННАЯ схема (prisma db pull), @@map на snake_case
  scripts/
    migrate.ts                          # применяет db/migrations/*.sql идемпотентно (§3.2)
    sync.ts                             # content/<course> → БД (§4)
    audio.ts                            # генерация озвучки: plan → synth → import (§4.8)
  public/
    sw.js                                # service worker — cache-first для /audio/** (§4.8, §7.2)
  middleware.ts                         # гейт + тихое обновление access-токена (§8 D10)
  content.config.ts                     # реестр курсов и модулей (порядок, slug) — §4.1
  docker-compose.yml                    # Postgres 16 локально (из референса)
  next.config.mjs  tailwind.config.ts  tsconfig.json  package.json  .env.example
```

**Корень репозитория:** `netlify.toml` с `base="web"` (см. §3.3). Каталоги `db/migrations/` и `content/` остаются в корне репо; sync и migrate обращаются к ним по относительному пути вверх (как в референсе `MODULES_ROOT = ../modules`).

**Границы, которые исполнители не нарушают:**
- Prisma импортируется **только** в `lib/repositories/*` и `scripts/*`. Use-cases и domain о Prisma не знают.
- `lib/domain/*` не импортирует ничего из `lib/repositories`, `next`, `@prisma/client` — чистые функции.
- Server actions (`app/actions/*`) — тонкие: `getCurrentUserId()` → вызов use-case → `revalidatePath`. Никакой бизнес-логики.
- Клиентские компоненты (`'use client'`) не читают БД — только принимают props от RSC и дёргают server actions.

---

## 3. Доступ к БД: Prisma поверх raw SQL-миграций

### 3.1. Решение

**SQL-миграции — единственный source of truth схемы. Prisma используется как типизированный клиент, полученный интроспекцией, и НЕ владеет миграциями.**

Поток:
1. Разработчик пишет DDL в `db/migrations/000N_*.sql` (существующие не редактируются — только новые файлы).
2. `scripts/migrate.ts` применяет миграции к БД (локально и на билде).
3. `prisma db pull` интроспектирует уже применённую схему → генерирует/обновляет `prisma/schema.prisma` (модели с `@@map`/`@map` на snake_case имена таблиц и колонок, enum'ы как Prisma enums). Полученный `schema.prisma` **коммитится**.
4. `prisma generate` (в `postinstall`) генерирует типизированный клиент из закоммиченного `schema.prisma`.

Почему не `prisma migrate`: схема уже спроектирована в raw SQL (partial unique indexes, CHECK-констрейнты `exercise_owner`/`checkpoint_block_by_kind`, `generated always as identity`, частичные индексы `where resolved_at is null`) — часть этого Prisma-миграции не выражают. Интроспекция сохраняет БД как есть и лишь читает её.

Практика: после каждой новой миграции разработчик прогоняет `prisma db pull` и коммитит обновлённый `schema.prisma` (это ручной шаг, не автоген на билде — на билде клиент генерируется из коммита). `prisma db pull` не потеряет частичные индексы/чеки — они останутся в БД; в `schema.prisma` они отражаются как поддерживаемые атрибуты либо остаются вне модели (Prisma их не трогает, потому что не мигрирует).

### 3.2. `scripts/migrate.ts` (раннер миграций)

Не зависит от `psql` (на Netlify его нет). Использует `pg` (node-postgres) напрямую:
- Таблица учёта: `create table if not exists schema_migrations (filename text primary key, applied_at timestamptz default now())`.
- Читает `../db/migrations/*.sql`, сортирует по имени, отбирает те, которых нет в `schema_migrations`.
- Файлы уже содержат собственные `begin; ... commit;` — раннер выполняет содержимое файла **как есть** одним `query`, затем отдельным statement пишет строку в `schema_migrations`. Если файл упал — его транзакция откатилась, строка учёта не записана, билд падает.
- Идемпотентность: повторный прогон применяет 0 файлов.
- Регистрирует уже применённые вручную 0001/0002 (первый прогон на существующей БД: если таблицы есть, но `schema_migrations` пуста — предусмотреть флаг `--baseline`, помечающий все текущие файлы применёнными без выполнения; для чистой БД просто применяет все).

Альтернатива, если не тянуть `pg`: `prisma db execute --file db/migrations/000N.sql --schema prisma/schema.prisma` в цикле по неприменённым (учёт всё равно нужен вручную). Основной вариант — `pg`-раннер.

### 3.3. Билд и деплой

**`netlify.toml` (корень репо):**
```toml
[build]
  base    = "web"
  command = "pnpm install --frozen-lockfile && pnpm build"
  publish = ".next"
[build.environment]
  NODE_VERSION = "20"
[[plugins]]
  package = "@netlify/plugin-nextjs"
```

**`package.json` scripts (web):**
```
"build":  "tsx scripts/migrate.ts && tsx scripts/sync.ts && next build"
"postinstall": "prisma generate"
"dev":    "next dev"
"migrate":"tsx scripts/migrate.ts"
"sync":   "tsx scripts/sync.ts"
"db:pull":"prisma db pull && prisma generate"
```
Порядок на билде: `prisma generate` (postinstall) → `migrate` (применить SQL) → `sync` (залить контент) → `next build`.

**Подключения к Neon (две переменные, стандартный паттерн Prisma+Neon):**
- `DATABASE_URL` — **пулер** Neon (pgBouncer, `?pgbouncer=true&connection_limit=1`), используется рантаймом (serverless-функции Netlify) и Prisma-клиентом.
- `DIRECT_URL` — прямое подключение, используется `migrate.ts`/`sync.ts` на билде (DDL и bulk-upsert; на пулере DDL капризничает).
- Локально обе указывают на Docker-Postgres (`postgres://dev:dev@localhost:5432/skyrocket`).

**`docker-compose.yml`** — Postgres 16 (как в референсе), БД `skyrocket`.

**`.env.example`** фиксирует `DATABASE_URL`, `DIRECT_URL`, `AUTH_JWT_SECRET`.

**`AUTH_JWT_SECRET`** — ключ подписи access/refresh JWT (§8 D10), минимум 32 символа. На проде задаётся в переменных окружения Netlify; смена ключа разлогинивает всех. Билду он не нужен — `next build` собирается и без него, и без единого пользователя в БД.

### 3.4. Заметки по типам

- Все PK — `bigint generated always as identity`. Prisma маппит `bigint` → JS `BigInt`. `BigInt` не сериализуется в JSON и неудобен в props RSC→client. **Решение (D7):** репозитории возвращают DTO, где id приведены к `number` через `lib/serialize.ts` (безопасно при single-user масштабе — id заведомо < 2^53). Доменные типы оперируют `number`.
- `jsonb`-поля (`content`, `fields`, `items`, `body`, `use_cases`, `goals`, `config`, `checklist`, `self_check`, `given_answer`) Prisma отдаёт как `Prisma.JsonValue` — валидируются zod-типами из `lib/content-schema.ts`/`lib/domain/types.ts` на входе.
- Enum'ы Postgres (`session_type`, `step_kind`, `card_phase`, `module_status`, …) интроспектируются в Prisma enums — использовать их как типы в domain.

---

## 4. Дизайн sync-скрипта («скраппер»)

`scripts/sync.ts` по образцу `../concurrency/web/scripts/sync.ts`: обход контента, парсинг, идемпотентный upsert по `content_hash`, прунинг удалённого, полное сохранение прогресса. Отличие от референса: контент — структурированный **YAML** (а не markdown), и целевых таблиц много.

### 4.1. Реестр (`content.config.ts`) и скелет курса

```ts
export const COURSE_ROOTS: string[] = ['courses/en-c1', 'courses/de-a2'];
```

В реестре — только корни. Что за модули и чек-пойнты внутри курса, как называются блоки и как устроен недельный протокол, объявляет `courses/<slug>/course.yaml` (схема — `lib/course-schema.ts`, описание — `docs/CONTENT-PACKAGE-SCHEMA.md`). Модуль без каталога контента — предупреждение и пропуск.

**Решение 2026-07 (разворот прежнего правила).** Раньше структура курса жила в миграциях `0002`/`0004`, а sync её только *обновлял*. Это означало, что второй курс — и любая правка протокола — требует миграции, что противоречит идее курс-агностичного движка. Теперь `syncCourseSkeleton()` апсертит `course → block → module → checkpoint → study_session → session_step` из `course.yaml` по натуральным ключам, объявленным unique ещё в `0001_init.sql`. `0002`/`0004` остаются применёнными как история; `courses/en-c1/course.yaml` извлечён из них дословно, поэтому первый синк после `0006` не меняет ни одной строки, кроме хеша.

Две детали, которые делают разворот безопасным:

- **Гейт `course.skeleton_hash`** (миграция `0006`) — sha256 по байтам `course.yaml`. Совпал → курс пропускается за ноль запросов, как модуль по `content_hash`.
- **Шаги апсертятся по `(study_session_id, position)`**, а не удаляются и вставляются заново, как делала `0004`. `delete` каскадит `user_step_state`, то есть прежний способ стирал место учащегося в неделе; теперь удаляются только шаги, чья позиция вышла за новую длину сессии.

Позиции берутся из порядка в массивах YAML, `module.planned_minutes` — из суммы минут сессий протокола: дублировать числа значит позволить им разойтись.

### 4.2. Обход и маппинг файлов на таблицы

Для каждого модуля `courses/en-c1/content/module-NN/`:

| Файл | Целевые таблицы | Натуральный ключ upsert |
|---|---|---|
| `meta.yaml` | `module` (title, standfirst, goals), `grammar_point[]` (из `grammar_points`) | `module`: unique(block_id, slug); `grammar_point`: unique(module_id, title) |
| `theory.yaml` | `grammar_spotlight[]`, `watchout[]` | unique(module_id, position) |
| `vocab.yaml` | `vocab_entry[]` | unique(module_id, term) |
| `text-main.yaml` | `reading_text(kind=main)` + `gloss[]` | reading: unique(module_id, kind, position); gloss: unique(reading_text_id, key) |
| `text-extra.yaml` | `reading_text(kind=extra)` + `gloss[]` | то же |
| `exercises.yaml` | `exercise[]` (`core` + `review_pool`) | **см. §4.5 (натуральный ключ отсутствует — нужен `ident`)** |
| `writing.yaml` | `writing_task` | **см. §4.5** |
| — (деривация) | `flashcard`: vocab + vocab_reverse ← `vocab.yaml` · `exercise(open_cloze, pool=review)` ← `theory.yaml (cloze_cards)` | **см. §4.5**, D9 |

Чек-пойнты: каталоги `diagnostic/`, `checkpoint-a…c/`, `final/` содержат `exercises.yaml` (+ `writing.yaml`) → `exercise`/`writing_task` с `checkpoint_id` (владелец — чек-пойнт, не модуль; CHECK `exercise_owner`).

**Структура курса синкается из `course.yaml` (§4.1), контент — из пакетов.** Порядок внутри одного прогона: сначала `syncCourseSkeleton()` создаёт/обновляет `course/block/module/checkpoint/study_session/session_step`, затем пакеты наполняют модули. `title`/`standfirst` модуля приходят из обоих источников: `course.yaml` даёт карту курса до того, как написан контент, `meta.yaml` перезаписывает её при синке пакета. `grammar_spotlight`, `watchout`, `grammar_point`, `reading_text`, `gloss`, `vocab_entry`, `exercise`, `writing_task`, `flashcard` — только из пакетов.

### 4.3. Порядок вставки (с учётом FK)

1. `module` (upsert по slug — обновление; строка уже есть из seed).
2. `grammar_point` (нужен для `exercise.grammar_point_id`).
3. `grammar_spotlight`, `watchout`.
4. `reading_text` → затем `gloss` (FK на reading_text).
5. `vocab_entry`.
6. `exercise` (резолвит `grammar_point_id` по title, `reading_text_id` — для `reading_comprehension` линкует на main-текст модуля, опционально).
7. `writing_task`.
8. `flashcard` (деривируется из `vocab.yaml`: на каждую запись две строки — `vocab` и `vocab_reverse`, обе линкуются на `vocab_entry` по `term` → `vocab_entry_id`). Заданий в колоде нет — `cloze_cards` уходят в `exercise` шагом выше (D9). Отдельные Anki-CSV не поставляются — карточки живут только в webapp-SRS.

Прунинг — в обратном порядке зависимостей.

### 4.4. content_hash и идемпотентность

Двухуровневый хэш (как «нулевой» гейт + гранулярность):
- **Модульный гейт:** `module.content_hash = sha256(конкатенация сырых байтов всех файлов пакета)`. Если совпал — весь модуль пропускается без единого запроса к контент-строкам (быстрый no-op на неизменном пакете, как в референсе — «zero writes when unchanged»).
- **Пер-сущностный хэш:** для каждой строки `content_hash = sha256(нормализованный сериализованный объект этой сущности)`. Upsert по натуральному ключу: `create`, если строки нет; `update`, если `content_hash` изменился; иначе `unchanged`. Счётчики `+added ~updated =unchanged -removed` в лог (как в референсе).

Прогресс не трогается: контент-строки имеют стабильные натуральные ключи, поэтому их `id` сохраняются между синками → `exercise_attempt`, `card_state`, `review_queue_item`, `user_vocab_state` и пр. остаются валидными.

### 4.5. Стабильные натуральные ключи — обязательная миграция `0003` (важно)

**Проблема (см. §8, разн. D1).** Таблицы `exercise`, `writing_task`, `flashcard` **не имеют** уникального натурального ключа в `0001`. Если синк будет пересоздавать эти строки (или ключевать их по `position`), то при любом переупорядочивании контента `exercise.id`/`flashcard.id` изменятся, и привязанный прогресс потеряется: `exercise_attempt`, `review_queue_item`, а критично — `card_state` (SRS-расписание, PK = (user, flashcard_id)) и `module_review`.

**Решение — исполнитель этапа 2 добавляет `db/migrations/0003_content_natural_keys.sql`:**
- `alter table exercise add column ident text;` + `create unique index exercise_module_ident_uniq on exercise (module_id, ident) where module_id is not null;` + `... (checkpoint_id, ident) where checkpoint_id is not null;`
- `alter table writing_task add column ident text;` + аналогичные частичные unique.
- `alter table flashcard add column ident text;` + `create unique index flashcard_ident_uniq on flashcard (ident);`
- Обновить `docs/DATA-MODEL.md` и переопубликовать артефакт схемы (по правилу CLAUDE.md «изменить схему БД»).

**Формирование `ident` синком (детерминированно, стабильно к переупорядочиванию):**
- `exercise.ident`: если в YAML задан явный `id:` у упражнения — использовать его; иначе `sha1(type_code + '|' + нормализованный ключевой текст)`, где ключевой текст = `pre+post+prompt` (choice/cloze) / `s1+key` (kwt) / `join(words)` (error) / `join(left)+join(right)` (match) / `passage+q` (reading). Ключевой текст стабилен, пока задание по сути то же.
- `writing_task.ident`: `genre` (в модуле письмо одно; для чек-пойнтов — `genre+position`).
- `flashcard.ident`: `tag + '|' + note_type + '|' + term` — для обеих сторон слова (`vocab`, `vocab_reverse`), тег `en-c1::mNN` даёт уникальность между модулями. Прямая сторона сохранила формулу ident'а с доредакционных времён, поэтому `card_state` пережил переход на двустороннюю колоду.
- `exercise.ident` для упражнений из `theory.yaml`: `theory-cloze-<sha1(text)[0..12]>` — явный ключ, потому что дефолтная формула (`sha1(type|pre+post)`) могла бы совпасть с авторским `open_cloze` из `exercises.yaml`, а `(module_id, ident)` уникален.

**Рекомендация контент-команде:** добавить в схему пакета (`docs/CONTENT-PACKAGE-SCHEMA.md`) опциональное поле `id:` у каждого упражнения — тогда ключ полностью авторский и переживает любые правки формулировки. До этого работает хэш-фолбэк.

### 4.6. Прунинг удалённых сущностей

Как в референсе (`pruneRemoved`): для каждого типа контента синк собирает множество `seen` натуральных ключей текущего пакета и удаляет из БД строки этого `module_id`, которых в `seen` нет.
- Жёсткое удаление: `grammar_spotlight`, `watchout`, `grammar_point`, `reading_text`+`gloss`, `vocab_entry`, `exercise`, `writing_task` (их прогресс — `exercise_attempt` и т. п. — каскадится/`set null` по FK; это допустимо: единица исчезла из курса).
- **Мягкое удаление флешкарт:** `flashcard.archived = true` вместо delete (сохраняет SRS-историю `card_state`/`card_review_log`), как auto-cards в референсе. Возврат единицы в пакет → `archived=false`.

### 4.7. Zod-валидация

`lib/content-schema.ts` описывает zod-схемы всех YAML-файлов пакета (включая юнион 8 типов `content`), `lib/course-schema.ts` — схему `course.yaml`. Синк валидирует каждый файл перед upsert — падение с понятной ошибкой при несоответствии формату (страховка качества генерации модулей). Те же типы переиспользует рантайм при чтении `content jsonb`.

**Языковая параметризация.** Схемы курс-агностичны с одним исключением: правило восстановимости пропуска `open_cloze` должно знать, какие слова вынуждены грамматикой этого языка. Поэтому вместо готового значения экспортируется фабрика `makeExercisesPackageSchema(language)`, а списки служебных слов лежат в `lib/content-gap-words/<lang>.ts` за диспетчером `index.ts`. Язык берётся из `course.yaml`; для языка без своего файла синк падает с указанием, какой файл создать. `course-schema.ts` дополнительно проверяет то, что БД проверила бы позже и хуже: соответствие `kind` чек-пойнта наличию блока (зеркало CHECK-констрейнта), уникальность slug'ов модулей и типов сессий.

### 4.8. Аудио-манифест

Курсы с `language: de` (сейчас — только `de-a2`) несут озвучку части контента: `pnpm audio` синтезирует её оффлайн через `tts-mcp` (Chatterbox, CUDA) и кладёт результат в репозиторий как обычный контент — сам sync никогда не обращается к TTS.

**Цикл:** автор с локальным GPU и `tts-mcp` (`.venv` с extra `[chatterbox]`) запускает `pnpm audio -- --course de-a2` → `.opus`-блобы в `web/public/audio/de/<xx>/<key>.opus` и `courses/de-a2/audio/manifest.json` коммитятся в репозиторий → `pnpm sync` (локально и на билде) читает манифест и заливает `audio_clip`. **Netlify TTS не запускает никогда** — GPU-модели на билде нет и не будет, `next build` только читает уже закоммиченные блобы и манифест.

**`scripts/audio.ts`** (`pnpm audio -- --course <slug> [--module <slug>] [--dry-run] [--skip-synth] [--no-prune]`) — три фазы одного процесса, потому что модель Chatterbox грузится один раз за запуск:
1. **plan** — обход `courses/<slug>/content/<dir>/` теми же zod-схемами, что и sync (`VocabPackageSchema`, `TheoryPackageSchema`, `ReadingPackageSchema`), сбор фраз по фиксированному списку полей (`docs/CONTENT-PACKAGE-SCHEMA.md` «Аудио»), дедуп по `normalizeAudioText`, запись `courses/<slug>/audio/.build/phrases.json` (не коммитится).
2. **synth** — `spawn` бинаря `tts-mcp batch … --profiles normal` (`TTS_ENGINE=chatterbox`, `stdio: inherit` — прогресс и брак tts-mcp видны прямо в выводе `pnpm audio`); повторный запуск дёшев — tts-mcp дедуплицирует по своему контентно-адресуемому кешу.
3. **import** — копирует новые блобы из кеша tts-mcp в `web/public/audio`, пишет коммитируемый `courses/<slug>/audio/manifest.json` (отсортирован по `text_hash` — стабильный diff), прунит из `web/public/audio/<lang>/**` файлы, не упомянутые ни одним манифестом этого языка, печатает отчёт (клипов на модуль, суммарный вес, непросинтезированные фразы, предложения длиннее `MAX_SENTENCE_CHARS`).

**Адресация — по тексту, не по позиции** (мотивация — §8 D15). Приложение ищет клип по собственному `text_hash = sha256(normalizeAudioText(text))`; `clip_key`/`path` манифеста — родная адресация tts-mcp (движок+голос+профиль+версия параметров+текст), приложение её только копирует и никогда не пересчитывает.

**`syncAudioManifest`** (`scripts/sync.ts`, вызывается в `main()` сразу после `syncCourseSkeleton`, до модулей курса):
- нет `courses/<slug>/audio/manifest.json` → warn + skip, как отсутствующий пакет модуля — en-c1 (язык не `de`) живёт без аудио постоянно, de-a2 получает его после своего контента;
- гейт `course.audio_manifest_hash` (sha256 байтов файла, по образцу `course.skeleton_hash` из `0006`) — совпал → «audio unchanged — 0 queries»; даже на этом быстром пути функция обязана добавить ключи курса в общую по языку карту `seen`, иначе прунинг ниже стёр бы валидные строки другого курса того же языка, чей манифест в этом прогоне не менялся;
- перед upsert каждой строки — проверка блоба на диске (`web/public/audio` + путь манифеста): нет файла → warn + строка не пишется, тот же принцип «отсутствующая кнопка лучше 404 в плеере», что у остальных сущностей sync;
- upsert по `(lang, text_hash, profile)`, счётчики `+/~/=/-`.

**Прунинг — глобальный по языку, не по курсу.** `main()` копит `Map<lang, Set<"text_hash|profile">>` по всем курсам одного прогона и один раз в конце удаляет из `audio_clip` лишние строки этого `lang` — натуральный ключ клипа не содержит курс (два курса на одном языке могут делить одну и ту же озвученную фразу), «прунинг по курсу» стёр бы чужие валидные строки.

`profile` остаётся колонкой даже при одном значении: сейчас всегда `'normal'` (константа `AUDIO_PROFILE`, `lib/audio/config.ts`, выбора в UI нет), но она бесплатно приезжает из манифеста tts-mcp, а без неё второй профиль (`slow` и т. п.) в будущем потребовал бы расширять уникальный ключ отдельной миграцией.

---

## 5. Проверка ответов упражнений (8 типов)

Проверка **только на сервере** (server action → `lib/domain/grading`). Клиент показывает интерактив (как в мокапе), но `is_correct` вычисляет сервер — клиентские индексы/ввод отправляются как `given_answer`, сервер сверяет с `content` из БД. Единая точка: `gradeAttempt(type_code, content, given) → { is_correct, correctAnswer, explanation }`.

**Нормализация текста** (`lib/domain/grading/normalize.ts`, из логики мокапа `check()`): `s.trim().toLowerCase().replace(/\s+/g,' ')`. Применяется и к вводу пользователя, и к каждому принимаемому ответу.

| `type_code` | interaction | `content jsonb` (ключи из пакета) | `given_answer jsonb` | Алгоритм проверки | Фидбек |
|---|---|---|---|---|---|
| `mc_cloze` | choice | `{pre, post, options[], answer:int}` | `{selected:int}` | `selected === answer` | подсветить `options[answer]` |
| `grammar_drill` | choice | `{pre, post, prompt, options[], answer:int}` | `{selected:int}` | `selected === answer` | то же |
| `reading_comprehension` | choice | `{passage, q, options[], answer:int}` | `{selected:int}` | `selected === answer` | то же |
| `open_cloze` | text_input | `{pre, post, hint?, answers:string[], answer_shown}` | `{text}` | `answers.map(normalize).includes(normalize(text))` | показать `answer_shown` |
| `word_formation` | text_input | `{pre, post, prompt, answers[], answer_shown}` | `{text}` | то же | `answer_shown` |
| `key_word_transformation` | text_input | `{s1, key, pre, post, answers[], answer_shown, hint}` | `{text}` | то же (мультиответы: список принимаемых форм) | `answer_shown` |
| `error_correction` | word_tap | `{words:string[], wrong:int, correction}` | `{tapped:int}` | `tapped === wrong` | показать `correction` |
| `collocation_match` | match | `{left[], right[], pairs:{Li:Ri}}` | `{pairs:{Li:Ri}, misses:int}` | `deepEqual(pairs, content.pairs) && misses === 0` | раскрыть верные пары |

Пояснения:
- **choice-типы:** ответ — индекс варианта (`answer` в пакете — целочисленный индекс, 0-based). В мокапе `pick(i)` мгновенно проверяет `i===answer` без кнопки Check.
- **text_input:** `answers` — массив всех принимаемых форм (напр. `[been in this job for, been doing this job for, been at this job for]`). `answer_shown` — форма для показа (может быть с заглавной). Сервер нормализует и сверяет со списком.
- **word_tap (`error_correction`):** пользователь тапает предположительно ошибочное слово; верно, если индекс совпал с `wrong`. `correction` (строка вида «is leading → has been leading») — только фидбек.
- **match (`collocation_match`):** интерактив tap-verb → tap-noun; `pairs` в пакете — маппинг индексов left→right. Правильность = полное совпадение маппинга **и** отсутствие промахов с первой попытки (`misses===0`) — правило мокапа «First-try misses count». Сервер доверяет `misses` от клиента (single-user), но независимо проверяет корректность самого маппинга.

**Что пишется в прогресс на каждый ответ:**
- `exercise_attempt` (`user_id`, `exercise_id`, `context`, `given_answer`, `is_correct`, `time_ms`, `answered_at`).
- Если `is_correct=false` и `context ∈ {session, module_quiz, practice}`: создать/не-дублировать `review_queue_item` (open, stage=1, due=+2д) [колея 2, партиал-unique `review_queue_open_uniq` защищает от дублей].
- Если `context='review_slot'`: обновить исходный `review_queue_item` (`resolved_attempt_id`; при успехе — продвинуть stage/закрыть; при ошибке — оставить/сбросить due, §6.2).
- Harvest (по кнопке на ошибке): `error_map_entry(source='exercise', source_attempt_id, error_text, rule_note=explanation)`. Карточку не создаёт — одна ошибка и так даёт элемент колеи 2 (перерешать то же задание) и строку карты ошибок; третий артефакт-дубликат в колоде убран вместе с note-типами заданий (`0005`).
- Побочно (UC-23): при верном применении конструкции — `user_grammar_state.success_count++` и продвижение статуса.
- `daily_activity.exercises_done++`.

**Тип-код: канонический — длинный.** В `content.js`-мокапе типы закодированы коротко (`drill/error/kwt/open/read/mc/match/wf`) — это артефакт мокапа. И пакеты, и БД, и грейдер используют **длинные** `type_code` из сида `exercise_type`. Плеер переключается по длинному `type_code` (внутренняя мапа на компонент). См. §8 разн. D2.

---

## 6. Алгоритмы повторений и статусов (domain)

### 6.1. Общие
`lib/domain/time.ts`: `startOfDay/endOfDay/addDays` (порт из референса `leitner.ts`). Все `due_at` считаются от начала целевого дня в локальном времени, чтобы «due today» было предсказуемым.

### 6.2. Колея 2 — `review-queue.ts`
- Ошибка в упражнении (не в review_slot) → новый `review_queue_item` stage=1, `due_at = startOfDay(+2д)`. Партиал-unique гарантирует один открытый item на (user, exercise).
- В Review Slot: верный ответ → stage 1→2 (`due=+7д`), 2→3 (`due=+21д`), на 3 верно → `resolved_at=now` (закрыт). Неверно на любой стадии → stage сбрасывается в 1, `due=+2д` (тема «не усвоена»).
- Запрос «due сегодня»: `where user_id=U and resolved_at is null and due_at<=now order by due_at` (индекс `review_queue_due_idx`).

### 6.3. Колея 3 — `module-review.ts`
- Закрытие модуля (UC-14) создаёт `module_review` r7 (`due=+7д`) и r21 (`due=+21д`), `taken_at=null`.
- Прохождение квиза: `taken_at=now`, `score`, `passed = score≥80`.
- Оба (r7 и r21) `passed=true` → `user_module_state.status='mastered'`, `mastered_at=now`.
- Провал ревью → создать `review_queue_item` по типам заданий, где промахи (возврат тем в колею 2).
- Порог 80% — из PLAN §4 (не из `checkpoint.pass_mark`; чек-пойнты — отдельная механика).

### 6.4. Колея 1 — `srs.ts` (SRS)
- Схема `card_state` (`phase`,`due_at`,`interval_days`,`ease`,`reps`,`lapses`) и рейтинги 1–4 (Again/Hard/Good/Easy) в `card_review_log` — **алгоритм-агностичны** (комментарий в 0001: «SM-2 / FSRS both fit»).
- **Решение MVP: SM-2** (проще FSRS, покрывает 4 рейтинга; интервалы на кнопках мокапа — Again 10 min, Hard 2 d, Good 4 d, Easy 8 d — как presentational-подсказки).
  - `new/learning`: короткие шаги (Again→10 min, Good→1 d, Easy→выход в review с interval из ease).
  - `review`: `Good` → `interval *= ease`; `Hard` → `interval *= 1.2`, `ease -= 0.15`; `Easy` → `interval *= ease * 1.3`, `ease += 0.15`; `Again` → `phase='relearning'`, `lapses++`, `ease -= 0.2`, короткий шаг.
  - `ease` в границах [1.3, 2.5+]; `reps++` на успех.
- Новые карточки модуля вводятся `flashcards_intro`: массовое `card_state(phase='new', due_at=now)` для всех `flashcard` модуля. На первом заходе большого объёма — раскидать `due_at` по дням (порт `spreadInitialDueDate` из референса), чтобы дневная очередь была посильной.
- Функция чистая: `review(state, rating, now) → nextState` — тестируется без БД.

### 6.5. Статусы — `module-state.ts`
- **Module:** `locked → upcoming → in_progress → completed → mastered` (правила выше). Первый модуль курса стартует `upcoming`; при первом входе → `in_progress`.
- **Открытие следующего модуля:** MVP-правило — модули блока открываются последовательно: завершение модуля N (`completed`) → модуль N+1 `locked→upcoming`. Блок открыт, пока не пройден его чек-пойнт. (Правило-кандидат, см. D5.)
- **Checkpoint:** `locked → available → passed/failed`. Блочный: `available`, когда все модули блока `completed`+. `passed` при `best_score ≥ pass_mark` → модули следующего блока `upcoming`. Диагностика — всегда доступна, `pass_mark=null`, не блокирует.
- **Block (визуальный):** `pct` = доля mastered/completed модулей; футер = статус чек-пойнта.

---

## 7. Маршруты страниц и карта компонентов

### 7.1. Роуты (App Router)

| Роут | UC | Тип | Данные (use-case) | Формы (content.js) |
|---|---|---|---|---|
| `/` | UC-01 | RSC | `getToday(U)` | `SKY.today` |
| `/course` | UC-02 | RSC | `getCourseMap(U, courseSlug)` | `SKY.blocks`, `SKY.course` |
| `/course/[courseSlug]/module/[moduleSlug]` | UC-05..08 | RSC + острова | `getUnit(U, moduleSlug)` | `SKY.unit` |
| `.../module/[moduleSlug]/session/[sessionType]` | UC-13..14 | RSC + острова | `getSession(U, moduleSlug, sessionType)` | `SKY.today.steps`, `SKY.unit.sessions` |
| `/review` | UC-16,17 | RSC | `getReviewHub(U)` | `SKY.review.lanes` |
| `/progress` | UC-04 | RSC | `getProgress(U, courseSlug)` | `SKY.progress` |
| `/flashcards` | UC-15 | RSC-обёртка + client-плеер | `getDueCards(U)` | `SKY.flashcards` |

Экран упражнений (UC-09) — **не отдельный роут**, а модальный клиент-остров (`ExercisePlayer`) внутри страницы сессии/модуля/ревью/чек-пойнта (в мокапе это overlay `screen:'ex'`). Аналогично `FlashcardPlayer` может открываться поверх Today/Review (в мокапе `screen:'fc'`).

Навигация: на десктопе — левая рельса (`SideRail`), на мобильном — нижний таб-бар (`BottomNav`); переключение по `isDesktop` (в мокапе `window.innerWidth>=980`). Оболочка — `app/layout.tsx`.

### 7.2. Компоненты и где чистый SSR / где острова

**Чистый SSR (RSC, без интерактива):** `TodayCard`, `SessionSteps` (список), `CourseMap` (блоки/модули), `UnitHeader`, `GoalsList`, `SessionRibbon`, `GrammarSpotlight`, `WatchoutBox`, `VocabStudio` (список), `ProgressStats`, `ProgressBars`, `Ladder`, `ReviewLanes`, `Launcher`. Данные приходят из use-case уже готовой формы (совпадающей с `content.js`).

**Клиентские острова (`'use client'`, состояние + server actions):**
- `ExercisePlayer` (UC-09) + 8 под-компонентов по `type_code`. Состояние очереди/фазы (`ans`/`chk`), точки-прогресс, harvest. На проверку и на harvest дёргает server actions (`gradeAndRecord`, `harvestError`). Порт логики из `Skyrocket.dc.html` (`pick/tapWord/pickL/pickR/check/next`), но `is_correct` — с сервера.
- `FlashcardPlayer` (UC-15): flip + 4 оценки → `reviewFlashcard` action.
- `ReadingText` (UC-07): тап-раскрытие глосс, «Add to deck» → `addGlossToDeck` action. Глоссы **джойнятся** по ключу (props содержат текст + словарь глосс).
- `VocabStudio` может быть островом, если нужна отметка приоритета (иначе SSR).
- `WritingEditor` (UC-10): textarea + счётчик слов → `submitWriting`.
- Свитчер курса, боттом-нав/рельса (клиент для активного состояния и навигации).
- `AudioProvider` + `PlayButton` + `DownloadModuleAudio` (§4.8): `AudioProvider` монтируется один раз в `app/(app)/layout.tsx` вокруг `children` и держит единственный на всё приложение `<audio>`-элемент (`play`/`playSequence`/`stop`/`prefetch`) — «играет ровно один клип» следует из того, что элемент один, а не из координации между кнопками. `PlayButton` — тонкий остров (`null`, если у DTO нет клипа), встроенный в серверные `GrammarSpotlight` (у `row.example`) и `WatchoutBox` (у строки ✓, никогда у `bad_example`); в клиентском `VocabStudio` — у `term` и перед каждым `use_cases[i]`; в клиентском `ReadingText` — кнопка `[▶ Play all]` над текстом и кнопка на каждом абзаце, обе через `playSequence` по предложениям абзаца, с подсветкой играющего абзаца. `DownloadModuleAudio` на странице модуля одним сообщением `prefetch(urls)` просит service worker закешировать весь список клипов модуля целиком — прогресс идёт отдельными `postMessage` от `public/sw.js`, а не через `AudioContext`.

**Данные для островов** передаются из RSC как сериализованные props (после `serialize.ts`), в форме `content.js`. Острова не читают БД.

**Кеш аудио** — `public/sw.js`, единственный service worker приложения: перехватывает только `GET /audio/**`, всё остальное (навигации, server actions, другие origin'ы) пропускает нетронутым — нет ни одного `respondWith` вне этой ветки. Стратегия cache-first безопасна именно потому, что путь клипа — хеш нормализованного текста (§8 D15): один и тот же URL никогда не начнёт отдавать другие байты, второй заход не обязан спрашивать сеть о свежести. Обязательна ветка `Range`: медиа-элементы всегда шлют `Range: bytes=0-` для проверки перемотки, поэтому воркер режет закешированное тело на `206` сам, а не отдаёт только то, с чем впервые встретился.

---

## 8. Открытые вопросы (с предлагаемым решением)

Ниже — расхождения между схемой БД, контент-пакетом и мокапом. В ТЗ §9 заложено **предлагаемое** решение.

**D1 · Нет стабильных натуральных ключей у `exercise`, `writing_task`, `flashcard`.** Угроза потери прогресса (особенно SRS `card_state`) при пересинке. → **Решение:** миграция `0003` добавляет `ident` + partial-unique (см. §4.5); синк ключует по `ident`. Обновить DATA-MODEL и артефакт схемы. **Приоритет — высокий, блокирует корректный sync.**

**D2 · Коды типов упражнений: длинные (БД/пакет) vs короткие (мокап `content.js`).** БД `type_code`: `grammar_drill`, …; мокап `type`: `drill/error/kwt/open/read/mc/match/wf`. → **Решение:** канонический — длинный `type_code` (совпадает с сидом `exercise_type` и с `type:` в `exercises.yaml`). Плеер держит внутреннюю мапу `type_code → компонент`. Короткие коды мокапа не используются.

**D3 · Форма `content jsonb`: `answer_shown` (пакет, snake_case) vs `answerShown` (мокап, camelCase); глоссы инлайн (мокап) vs нормализованы (БД).** DATA-MODEL заявляет «формы один-в-один с дизайном», но пакет использует snake_case и нормализованные глоссы (`{g:key}` + таблица `gloss`). → **Решение:** канон — **форма пакета** (snake_case, нормализованные глоссы). `content jsonb` в БД = объект `content:` из YAML **дословно**. Плеер и `ReadingText` пишутся под форму пакета; мокап — референс интеракции/вёрстки, а не буквальный контракт имён полей. Zod-типы (`content-schema.ts`) фиксируют канон.

**D4 · Число модулей/блоков: PLAN и seed — 15 модулей (Блок D = 3, M13–M15); мокап `content.js` — 16 (4×4).** Плюс имена/цвета блоков и модулей в мокапе иллюстративные (Блок 1 красный «Time & tense» vs seed синий «Work & Careers»), лексики «18» vs 45. → **Решение:** источник истины — seed `0002` + пакеты. Фронт читает имена/цвета/число модулей из БД, **ничего не хардкодит** (ни «4 модуля на блок», ни палитру). `content.js` — только формы данных.

**D5 · Правило разблокировки модулей внутри открытого блока не задано явно.** PLAN подразумевает последовательность, мокап показывает M09 `In progress`, M10–M12 `Upcoming`. → **Решение (MVP):** последовательное открытие внутри блока (завершил N → открылся N+1); блок целиком гейтится чек-пойнтом. Вынести в конфиг курса, чтобы менять без кода. Продуктовое решение — за владельцем.

**D6 · «Отметить 10 приоритетных лексем» (Prime) не имеет поля в схеме.** `user_vocab_state` хранит только `status`. → **Решение (MVP):** отметка приоритета = перевод лексемы `new→learning` (появляется в фокусе). Если нужен отдельный флаг «priority» — добавить колонку в будущей миграции; пока не блокирует.

**D7 · `bigint` PK → JS `BigInt` в Prisma.** Не сериализуется в JSON/props. → **Решение:** DTO-граница в репозиториях приводит id к `number` (`lib/serialize.ts`); безопасно при single-user. Domain оперирует `number`.

**D8 · Хранение аудио монолога (`writing_submission.attachment_url`).** Куда класть запись (speaking-модули). → **Решение (MVP):** для одного пользователя — либо загрузка в Netlify Blobs / внешний бакет и хранение URL, либо на первом этапе кнопка «mark done» без файла (`attachment_url=null`), а запись — вне приложения. Полноценную запись/загрузку вынести в отдельную задачу. Не блокирует этапы 2–4.

**D9 · Что вообще лежит в колоде.** Изначально: три типа заметок (vocab, grammar_cloze, transformation), одна строка = одна нота, двусторонность — «UI-режим показа, не вторая строка». → **Пересмотрено (2026-07, миграция `0005`)** после того, как в ежедневном ревью всплыла grammar-cloze карточка с невырезанной Anki-разметкой `{{c1::…}}`: ответ был виден на лицевой стороне, то есть карточка не работала вовсе. Разбор показал, что сломан не рендер, а само разделение.

**Решение — колода только лексическая, задания только в колее 2:**
- `grammar_cloze` убран. `theory.yaml (cloze_cards)` синкается как упражнения `open_cloze` в review-пул модуля (`clozeCardToExercise` в `scripts/sync.ts`): `{{c1::X}}` → `{pre, post, answers:[X], answer_shown:X}`, `hint` → подсказка-основа, `rule` → `explanation`. Так они попадают в module quiz и r7/r21, а промах открывает элемент колеи 2.
- `transformation` убран как дубликат: карточка деривировалась из `key_word_transformation`, который и так лежит в `exercises.yaml` core-пулом.
- Двусторонность лексики — **две строки**, а не режим показа: `vocab` (front=term, main=definition) и `vocab_reverse` (front=definition, main=term), у обеих `cases=use_cases[0..1]`, `extra=Collocations+Register`. Узнавание и воспроизведение — разные навыки с разной кривой забывания, а `card_state` (PK = user+flashcard) умеет вести только один график на строку. Это прямо отменяет исходную формулировку D9.
- Старые строки не удаляются: `0005` ставит им `archived=true`, `card_state` и ссылки `error_map_entry.flashcard_id` остаются. `listDueCards` фильтрует по `archived=false`, поэтому они просто перестают выпадать. Архивируются и harvest-карточки (`source='error_harvest'`) — у них те же note-типы, которые приложение больше не рендерит.
- Миграция обнуляет `module.content_hash` для `en-c1`: гейт-хеш §4.4 считается от байтов YAML, а изменилась логика деривации — без сброса sync пропустил бы все модули с нулём запросов, в том числе на билде.

Отдельные Anki-CSV отменены ещё раньше (2026-07): карточки живут только в webapp-SRS, экспорт в Anki не поддерживается.

**D10 · Auth.** Раньше: `scripts/seed-user.ts` создавал единственного пользователя, `getCurrentUserId()` возвращал его закэшированный id. → **Пересмотрено (2026-07):** сид-пользователь удалён, аккаунты заводятся сами через `/register`; билд обязан собираться на БД без единого пользователя.

**Решение — cookie-сессия на двух JWT (HS256, ключ `AUTH_JWT_SECRET`):**

- **Токены** (`lib/auth/tokens.ts`): access (15 мин) и refresh (30 дней), оба в httpOnly-куках `sr_access`/`sr_refresh` (`SameSite=lax`, `Secure` вне dev). В payload — `sub` (id) и `username`; поле `kind` различает типы, иначе refresh принимался бы вместо access и короткий TTL терял бы смысл. Импорт `jose` — подпутями (`jose/jwt/sign`, `jose/jwt/verify`), баррель тянет JWE-ветку с `DecompressionStream`, на которую Next ругается в Edge.
- **Обновление — только в `middleware.ts`.** Access протух, refresh жив → выписывается новый access и кладётся и в `request` (чтобы текущий рендер уже видел сессию), и в ответ. Одна точка продления позволяет `lib/auth/session.ts` доверять access-куке безусловно. Middleware работает в Edge и БД не трогает: всё нужное — в подписанном токене (удалённый из БД пользователь доживает до истечения токена; страницы всё равно падают на своих же запросах).
- **Гейтинг** — там же: без сессии → `/login?next=<путь>`; с сессией на `/login`/`/register` → `/`. Битый refresh чистится, чтобы не проверять мёртвый токен на каждом запросе.
- **Идентичность** — `lib/current-user.ts` (`getCurrentUserId()`), как и планировалось, единственное изменённое место: подписи репозиториев и use-cases не тронуты. Кэш `cachedUserId` убран — модульный кэш общий для параллельных запросов и отдал бы одному пользователю id другого.
- **Разделение экранов** — route groups: `app/(app)/*` (шелл с навигацией, `force-dynamic`) и `app/(auth)/*` (логин/регистрация, без обращений к сессии и БД). Корневой layout — только `<html>/<body>`, поэтому auth-страницы рендерятся для гостя.
- **Прогресс по пользователям** — держится на том, что все прогресс-таблицы имеют `user_id`, а enrollment и первый модуль материализуются лениво (`ensureActiveEnrollment` / `ensureFirstModuleUnlocked`) при первом заходе на дашборд. Регистрация создаёт только строку `app_user`.
- **Пароли** — bcrypt (cost 12) в `lib/use-cases/auth.ts`. Username нормализуется в lowercase; при неизвестном логине сравнение идёт с фиктивным хешем, чтобы время ответа не выдавало существующие аккаунты; сообщение об ошибке одно на оба случая.
- Миграция не понадобилась: `app_user(username, password_hash)` существует с `0001_init.sql`.

**D11 · Гейтинг сессий внутри модуля.** UC-13 описывал последовательность только нарративно; сессии были кликабельны в любом порядке, из-за чего было непонятно, «когда появится Session 3». → **Решено (утверждено владельцем):** жёсткий последовательный гейтинг. `lib/domain/session-gating.ts::computeSessionCells` — первая не-`done` сессия = `current`, все после неё = `locked`, `done` открыты для повтора; отдельной колонки в БД нет, состояние выводится из `user_session_state.status` + `position`. `getSession` для `locked` возвращает `{kind:'locked'}` → redirect на хаб; `SessionRibbon` рендерит `locked` не-ссылкой с подписью «Finish Session N−1 first». Правильность ответов в упражнениях прохождение **не** гейтит (ошибки уходят в очередь повторений — это осознанный дизайн); единственный скоринг-порог — module quiz (80%+ в сторону Mastered). Пошаговый гейтинг `advanceStep` по id шага не делаем (single-user MVP; шаги достижимы только из отрендеренных страниц).

**D12 · Цели модуля не были связаны с прогрессом.** `module.goals` был массивом строк, цели рендерились статикой. → **Решено:** `meta.yaml` `goals` — объекты `{text, achieved_by: prime|input|workout|output}` (голая строка валидна и мапится в `output`); sync нормализует в jsonb `[{text, achieved_by}]`; `computeGoalStatus` (session-gating.ts) считает `todo/in_progress/achieved` из состояния сессий; хаб рендерит `GoalsProgress` — цели загораются снизу вверх по мере прохождения сессий. Микро-цели шагов живут в `session_step.detail` (переписаны в 0004 как цели) и показываются в карточке «Step K of M · Goal».

**D13 · Чек-пойнт не может нести справочный материал — только упражнения.** `grammar_spotlight`, `watchout` и `reading_text` привязаны к модулю через `module_id NOT NULL`, а `syncCheckpoint` читает лишь `exercises.yaml` (+ опциональный `writing.yaml`). Всплыло на курсе de-a2: по плану (`courses/de-a2/PLAN.md` §5) диагностика должна вводить **Grammatik-Wörterbuch** — глоссарий немецких грамматических терминов, за пределы которого модули не выходят. Это обязательное условие иммерсии на A1: без метаязыка немецкие объяснения нечитаемы. Прицепить его к чек-пойнту оказалось некуда.

→ **Обходное решение (в проде сейчас):** глоссарий подан тремя `collocation_match` в начале `diagnostic/exercises.yaml` — термин × пример, разбор в `explanation`. Работает как retrieval practice и ничего не ломает, но это упражнение, а не справочник: к нему нельзя вернуться из модуля, и лимит теории модуля (≤2 spotlight'а на A-уровнях) он обходит боком.

→ **Предлагаемое решение:** миграция — `grammar_spotlight.module_id` делается nullable, добавляется `checkpoint_id` и CHECK-констрейнт вида `exercise_owner` (ровно один владелец); `syncCheckpoint` начинает читать опциональный `theory.yaml`; страница чек-пойнта получает секцию с теорией. Открытый подвопрос: справочник уровня **курса**, а не чек-пойнта, — Grammatik-Wörterbuch логичнее держать доступным из любого модуля, и тогда владельцем должен быть `course_id`, а в навигации нужен раздел «Справочник». **Приоритет — средний:** обходное решение держит de-a2, но каждый новый курс на A-уровне упрётся в то же самое.

**D14 · Хаб модуля не загейчен, в отличие от сессий.** `/course/<slug>/module/<slug>` отдаёт 200 для модуля со статусом `locked` — карта курса просто не рисует ссылку, а сессии внутри гейтит D11. Поведение существует с этапа 4 и одинаково для обоих курсов; на de-a2 оно заметнее, потому что у заблокированных модулей ещё нет контента, и хаб рендерится полупустым. → **Предлагаемое решение:** `getUnit` возвращает `{kind:'locked'}` для модуля, чей `user_module_state.status = 'locked'`, страница делает redirect на `/course` — ровно тем же приёмом, что `getSession` (D11). Не блокирует: попасть туда можно только вручную набрав URL.

**D15 · Адресация аудио-клипа: по тексту, а не по позиции модуля/шага.** Простейшая схема — привязать клип к `(module_id, position)` того же поля, которое он озвучивает. Она ломается на первой же правке: перестановка слова в `vocab.yaml` или переписанное предложение текста молча продолжили бы отдавать **старую озвучку** под новым текстом, потому что строка всё ещё сидит на том же слоте. → **Решение:** `audio_clip` (`db/migrations/0009_audio_clip.sql`) ключуется по `(lang, text_hash, profile)`, где `text_hash = sha256(normalizeAudioText(text))` (`lib/domain/audio-text.ts`) служит натуральным ключом — тот же приём, что `exercise.ident`/`flashcard.ident` (§4.5): ключ выводится из содержимого, поэтому правка содержимого сама меняет ключ, а не только его атрибуты. Правка озвученной строки в YAML меняет её хеш → старая запись просто перестаёт находиться, кнопка ▶ пропадает до следующего `pnpm audio`, а не подставляет чужое произношение под новый текст. У `audio_clip` даже нет отдельной колонки `content_hash` — `text_hash` одновременно и ключ поиска, и единственное, что вообще может «устареть»; изменения остальных полей (`clip_key`, `path`, `voice` при смене референсного голоса) синк сверяет напрямую, как у `gloss`. Приложение никогда не переимплементирует собственно ключ `tts-mcp` (`clip_key` = engine+voice+profile+profile_version+text) — тот приезжает в манифесте и только копируется в БД; из БД приложение всегда спрашивает одно и то же: «есть ли клип для этого нормализованного текста».

Клип = одно предложение, а не абзац: Chatterbox рендерит вход одним авторегрессивным проходом без внутреннего разбиения на предложения (в отличие от Piper, который сам режет текст на `join_sentences`) — абзац на 400–600 символов для такой модели прямой риск обрыва или галлюцинации, а встроенная проверка движка смотрит только на хвост клипа. `scripts/audio.ts` синтезирует по `splitSentences()`, а `ReadingText` (§7.2) склеивает клипы предложений одного абзаца в очередь через `playSequence` — слушатель по-прежнему слышит один непрерывный абзац, разбиение на предложения — деталь пайплайна синтеза, а не что-то заметное в интерфейсе.

---

## 9. Детальные ТЗ трёх исполнителей

Общий инвариант для всех: не редактировать существующие миграции; контент — English only; документы — по-русски; соблюдать границы слоёв §2.

### Этап 2 — Каркас `web/` + миграции + sync

**Границы:** поднять проект, наладить применение схемы и заливку контента. Без экранов и без бизнес-логики повторений.

**Входы:** `db/migrations/0001,0002`; `courses/en-c1/content/module-01/*` и `docs/CONTENT-PACKAGE-SCHEMA.md`; референс `../concurrency/web` (структура, `sync.ts`, `db.ts`, `docker-compose.yml`, `netlify.toml`); §2–§4 этого документа.

**Артефакты:**
1. Каркас `web/` (Next.js 15 + React 19 + Tailwind, TS), `next.config.mjs`, `tsconfig.json` (paths `@/*`), `docker-compose.yml` (Postgres 16, БД `skyrocket`), `.env.example` (`DATABASE_URL`, `DIRECT_URL`; `APP_USER_USERNAME` заменён на `AUTH_JWT_SECRET` в 2026-07, см. D10).
2. Корневой `netlify.toml` (`base="web"`, `@netlify/plugin-nextjs`), build = `migrate → sync → next build`.
3. `db/migrations/0003_content_natural_keys.sql` (§4.5) + правка `docs/DATA-MODEL.md` + переопубликованный артефакт схемы.
4. `scripts/migrate.ts` (§3.2) — идемпотентный раннер на `pg` с `schema_migrations` и `--baseline`.
5. `prisma/schema.prisma` через `prisma db pull` (после применения 0001–0003), закоммичен; `postinstall: prisma generate`; `lib/db.ts` (singleton), `lib/serialize.ts` (BigInt→number).
6. `content.config.ts` (реестр курса/модулей/чек-пойнтов), `lib/content-schema.ts` (zod для всех YAML, юнион 8 типов `content`).
7. `scripts/sync.ts` (§4): обход, парсинг YAML, upsert по натуральным ключам/`ident`, content_hash (модульный гейт + пер-сущностный), порядок с учётом FK, прунинг (флешкарты — soft-archive), счётчики в лог.
8. ~~`scripts/seed-user.ts` + `lib/current-user.ts` (`getCurrentUserId()` → константный id).~~ — отменено в 2026-07, см. D10: сид-пользователя больше нет, `getCurrentUserId()` берёт id из cookie-сессии.

**Definition of Done:**
- `docker compose up` + `pnpm migrate` применяет 0001–0003 на чистой БД без ошибок; повторный `pnpm migrate` = 0 применённых.
- `pnpm sync` заливает `module-01`: проверяемо `select count(*)` → `vocab_entry=45`, `exercise` core=66 + review=30 (`select pool,count(*) ... group by`), `grammar_spotlight`/`watchout`/`reading_text(main,extra)`/`gloss`/`writing_task`/`flashcard` (45+10+8) присутствуют; `grammar_point` из meta (5) с корректными `user`-независимыми связями `exercise.grammar_point_id`.
- Повторный `pnpm sync` без правок контента = `~0 +0` (все `=unchanged`), 0 записей (доказать логом счётчиков).
- Правка одной use-case в `vocab.yaml` → re-sync обновляет ровно одну строку (`~1`), остальные `unchanged`; `id` строки не изменился (доказать, что натуральный ключ стабилен).
- Удаление сущности из пакета → строка удалена (или флешкарта `archived=true`); прогресс других строк не затронут.
- `prisma db pull` + `prisma generate` проходят; `pnpm build` (migrate→sync→next build) зелёный локально.
- `next dev` поднимает пустую оболочку (можно placeholder-страницу).

### Этап 3 — Бэкенд: domain + use-cases + repositories + server actions

**Границы:** вся серверная логика без вёрстки экранов. Отдаёт use-cases (для RSC) и server actions (для островов), покрытые типами.

**Входы:** результат этапа 2 (Prisma-клиент, sync, схема); §1 (use cases), §5 (грейдинг), §6 (алгоритмы), референс `lib/actions.ts`/`lib/leitner.ts`.

**Артефакты:**
1. `lib/domain/`: `time.ts`, `srs.ts` (SM-2, §6.4), `review-queue.ts` (§6.2), `module-review.ts` (§6.3), `module-state.ts` (§6.5), `progress.ts` (§6, §1.1), `grading/` (`normalize.ts`, `index.ts`, `graders/*` — 8 типов §5), `types.ts`. Всё — чистые функции, покрыты юнит-тестами.
2. `lib/repositories/*`: типизированные выборки/записи (единственное место с Prisma), возвращают DTO с id:number.
3. `lib/use-cases/*`: `getToday`, `getCourseMap`, `getUnit`, `getSession`, `getReviewHub`, `getProgress`, `getDueCards`, `startExerciseSet`, `gradeAndRecord`, `reviewFlashcard`, `takeModuleReview`, `takeCheckpoint`, `submitWriting`, `switchCourse`, `harvestError`, `addGlossToDeck`, `advanceStep/closeSession/closeModule`. Формы возврата чтения = `content.js`.
4. `app/actions/*` (`'use server'`): тонкие обёртки (`getCurrentUserId()` → use-case → `revalidatePath`).
5. Транзакционность критичных цепочек (`$transaction`): закрытие модуля (module_state + 2×module_review), оценка карточки (card_state + card_review_log + daily_activity), grade (attempt + review_queue + activity).

**Definition of Done:**
- Юнит-тесты domain зелёные: все 8 грейдеров на корректных/некорректных ответах (включая нормализацию мультиответов kwt и `misses`-правило match); SM-2 на 4 рейтингах; переходы review-queue 1→2→3 и сброс; r7+r21 → Mastered; переходы module-state/checkpoint.
- Интеграционный прогон на локальной БД (после sync module-01): `getToday(U)`/`getUnit(U,'m01')`/`getSession(U,'m01','input')` возвращают непустые формы, совпадающие по ключам с `SKY.*`.
- Сквозной сценарий скриптом: ответить неверно в сессии → `exercise_attempt` + open `review_queue_item(stage1,+2д)`; закрыть модуль квизом → `completed` + 2 `module_review`; оценить карточку → `card_state`/`card_review_log`/`daily_activity` обновлены. Проверяется SQL-выборками (типовые запросы из DATA-MODEL используют нужные частичные индексы — `explain`).
- Пересинк контента после наигранного прогресса не рушит прогресс (id стабильны).
- `getCurrentUserId()` — единственный источник userId; ни одна функция не хардкодит id внутри логики.

### Этап 4 — Фронтенд по утверждённому дизайну

**Границы:** экраны и острова по мокапу; данные — только из use-cases/actions этапа 3. Никакого доступа к БД из компонентов.

**Входы:** результат этапа 3; `docs/design/skyrocket/` (`Skyrocket.dc.html` — вёрстка/стили/интеракция, `content.js` — формы, `support.js` — рантайм-референс); §7 (роуты/компоненты), §1 (UC), §5 (интеракция плеера).

**Артефакты:**
1. Оболочка `app/layout.tsx` + `globals.css`/Tailwind (перенести шрифты, палитру, атомы из мокапа; светлая тема, mobile-first PWA-каркас), `SideRail`/`BottomNav` с `isDesktop`.
2. Экраны RSC: Today, Course map, Unit overview, Session runner, Review hub, Progress (+ состояние «course completed») — вёрстка по `Skyrocket.dc.html`, данные из use-cases.
3. Острова: `ExercisePlayer` + 8 под-компонентов (по `type_code`), `FlashcardPlayer`, `ReadingText` (тап-глоссы + Add to deck), `WritingEditor` (+ счётчик слов), свитчер курса. Интеракция портируется из `Skyrocket.dc.html` (`pick/tapWord/pickL/pickR/check/next`, flip/grade), но проверка/оценка идут через server actions (`gradeAndRecord`, `reviewFlashcard`).
4. UI-примитивы (`Badge`, `Card`, `ProgressBar`, точки-прогресс упражнений, статус-теги модулей с цветом блока).

**Definition of Done:**
- Все экраны рендерятся из реальных данных БД (module-01 засинкан), визуально соответствуют мокапу (десктоп-рельса и мобильный таб-бар, цвета блоков из БД).
- Плеер упражнений проходит все 8 типов на данных `module-01`: выбор/ввод/тап/матч работают, фидбек и объяснение показываются, `is_correct` приходит с сервера; ошибка предлагает Harvest; финальная сводка (score/harvested/re-queue) верна.
- Флешкарты: flip + 4 оценки меняют `card_state` (проверяемо), очередь берётся из `getDueCards`.
- Reading: тап по глоссе раскрывает определение (джойн по ключу), «Add to deck» создаёт карточку.
- Сессия проходится сверху вниз: шаги отмечаются done, «Session 2 of 4» корректно; завершение сессии Output с квизом закрывает модуль и на карте статус → Completed.
- Прогон `/verify`-подобного сценария: пользователь открыл модуль → сделал набор упражнений → ошибся → увидел re-queue на Today; карта/Progress отражают изменения после `revalidatePath`.
- Нет доступа к Prisma/БД из `components/**` и клиентских файлов (только props + actions).

---

## 10. Сводка ключевых решений

1. **Prisma — только типизированный клиент через `prisma db pull`; миграции владеются raw SQL** и применяются раннером `scripts/migrate.ts` на `pg` (не `prisma migrate`, не `psql` на Netlify).
2. **Слои:** `domain` (чистая логика, тестируется без БД) → `use-cases` (оркестрация) → `repositories` (единственное место с Prisma) → `app/components` (UI). Prisma не течёт в UI; domain не течёт наружу.
3. **Sync** идемпотентен по `content_hash` (модульный гейт + пер-сущностный), ключует по натуральным ключам, прунит удалённое (флешкарты — soft-archive), не трогает прогресс. Требует **миграцию 0003** (`ident` для `exercise`/`writing_task`/`flashcard`) — иначе пересинк ломает SRS-прогресс.
4. **Грейдинг — серверный**, единая точка `gradeAttempt(type_code, content, given)`; 8 типов с явными контрактами `content`/`given_answer`; текст нормализуется как в мокапе.
5. **Три колеи** вынесены в чистый domain: SM-2 (колея 1), +2/+7/+21 re-queue (колея 2), r7/r21→Mastered порог 80% (колея 3).
6. **Роуты** — 6 RSC-страниц; упражнения и карточки — модальные клиентские острова, не отдельные роуты; данные островам приходят props в формах `content.js`.
7. **Один пользователь** через `getCurrentUserId()`; весь код параметризован `userId` — мультиюзер добавляется без переделки (точка расширения — `lib/current-user.ts`).
8. **Источники истины при конфликте:** SQL-схема > контент-пакет > PLAN > мокап. Мокап `content.js` — контракт **форм данных**, но не буквальных имён (канон полей — из пакета: длинные `type_code`, snake_case, нормализованные глоссы).
9. **Netlify build:** `prisma generate` → `migrate` → `sync` → `next build`; Neon — `DATABASE_URL` (пулер, рантайм) + `DIRECT_URL` (прямой, билд-скрипты); локально — Postgres 16 в Docker.
10. **10 открытых вопросов зафиксированы** с предлагаемыми решениями, заложенными в ТЗ (ключевой — D1: стабильные натуральные ключи).
11. **Аудио (de-a2, §4.8)** — курсы с `language: de` озвучивают часть контента оффлайн (`pnpm audio` + Chatterbox), клипы адресуются по тексту, а не по позиции (D15); коммитируемый `courses/<slug>/audio/manifest.json` синкается отдельным гейтом `course.audio_manifest_hash`; блобы — иммутабельная статика `public/audio/**`, кешируется через `public/sw.js` (cache-first).
```
