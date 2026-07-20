# SkyRocket English

Персональная платформа изучения языков (первый курс — English B2+ → C1, позже немецкий). Движок курс-агностичный: контент = типизированные данные, приложение их рендерит. Репозиторий — **source of truth**; веб-артефакты — только витрины.

## Карта репозитория

| Путь | Что это |
|---|---|
| `docs/PLAN.md` | **Канонический план курса**: метод, 80 часов, протокол 4 сессий, система повторений, роадмап М1–М15 + финал, критерии C1 |
| `docs/DESIGN-BRIEF.md` | Бриф, по которому сделан утверждённый дизайн |
| `docs/design/skyrocket/` | Утверждённый дизайн (mockup). `content.js` — **образцовые формы данных всех экранов**, схема БД следует им |
| `docs/DATA-MODEL.md` | Схема данных: ER-диаграммы, справочник таблиц, решения, полный SQL |
| `db/migrations/` | SQL-миграции Neon Postgres: `0001_init.sql` (DDL + сид типов упражнений), `0002_seed_en_c1_skeleton.sql` (каркас курса), `0003_content_natural_keys.sql` (`ident`-ключи sync), `0004_dose_theory_vocab_across_sessions.sql` (пересев шагов: дозирование теории/лексики, микро-цели), `0005_cards_words_only_vocab_reverse.sql` (колода только лексическая + reverse-сторона; grammar-cloze/transformation карточки в архив) |
| `content/en-c1/` | Контент-пакеты модулей (YAML; флеш-карточки деривируются sync'ом из vocab/theory/exercises, отдельных CSV нет). `README.md` — схема пакета. Пакеты синкаются в БД по `content_hash` |
| `docs/MODULE-TASK-TEMPLATE.md` | Шаблон ТЗ субагенту на генерацию модуля + Definition of Done |
| `docs/artifacts/plan.html` | Исходник артефакта-витрины плана |
| `docs/ARCHITECTURE.md` | **Архитектура веб-приложения**: каталог use cases, слои, дизайн sync, грейдинг 8 типов, роуты/компоненты, вопросы-решения D1–D12 (D11 — жёсткий гейтинг сессий, D12 — цели↔сессии) |
| `docs/METHODOLOGY-REVIEW.md` | Методический аудит (2026-07): сверка протокола с лучшими практиками (Nation, CELTA, плато B2→C1), рекомендации P1–P3 (аудирование, fluency, noticing) |
| `web/` | Приложение: Next.js 15 (App Router, SSR) + React 19 + Prisma + Tailwind. Слои: `lib/domain` (чистая логика) → `lib/use-cases` → `lib/repositories` (единственное место с Prisma) → `app`/`components`. `scripts/migrate.ts` — раннер raw SQL миграций, `scripts/sync.ts` — синк контента |
| `netlify.toml` | Деплой: `base = "web"`, @netlify/plugin-nextjs; билд = generate → migrate → sync → next build |

## Жёсткие правила

1. **English only в контенте.** Внутри `content/**` и всех учебных материалов (теория, определения, пояснения, карточки) — ни слова по-русски. Документы для пользователя (docs/*.md) — по-русски.
2. **Source of truth — репозиторий.** Артефакты обновляются публикацией локального файла с параметром `url` (см. ниже), а не правкой «в вебе».
3. **Контент отделён от прогресса.** Контент-таблицы БД перезаливаются sync'ом идемпотентно; прогресс пользователя не трогается.

## Артефакты (витрины)

- План курса: https://claude.ai/code/artifact/a2ff798f-b789-4b5f-bcc6-b31ec622cb0e — публикуется из `docs/artifacts/plan.html`
- Схема данных: https://claude.ai/code/artifact/8fca3159-dcdb-41de-9de7-127d11d755e6 — публикуется из `docs/DATA-MODEL.md`

## База данных

Neon Postgres. Применение миграций: `psql "$DATABASE_URL" -f db/migrations/0001_init.sql` (затем 0002). Ядро схемы: `course → block → module` + `checkpoint` (ворота: diagnostic/block/final); контент (`grammar_spotlight`, `watchout`, `reading_text`+`gloss`, `vocab_entry`, `exercise` с `content jsonb` по 8 типам, `writing_task`, `flashcard` — только лексика, две стороны на слово); протокол (`study_session` 4 типа × `session_step`); прогресс — три колеи повторений (`card_state` SRS, `review_queue_item` +2/+7/+21 д, `module_review` r7/r21) + статусы (`user_vocab_state`, `user_grammar_state`, `user_module_state`).

## Стек-решения (утверждены)

Web app (mobile-first PWA) на Netlify + Neon по архитектуре `../concurrency` (Next.js 15 + Prisma, yaml → sync в БД на билде). Приложение реализовано в `web/` (см. `docs/ARCHITECTURE.md`). Auth — cookie-сессия на access/refresh JWT (`middleware.ts` + `lib/auth/*`, идентичность — `lib/current-user.ts`), регистрация через `/register`; прогресс у каждого пользователя свой (все прогресс-таблицы по `user_id`). Позже — обёртка Telegram Mini App для напоминаний. Vite-стаб в корне (`src/`, `index.html`, `vite.config.js`) — legacy, приложением не является.

Локальная разработка: `cd web && docker compose up -d && pnpm migrate && pnpm sync && pnpm dev` (env — `web/.env`, образец `web/.env.example`), затем завести аккаунт на `/register` — сид-пользователя нет, и билд собирается на БД без пользователей. Прод: Neon через `DATABASE_URL` (пулер) + `DIRECT_URL` (билд-скрипты) + `AUTH_JWT_SECRET` (ключ подписи токенов, ≥32 символов; смена разлогинивает всех).

## Рабочие процессы

- **Сгенерировать модуль:** взять промпт из `docs/MODULE-TASK-TEMPLATE.md`, подставить N, свериться с карточкой модуля в `docs/PLAN.md` и схемой `content/en-c1/README.md`. Проверить по DoD.
- **Изменить план курса:** править `docs/PLAN.md` + `docs/artifacts/plan.html`, опубликовать артефакт с `url`.
- **Изменить схему БД:** новая миграция `db/migrations/000N_*.sql` (существующие не редактировать), обновить `docs/DATA-MODEL.md`, переопубликовать артефакт схемы.
