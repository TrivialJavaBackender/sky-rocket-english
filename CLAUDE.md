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
| `docs/ARCHITECTURE.md` | **Архитектура веб-приложения**: каталог use cases, слои, дизайн sync, грейдинг 8 типов, роуты/компоненты, вопросы-решения D1–D14 |
| `docs/METHODOLOGY-REVIEW.md` | Методический аудит (2026-07): сверка протокола с лучшими практиками (Nation, CELTA, плато B2→C1), рекомендации P1–P3 (аудирование, fluency, noticing) |
| `courses/en-c1/` | **Курс English B2+ → C1, 80 ч.** `PLAN.md` — канонический план, `course.yaml` — скелет, `content/` — пакеты модулей, `plan.html` — витрина |
| `courses/de-a2/` | **Курс Deutsch A1 → A2, 54 ч.** `PLAN.md` + `course.yaml`; контент модулей ещё не сгенерирован |
| `db/migrations/` | SQL-миграции Neon Postgres: `0001_init.sql` (DDL + сид типов упражнений), `0002`/`0004` (каркас en-c1 и пересев шагов — **история**, скелет теперь в `course.yaml`), `0003_content_natural_keys.sql` (`ident`-ключи sync), `0005_cards_words_only_vocab_reverse.sql` (колода только лексическая + reverse-сторона), `0006_course_skeleton_from_yaml.sql` (`course.skeleton_hash` — гейт скелета) |
| `web/` | Приложение: Next.js 15 (App Router, SSR) + React 19 + Prisma + Tailwind. Слои: `lib/domain` (чистая логика) → `lib/use-cases` → `lib/repositories` (единственное место с Prisma) → `app`/`components`. `scripts/migrate.ts` — раннер raw SQL миграций, `scripts/sync.ts` — синк скелета и контента, `content.config.ts` — список корней курсов |
| `netlify.toml` | Деплой: `base = "web"`, @netlify/plugin-nextjs; билд = generate → migrate → sync → next build |

## Жёсткие правила

1. **Только целевой язык в контенте.** Внутри `courses/*/content/**` и всех учебных материалов (теория, определения, пояснения, карточки, чек-листы) — ни слова на языке-посреднике: en-c1 — только английский, de-a2 — только немецкий. Планы курсов и `docs/*.md` — по-русски.
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

- **Сгенерировать модуль:** взять промпт из `docs/MODULE-TASK-TEMPLATE.md`, подставить `{COURSE_SLUG}` и N, свериться с карточкой модуля и «Профилем модуля» в `courses/<slug>/PLAN.md` и схемой `docs/CONTENT-PACKAGE-SCHEMA.md`. Проверить по DoD (родовой + по профилю).
- **Завести новый курс:** пройти чек-лист `docs/COURSE-DESIGN-GUIDE.md` §1 — `PLAN.md` + `course.yaml` + строка в `COURSE_ROOTS` (`web/content.config.ts`) + список служебных слов языка в `web/lib/content-gap-words/<lang>.ts`, затем `pnpm sync`. Миграция не нужна.
- **Изменить план курса:** править `courses/<slug>/PLAN.md` (+ `plan.html`, если есть витрина), опубликовать артефакт с `url`.
- **Изменить структуру курса или протокол сессий:** править `courses/<slug>/course.yaml` и запустить `pnpm sync` — шаги апсертятся по `(study_session_id, position)`, прогресс не сбрасывается.
- **Изменить схему БД:** новая миграция `db/migrations/000N_*.sql` (существующие не редактировать), обновить `docs/DATA-MODEL.md`, переопубликовать артефакт схемы.
