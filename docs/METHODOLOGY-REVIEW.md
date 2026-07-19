# Методический аудит: как учат лучшие школы — и как учит SkyRocket

Дата: 2026-07-19. Сверка учебного протокола курса en-c1 (см. `docs/PLAN.md`) с исследованиями по методике преподавания языков и практикой сильных школ/платформ (Cambridge/CELTA-фреймворки, «четыре нити» Пола Нейшена, исследования retrieval practice и «плато B2»).

## 1. Что считается лучшей практикой

**Четыре нити Нейшена (баланс курса).** Сбалансированный курс делит время примерно поровну между: (1) meaning-focused input — чтение и **аудирование** ради смысла; (2) meaning-focused output — говорение и письмо ради смысла; (3) language-focused learning — осознанная работа над формой (грамматика, лексика, драйверы); (4) fluency development — беглость на **уже известном** материале (быстрое перечитывание, пересказ 4/3/2, timed writing). Ни одна нить не должна занимать больше ~25 % времени.

**Форматы урока (CELTA/Cambridge).** Базовые фреймворки: PPP (presentation → controlled practice → freer production), Test-Teach-Test, guided discovery (учащийся сам выводит правило из примеров в контексте — на высоких уровнях предпочтителен именно он), text-based presentation (язык подаётся из текста, а не изолированно), task-based learning (цикл task → planning → report). Общая рамка: смысл раньше формы, замечание (noticing) целевых конструкций в тексте раньше объяснения правила.

**Плато B2 → C1.** Исследования и практика сходятся: переход B2→C1 — почти целиком проблема **глубины лексики**, а не грамматики. Работают: коллокации вместо изолированных слов, регистр и natural phrasing, spaced repetition + retrieval practice, встреча слова в естественном контексте, обязательное **активное употребление** (слово становится активным только через продукцию).

**Дизайн self-study платформ.** Подтверждённо работают: active recall (вспоминание, а не перечитывание), интервальные повторения, контекстная подача, error-based learning (работа от ошибок учащегося), интерливинг типов заданий. Главный предиктор прогресса — суммарное время занятий, поэтому UX не должен создавать трение.

**Экзаменационная рамка CAE (C1 Advanced).** Reading & Use of English 40 %, Writing 20 %, **Listening 20 %**, **Speaking 20 %**. Сильные учебники (Ready for Advanced, Formula C1) в каждом юните балансируют все четыре навыка.

## 2. Сверка с текущим протоколом SkyRocket

| Практика | Статус в SkyRocket | Комментарий |
|---|---|---|
| Лексика через коллокации, use cases, регистр | ✅ сильно | 45 лексем/модуль ровно в этой парадигме — это и есть анти-плато ядро |
| Spaced repetition + retrieval | ✅ сильно | Три колеи: SRS-карточки, re-queue +2/+7/+21, module reviews r7/r21 |
| Error-based learning | ✅ | Harvest ошибок в карточки + error map |
| Контекстная подача (text-based) | ✅ | Лонгрид с ≥20 целевыми лексемами и ≥8 конструкциями, глоссы |
| Смысл раньше формы | ✅ частично | Skim → теория ч.1 → close reading → драйверы: близко к text-based PPP |
| Guided discovery / noticing | ⚠️ слабо | Close reading просит «охотиться за конструкциями», но нет механики: нечего нажать, ничего не проверяется. Теория подаётся дедуктивно |
| Use of English форматы (CAE) | ✅ | 8 типов упражнений покрывают Paper 1 |
| Письмо CAE-жанров + модельный ответ | ✅ | Но фидбэк только self-check по чек-листу |
| **Аудирование** | ❌ отсутствует | 20 % экзамена и крупнейшая нить input — в курсе нет вообще |
| **Говорение** | ❌ почти нет | `mode: speaking` в заданиях есть, но нет ни записи, ни механики |
| **Fluency development** | ❌ отсутствует | Нет ни одной активности «быстро на известном материале» (~25 % времени по Нейшену) |
| Активное употребление новой лексики | ⚠️ частично | Упражнения есть, но письмо не требует применить лексемы модуля |
| Freer production / task cycle | ⚠️ частично | Одно письмо на модуль; нет свободных коммуникативных задач |

