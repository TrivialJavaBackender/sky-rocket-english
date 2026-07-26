# SkyRocket English

Персональная платформа изучения языков (первый курс — English B2+ → C1, позже немецкий). Движок курс-агностичный: контент = типизированные данные, приложение их рендерит. Репозиторий — **source of truth**; веб-артефакты — только витрины.

## Карта репозитория

Репозиторий делится надвое: **`docs/` — родовое** (метод и инженерия, общее для всех курсов), **`courses/<slug>/` — курсовые программы**. В `docs/` нет ничего про конкретный курс, в `courses/` нет ничего про метод.

| Путь | Что это |
|---|---|
| `docs/COURSE-DESIGN-GUIDE.md` | **Как спроектировать курс**: расчёт объёма от бюджета часов, дозирование теории по уровням, протокол сессий, каталог упражнений, DoD курса. Отсюда начинается любой новый курс |
| `docs/CONTENT-PACKAGE-SCHEMA.md` | Схема контент-пакета модуля и `course.yaml` (родовая, для всех языков) |
| `docs/MODULE-TASK-TEMPLATE.md` | Шаблон ТЗ субагенту на генерацию модуля + Definition of Done (параметризован курсом) |
| `docs/DESIGN-BRIEF.md` | Бриф, по которому сделан утверждённый дизайн |
| `docs/design/skyrocket/` | Утверждённый дизайн (mockup). `content.js` — **образцовые формы данных всех экранов**, схема БД следует им |
| `docs/DATA-MODEL.md` | Схема данных: ER-диаграммы, справочник таблиц, решения, полный SQL |
| `docs/ARCHITECTURE.md` | **Архитектура веб-приложения**: каталог use cases, слои, дизайн sync, грейдинг 8 типов, роуты/компоненты, вопросы-решения D1–D15 |
| `docs/METHODOLOGY-REVIEW.md` | Методический аудит (2026-07): сверка протокола с лучшими практиками (Nation, CELTA, плато B2→C1), рекомендации P1–P3 (аудирование, fluency, noticing) |
| `courses/en-c1/` | **Курс English B2+ → C1, 80 ч.** `PLAN.md` — канонический план, `course.yaml` — скелет, `content/` — пакеты модулей, `plan.html` — витрина |
| `courses/de-a1/` | **Курс Deutsch с нуля → A1, 54 ч.** `PLAN.md` + `course.yaml`; двуязычный — немецкое ядро + английский метаязык объяснений (PLAN.md §5); контент модулей ещё не сгенерирован |
| `courses/de-a2/` | **Курс Deutsch A1 → A2, 54 ч.** `PLAN.md` + `course.yaml`; контент модулей ещё не сгенерирован |
| `courses/<slug>/audio/` | Коммитируемый `manifest.json` озвучки (сейчас только de-a2, `language: de`) — генерируется `web/scripts/audio.ts` (`pnpm audio`, нужен локальный tts-mcp + GPU) из `content/`, синкается в `audio_clip` через `pnpm sync`. Блобы `.opus` — `web/public/audio/` |
| `db/migrations/` | SQL-миграции Neon Postgres: `0001_init.sql` (DDL + сид типов упражнений), `0002`/`0004` (каркас en-c1 и пересев шагов — **история**, скелет теперь в `course.yaml`), `0003_content_natural_keys.sql` (`ident`-ключи sync), `0005_cards_words_only_vocab_reverse.sql` (колода только лексическая + reverse-сторона), `0006_course_skeleton_from_yaml.sql` (`course.skeleton_hash` — гейт скелета), `0009_audio_clip.sql` (`audio_clip` + `course.audio_manifest_hash` — тот же гейт-паттерн для аудио-манифеста) |
| `web/` | Приложение: Next.js 15 (App Router, SSR) + React 19 + Prisma + Tailwind. Слои: `lib/domain` (чистая логика) → `lib/use-cases` → `lib/repositories` (единственное место с Prisma) → `app`/`components`. `scripts/migrate.ts` — раннер raw SQL миграций, `scripts/sync.ts` — синк скелета и контента, `scripts/validate-content.ts` — офлайн-валидатор контент-пакета (те же zod-схемы, без БД) + печать чисел профиля, `content.config.ts` — список корней курсов |
| `netlify.toml` | Деплой: `base = "web"`, @netlify/plugin-nextjs; билд = generate → migrate → sync → next build |

## Жёсткие правила

1. **Целевой язык в ядре; метаязык объяснений — по уровню.** Целевое ядро (термины, примеры, тексты, рамки заданий, ответы, модельное письмо) — строго на целевом языке. Объяснительные леса (`explanation`, определения, глоссы, чек-листы, `goals`, заголовки шагов) — на **метаязыке курса**, объявленном в `courses/<slug>/PLAN.md` §5 и выбранном по уровню: A1–A2 → bridge (по умолчанию English), B1+ → полное погружение (метаязыка нет). en-c1 и de-a2 — погружение (только целевой язык); de-a1 — немецкое ядро + английские леса. Граница по полям — `docs/COURSE-DESIGN-GUIDE.md` §10. Планы курсов и `docs/*.md` — по-русски.
2. **Source of truth — репозиторий.** Артефакты обновляются публикацией локального файла с параметром `url` (см. ниже), а не правкой «в вебе».
3. **Контент отделён от прогресса.** Контент-таблицы БД перезаливаются sync'ом идемпотентно; прогресс пользователя не трогается.
4. **Скелет курса — в `course.yaml`, не в SQL.** Блоки, модули, чек-пойнты и протокол сессий описываются декларативно и синкаются по натуральным ключам. Новый курс не требует миграции.

