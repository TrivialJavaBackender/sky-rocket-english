# SkyRocket English

Персональная платформа изучения языков (первый курс — English B2+ → C1, позже немецкий). Движок курс-агностичный: контент = типизированные данные, приложение их рендерит. Репозиторий — **source of truth**; веб-артефакты — только витрины.

## Карта репозитория

| Путь | Что это |
|---|---|
| `docs/PLAN.md` | **Канонический план курса**: метод, 80 часов, протокол 4 сессий, система повторений, роадмап М1–М15 + финал, критерии C1 |
| `docs/DESIGN-BRIEF.md` | Бриф, по которому сделан утверждённый дизайн |
| `docs/design/skyrocket/` | Утверждённый дизайн (mockup). `content.js` — **образцовые формы данных всех экранов**, схема БД следует им |
| `docs/DATA-MODEL.md` | Схема данных: ER-диаграммы, справочник таблиц, решения, полный SQL |
| `db/migrations/` | SQL-миграции Neon Postgres: `0001_init.sql` (DDL + сид типов упражнений), `0002_seed_en_c1_skeleton.sql` (каркас курса) |
| `content/en-c1/` | Контент-пакеты модулей (YAML/CSV). `README.md` — схема пакета. Пакеты синкаются в БД по `content_hash` |
| `docs/MODULE-TASK-TEMPLATE.md` | Шаблон ТЗ субагенту на генерацию модуля + Definition of Done |
| `docs/artifacts/plan.html` | Исходник артефакта-витрины плана |

## Жёсткие правила

1. **English only в контенте.** Внутри `content/**` и всех учебных материалов (теория, определения, пояснения, карточки) — ни слова по-русски. Документы для пользователя (docs/*.md) — по-русски.
2. **Source of truth — репозиторий.** Артефакты обновляются публикацией локального файла с параметром `url` (см. ниже), а не правкой «в вебе».
3. **Контент отделён от прогресса.** Контент-таблицы БД перезаливаются sync'ом идемпотентно; прогресс пользователя не трогается.

## Артефакты (витрины)

- План курса: https://claude.ai/code/artifact/a2ff798f-b789-4b5f-bcc6-b31ec622cb0e — публикуется из `docs/artifacts/plan.html`
- Схема данных: https://claude.ai/code/artifact/8fca3159-dcdb-41de-9de7-127d11d755e6 — публикуется из `docs/DATA-MODEL.md`

## База данных

Neon Postgres. Применение миграций: `psql "$DATABASE_URL" -f db/migrations/0001_init.sql` (затем 0002). Ядро схемы: `course → block → module` + `checkpoint` (ворота: diagnostic/block/final); контент (`grammar_spotlight`, `watchout`, `reading_text`+`gloss`, `vocab_entry`, `exercise` с `content jsonb` по 8 типам, `writing_task`, `flashcard`); протокол (`study_session` 4 типа × `session_step`); прогресс — три колеи повторений (`card_state` SRS, `review_queue_item` +2/+7/+21 д, `module_review` r7/r21) + статусы (`user_vocab_state`, `user_grammar_state`, `user_module_state`).

## Стек-решения (утверждены)

Web app (mobile-first PWA) на Netlify + Neon по архитектуре `../concurrency` (Next.js 15 + Prisma, markdown/yaml → sync в БД на билде; там же паттерны auth bcrypt+jose и Leitner-SRS). Позже — обёртка Telegram Mini App для напоминаний. Текущий репо — vite-шаблон-заглушка; приложение будет создаваться отдельно, React не самоцель.

## Рабочие процессы

- **Сгенерировать модуль:** взять промпт из `docs/MODULE-TASK-TEMPLATE.md`, подставить N, свериться с карточкой модуля в `docs/PLAN.md` и схемой `content/en-c1/README.md`. Проверить по DoD.
- **Изменить план курса:** править `docs/PLAN.md` + `docs/artifacts/plan.html`, опубликовать артефакт с `url`.
- **Изменить схему БД:** новая миграция `db/migrations/000N_*.sql` (существующие не редактировать), обновить `docs/DATA-MODEL.md`, переопубликовать артефакт схемы.