**Баланс нитей сейчас (грубая оценка по минутам протокола 60/75/75/60):** language-focused ≈ 55–60 %, meaning-focused input ≈ 25 % (только чтение), output ≈ 15 %, fluency ≈ 0 %. По Нейшену каждая должна быть ~25 %: курс заметно перекошен в «работу над формой». Для самостоятельного экзаменационного курса перекос отчасти оправдан, но аудирование и беглость — реальные дыры.

## 3. Рекомендации (по приоритету)

**P1 — Аудирование.** Добавить нить listening: TTS-аудио (или начитка) main/extra текстов + gist/detail вопросы; шаг `listening` в Input (первое прослушивание до close reading — классический receptive порядок) и/или в Output. Технически: новый `step kind` + аудио-ассеты в контент-пакете. Закрывает и нить input, и 20 % CAE.

**P1 — Беглость.** Шаг fluency в Output: (а) timed re-read main-текста с замером WPM (материал уже знаком — правильная механика по Нейшену), (б) пересказ 4/3/2 с записью, (в) timed writing на известных лексемах. Дёшево в реализации, закрывает пустую нить.

**P2 — Noticing / guided discovery.** В close reading сделать интерактив: «найди и тапни N целевых конструкций в тексте» с проверкой (конструкции уже размечены глоссами/таргетами). Перед theory part 2 — мини Test-Teach-Test: 3 вопроса до правила; ошибся → правило раскрывается подробнее.

**P2 — Применение лексики в письме.** В WritingEditor подсвечивать употреблённые лексемы модуля и показывать счётчик «Focus lexemes used: 6/8»; пункт чек-листа «использовано ≥8 лексем модуля». Прямо реализует принцип «слово активируется продукцией».

**P3 — Говорение.** Запись аудио в браузере для speaking-заданий + self-check по чек-листу против модельного ответа; позже — LLM-фидбэк.

**P3 — Фидбэк на письмо.** Сейчас только самопроверка; добавить LLM-разбор по критериям CAE (content / communicative achievement / organisation / language) как второй шаг после self-check.

Пункты P1 меняют канонический протокол (PLAN.md + миграция шагов + контент-схема) — внедрять стоит отдельной итерацией после утверждения.

## Источники

- [Nation, The Four Strands (PDF)](https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/paul-nations-publications/publications/documents/2007-Four-strands.pdf) · [обзор](https://www.hackingchinese.com/analyse-and-balance-your-chinese-learning-with-paul-nations-four-strands/)
- [CELTA lesson frameworks](https://eltplanning.com/2016/04/08/celta-lesson-frameworks/) · [Guided discovery](https://eltplanning.com/2015/04/16/guided-discovery/) · [Cambridge: teaching techniques](https://www.cambridge.org/elt/blog/2021/07/06/teaching-techniques-with-celta/) · [PPP](https://sanako.com/using-the-ppp-lesson-structure-to-teach-grammar-and-vocabulary)
- [Task-Based Language Teaching (CUP)](https://www.cambridge.org/core/elements/taskbased-language-teaching/395B3D3B0F7078DF325579CC8314E38B)
- [Плато и переход к C1](https://keithspeakingacademy.com/progress-b1-to-c2-english-levels-roadmap/) · [Breaking plateaus](https://www.robertkaucher.com/languages/2015/7/4/breaking-through-plateaus) · [Clozemaster: intermediate plateau](https://www.clozemaster.com/blog/duolingo-intermediate-english/)
- [C1 Advanced format](https://www.cambridgeenglish.org/exams-and-tests/qualifications/advanced/format/) · [Ready for Advanced: структура юнита](https://www.macmillanenglish.com/us/catalogue/courses/exam-preparation/ready-for-advanced-3rd-edition/course-information)
- [Исследование эффективности Babbel](https://www.sciencedaily.com/releases/2020/06/200609095027.htm) · [Retrieval practice в цифровых карточках](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12649105/) · [Оценочный фреймворк MALL-приложений](https://www.mdpi.com/2079-9292/14/8/1614)