## Артефакты (витрины)

- План курса: https://claude.ai/code/artifact/a2ff798f-b789-4b5f-bcc6-b31ec622cb0e — публикуется из `courses/en-c1/plan.html`
- Схема данных: https://claude.ai/code/artifact/8fca3159-dcdb-41de-9de7-127d11d755e6 — публикуется из `docs/DATA-MODEL.md`

## База данных

Neon Postgres. Применение миграций: `pnpm migrate` (раннер `web/scripts/migrate.ts`). Структура курсов приходит не из SQL, а из `courses/*/course.yaml` через `pnpm sync`. Ядро схемы: `course → block → module` + `checkpoint` (ворота: diagnostic/block/final); контент (`grammar_spotlight`, `watchout`, `reading_text`+`gloss`, `vocab_entry`, `exercise` с `content jsonb` по 8 типам, `writing_task`, `flashcard` — только лексика, две стороны на слово); протокол (`study_session` 4 типа × `session_step`); прогресс — три колеи повторений (`card_state` SRS, `review_queue_item` +2/+7/+21 д, `module_review` r7/r21) + статусы (`user_vocab_state`, `user_grammar_state`, `user_module_state`).

## Стек-решения (утверждены)

Web app (mobile-first PWA) на Netlify + Neon по архитектуре `../concurrency` (Next.js 15 + Prisma, yaml → sync в БД на билде). Приложение реализовано в `web/` (см. `docs/ARCHITECTURE.md`). Auth — cookie-сессия на access/refresh JWT (`middleware.ts` + `lib/auth/*`, идентичность — `lib/current-user.ts`), регистрация через `/register`; прогресс у каждого пользователя свой (все прогресс-таблицы по `user_id`). Позже — обёртка Telegram Mini App для напоминаний. Vite-стаб в корне (`src/`, `index.html`, `vite.config.js`) — legacy, приложением не является.

Локальная разработка: `cd web && docker compose up -d && pnpm migrate && pnpm sync && pnpm dev` (env — `web/.env`, образец `web/.env.example`), затем завести аккаунт на `/register` — сид-пользователя нет, и билд собирается на БД без пользователей. Прод: Neon через `DATABASE_URL` (пулер) + `DIRECT_URL` (билд-скрипты) + `AUTH_JWT_SECRET` (ключ подписи токенов, ≥32 символов; смена разлогинивает всех).

## Рабочие процессы

- **Сгенерировать модуль:** команда `/gen-module <slug> <N…>` (`.claude/commands/gen-module.md`) — дешёвый путь: минимальный контекст, общий брифинг пачки в файл (а не в каждый промпт), `pnpm validate-content <slug> <dir…>` как валидатор у суб-агента и `pnpm sync` один раз у основного, пачка = блок параллельными суб-агентами, чек-пойнт после контента блока. Под капотом опирается на карточку модуля и «Профиль модуля» из `courses/<slug>/PLAN.md` и схему `docs/CONTENT-PACKAGE-SCHEMA.md`; `docs/MODULE-TASK-TEMPLATE.md` — исходный развёрнутый шаблон и DoD, которые команда замещает как точку входа.
- **Завести новый курс:** команда `/gen-course <lang> <level> [bridge]` (`.claude/commands/gen-course.md`) — дешёвый путь: research экзамена-ориентира → интерполяция объёма → `PLAN.md` + `course.yaml` + строка в `COURSE_ROOTS` (`web/content.config.ts`) + `content-gap-words/<lang>.ts` при новом языке → `pnpm sync`. Метаязык выбирается по уровню (A1–A2 → English, B1+ → погружение). Производит план, не контент (модули — `/gen-module`). Под капотом — чек-лист `docs/COURSE-DESIGN-GUIDE.md` §1; миграция не нужна.
- **Изменить план курса:** править `courses/<slug>/PLAN.md` (+ `plan.html`, если есть витрина), опубликовать артефакт с `url`.
- **Изменить структуру курса или протокол сессий:** править `courses/<slug>/course.yaml` и запустить `pnpm sync` — шаги апсертятся по `(study_session_id, position)`, прогресс не сбрасывается.
- **Обновить аудио курса** (только `language: de`): нужен локальный `tts-mcp` (`~/IdeaProjects/tts-mcp`, `.venv` с extra `[chatterbox]`, CUDA) — синтеза на Netlify нет и не будет. `cd web && pnpm audio -- --course <slug>` (`--module <slug>` — один модуль, `--dry-run` — отчёт без синтеза) прогоняет plan → synth → import и пишет блобы в `web/public/audio/<lang>/` + коммитируемый `courses/<slug>/audio/manifest.json`; следом `pnpm sync` заливает `audio_clip`. Движок нестабилен по одной попытке — `TTS_RENDER_MAX_ATTEMPTS` (переменная окружения `tts-mcp`, по умолчанию 3) переснимает брак автоматически, но не весь: строку вида «N phrase(s) never came out clean» в выводе `pnpm audio` нужно переслушать вручную (частый трудный случай — время вида `8:14`). Правка озвученного текста без последующего `pnpm audio` не подставляет старую озвучку — кнопка ▶ просто пропадает (`docs/ARCHITECTURE.md` §8 D15).
- **Изменить схему БД:** новая миграция `db/migrations/000N_*.sql` (существующие не редактировать), обновить `docs/DATA-MODEL.md`, переопубликовать артефакт схемы.
