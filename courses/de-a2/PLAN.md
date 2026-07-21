# SkyRocket Deutsch — A1 → A2 · план курса на 40 часов

> **Source of truth.** Этот файл — канонический план курса. Машиночитаемый скелет — `course.yaml` (синкается в БД), контент модулей — `content/module-NN/`.
> Родовой метод и правила проектирования — `docs/COURSE-DESIGN-GUIDE.md`.

**Сводка:** 40 ч занятий · ≈10 недель при 4 ч/нед · 10 модулей + финальный тест · 300 лексических единиц · 600 карточек (по две на слово) · контент — **только немецкий** · ориентир — Goethe-Zertifikat A2 / telc Deutsch A2.

---

## 1. Метод — что отделяет A1 от A2

На A1 вы знаете отдельные слова и умеете сказать заготовленную фразу. A2 — это переход от фраз к предложениям: появляется прошедшее время, придаточные, падежи начинают работать не по таблице, а автоматически.

| Область | A1 (сейчас) | A2 (цель) |
|---|---|---|
| Лексика | ≈500 слов, изолированных | ≈1000–1200, связками: `Sport treiben`, `mit dem Bus fahren` |
| Грамматика | Präsens, простые вопросы | Perfekt и Präteritum, все падежи, придаточные с `weil`/`dass`/`wenn` |
| Письмо | Анкета, короткая записка | E-Mail 40–60 слов с обращением и связками |
| Чтение | Вывески, простые объявления | Короткий текст и диалог на бытовую тему без словаря |
| Речь | Заученные фразы о себе | Рассказ о прошедшем дне или поездке, простая просьба и совет |

**Принципы:**

1. **Полное погружение.** Весь контент модулей — теория, определения, пояснения к ответам, чек-листы, заголовки шагов — **только по-немецки**. Русский остаётся в этом плане и в `docs/`, но не в учебных материалах. Как это возможно на A1 — раздел 5.
2. **Мало теории, много практики.** Не более 8 грамматических пунктов на модуль (2 spotlight'а × 4 items). Правило — это подготовка к упражнению, а не содержание модуля.
3. **Падежи через `open_cloze`.** Немецкий устроен так, что пропуск на артикле или предлоге однозначно задан грамматикой: `Ich fahre ___ dem Bus` допускает только `mit`. Это делает формат честным и превращает его в основной инструмент отработки падежей.
4. **Ошибка не теряется.** Любая ошибка возвращается самим заданием через 2 → 7 → 21 день.
5. **Повторение встроено в расписание.** Wiederholung в сессиях 2 и 3, ревью модуля на +7 и +21 день, карточки ежедневно.

## 2. Архитектура 40 часов

| Этап | Состав | Часы |
|---|---|---:|
| Einstufungstest | 40 заданий + Grammatik-Wörterbuch (метаязык) + короткое письмо | 1,0 |
| Блок A · Basis | Модули 1–4: Präsens, падежи, порядок слов | 14,0 |
| Checkpoint A | 30 заданий + письмо | 1,25 |
| Блок B · Alltag | Модули 5–7: Perfekt, предлоги, Dativ, модальные | 10,5 |
| Checkpoint B | 30 заданий + письмо | 1,25 |
| Блок C · Welt | Модули 8–10: придаточные, сравнение, Präteritum | 10,5 |
| Abschlusstest | Мок в формате Goethe A2 | 1,5 |
| **Итого** | | **40,0** |

**Ритм.** Один модуль (3,5 ч) — одна неделя при 4 ч/нед: четыре сессии по 55/55/55/45 минут. Сессии короче, чем в en-c1 (там 60/75/75/60), намеренно: на A-уровнях концентрация уходит раньше, и лучше пять коротких заходов, чем три длинных. Ежедневные 10 минут карточек — отдельный ритуал **вне** 40 часов.

## 3. Как проходить модуль — 4 сессии

Протокол одинаков каждую неделю. Теория дозируется двумя частями (часть 1 в Start, часть 2 в Training прямо перед упражнениями), лексика — тремя партиями по ~10 слов. Сессии открываются строго по порядку.

**Sitzung 1 · Start — 55′ · вход в тему**
1. Ziele dieses Moduls (3′)
2. Text überfliegen — без словаря, только смысл (8′)
3. Grammatik im Fokus · Teil 1 — первая половина правил, таблица и примеры (16′)
4. Wortschatz · 1 von 3 — первые ~10 слов (20′)
5. Neue Karten in die Kartei (8′)

**Sitzung 2 · Lesen — 55′ · чтение и лексика**
1. Wiederholung — 8 заданий из очереди повторений (10′)
2. Wortschatz · 2 von 3 — слова, которые сейчас встретятся в тексте (8′)
3. Lesen mit Glossen — охота за словами и конструкциями модуля (12′)
4. Leseverstehen — 6 вопросов (7′)
5. Wortschatz · 3 von 3 (8′)
6. Wortschatz-Übungen — mc_cloze, collocation_match, word_formation (10′)

**Sitzung 3 · Training — 55′ · грамматика**
1. Wiederholung — 8 заданий из очереди (10′)
2. Grammatik im Fokus · Teil 2 — оставшиеся правила (12′)
3. Grammatik-Drill und Lückentext — grammar_drill + open_cloze (18′)
4. Umformung und Fehlersuche — key_word_transformation + error_correction (10′)
5. Fehler sammeln — каждая ошибка в очередь повторений (5′)

**Sitzung 4 · Anwenden — 45′ · продукция и закрытие**
1. Zweiter Text — диалог по теме (8′)
2. Schreiben oder Sprechen — E-Mail/записка или записанный монолог (20′)
3. Selbstkontrolle — чек-лист и сравнение с образцом (7′)
4. Modul-Quiz — 10 заданий → статус Completed, ревью на +7 и +21 день (10′)

**Ежедневно:** карточки 10 минут вне сессий — все повторы дня + 6–8 новых.

## 4. Роадмап по модулям

**Неделя 0 · Einstufungstest — 1 ч.** 40 заданий по грамматике A1 + короткое письмо. Отдельно — **Grammatik-Wörterbuch**: глоссарий немецких грамматических терминов (`der Artikel`, `der Kasus`, `das Nomen`, `das Verb`, `der Plural`, `die Endung`, `der Hauptsatz`, `der Nebensatz`, `das Partizip`, `die Vergangenheit`). Дальше модули не используют ни одного термина вне этого списка — это то, что делает немецкие объяснения читаемыми.

### Блок A · Basis — ядро (М1–М4, 14 ч)

**М1 · Ich und du**
- Грамматика (6): Präsens регулярных глаголов; `sein` и `haben`; W-Fragen и Ja/Nein-Fragen; Personalpronomen im Nominativ.
- Лексика (30): знакомство, происхождение, языки, числа — *heißen · kommen aus · wohnen in · sprechen · die Sprache · der Beruf · verheiratet · ledig · die Adresse · das Alter · gern · auch*.
- Тексты: «Neu in der Stadt» (280) + Dialog im Sprachkurs (140).
- Продукция: Steckbrief/Anmeldeformular + короткое представление себя (50 слов).

**М2 · Familie und Wohnen**
- Грамматика (8): Artikel `der/die/das`; Plural; Akkusativ; Possessivartikel; Negation `nicht` vs `kein`.
- Лексика (30): семья, жильё, мебель — *die Wohnung · das Zimmer · der Schrank · mieten · die Miete · der Nachbar · gemütlich · hell · die Geschwister · verwandt · umziehen · das Erdgeschoss*.
- Тексты: «Meine erste eigene Wohnung» (300) + Wohnungsanzeigen (130).
- Продукция: описание своей квартиры (50 слов).

**М3 · Essen und Einkaufen**
- Грамматика (7): глаголы с изменением корня (`essen`, `nehmen`, `sprechen`); Imperativ; `möchten` и `können`; Mengenangaben.
- Лексика (30): продукты, магазин, цены — *das Lebensmittel · die Bäckerei · das Gemüse · frisch · günstig · die Kasse · das Kilo · die Packung · schmecken · probieren · bestellen · die Rechnung*.
- Тексты: «Einkaufen am Samstag» (290) + Dialog an der Kasse (150).
- Продукция: Einkaufszettel + Dialog im Geschäft (записанный, 1–2 мин).

**М4 · Mein Tag**
- Грамматика (8): trennbare Verben; Uhrzeit; Verb an Position 2 и инверсия; `am`/`um`/`im`.
- Лексика (30): распорядок, работа, встречи — *aufstehen · anfangen · aufhören · der Termin · die Pause · die Arbeit · früh · spät · pünktlich · müde · jeden Tag · am Wochenende*.
- Тексты: «Ein Tag von Anna» (300) + Terminkalender einer Woche (140).
- Продукция: описание своего дня (55 слов).

**Checkpoint A — 1,25 ч.** 30 заданий по М1–М4 + письмо. Порог 75 %; ниже — неделя ревизии.

### Блок B · Alltag — прошедшее время и падежи (М5–М7, 10,5 ч)

**М5 · Freizeit und Hobbys**
- Грамматика (7): Perfekt mit `haben`; Partizip II регулярных и частотных нерегулярных; Zeitangaben `gestern`/`letzte Woche`.
- Лексика (30): хобби, спорт, выходные — *das Hobby · Sport treiben · schwimmen · das Konzert · sich treffen · Freunde besuchen · das Ehrenamt · spannend · langweilig · draußen · zusammen · das Vergnügen*.
- Тексты: «Was machst du am Wochenende?» (300) + три коротких поста в соцсети (3×50).
- Продукция: рассказ о прошедших выходных (55 слов).

**М6 · Unterwegs**
- Грамматика (8): Perfekt mit `sein`; Wechselpräpositionen (`wohin` vs `wo`); `mit + Dativ` для транспорта.
- Лексика (30): дорога, город, транспорт — *die Haltestelle · umsteigen · die Fahrkarte · geradeaus · abbiegen · die Kreuzung · die Reise · ankommen · abfahren · die Verspätung · zu Fuß · unterwegs*.
- Тексты: «Eine Woche in Wien» (320) + Wegbeschreibung als Dialog (150).
- Продукция: описание дороги от дома до работы (записанное, 1–2 мин).

**М7 · Gesundheit**
- Грамматика (8): Dativ als Objekt (`mir`, `dir`, `ihm`); все модальные глаголы; `weh tun`; Imperativ Sie-Form для советов.
- Лексика (30): тело, врач, советы — *der Arzt · die Praxis · sich fühlen · das Fieber · die Erkältung · gesund · krank · die Tablette · sich ausruhen · der Rat · helfen · besser werden*.
- Тексты: «Beim Arzt» (300) + Ratgeber-Text «Gesund durch den Winter» (150).
- Продукция: E-Mail другу с советом при болезни (55 слов).

**Checkpoint B — 1,25 ч.** 30 заданий по М5–М7 + накопительные из блока A + письмо. Порог 75 %.

### Блок C · Welt — сложное предложение (М8–М10, 10,5 ч)

**М8 · Arbeit und Pläne**
- Грамматика (7): Nebensatz mit `weil` и `dass` (глагол в конец); Zukunft через Präsens + Zeitangabe; профессии.
- Лексика (30): работа, планы, заявление — *die Stelle · sich bewerben · die Erfahrung · der Lebenslauf · das Gehalt · die Ausbildung · selbstständig · der Kollege · vorhaben · planen · sich freuen auf · deshalb*.
- Тексты: «Warum ich meinen Job gewechselt habe» (320) + Stellenanzeige (140).
- Продукция: короткое Bewerbungsschreiben (60 слов).

**М9 · Einkaufen und Vergleichen**
- Грамматика (8): Komparativ и Superlativ; `als` vs `wie`; прилагательное после `sein` vs перед существительным (основы склонения).
- Лексика (30): одежда, цены, мнения — *die Kleidung · die Größe · anprobieren · umtauschen · teuer · billig · passen · gefallen · die Qualität · lieber · am liebsten · meiner Meinung nach*.
- Тексты: «Online oder im Laden?» (320) + два отзыва на один товар (2×80).
- Продукция: сравнение двух вещей с обоснованием (55 слов).

**М10 · Feste und Erinnerungen**
- Грамматика (8): Präteritum от `sein`, `haben` и модальных; Nebensatz mit `wenn` и `als`; Ordinalzahlen и даты.
- Лексика (30): праздники, приглашения, воспоминания — *das Fest · feiern · einladen · die Einladung · das Geschenk · sich erinnern · damals · früher · der Geburtstag · gratulieren · die Erinnerung · schenken*.
- Тексты: «Weihnachten bei uns früher» (330) + Einladungskarte und Antwort (2×70).
- Продукция: рассказ о запомнившемся празднике (60 слов).

### Финал · Abschlusstest — 1,5 ч

Мок в формате Goethe-Zertifikat A2: Lesen, Sprachbausteine, Schreiben. Разбор, финальная карта ошибок, план на B1.

## 5. Immersion — как объяснять по-немецки на уровне A1

Требование «всё по-немецки» на A1 упирается в очевидное: объяснение правила по-немецки новичок не прочитает. Решение — механика, а не сила воли. Четыре правила, обязательные для каждого модуля:

1. **Таблица вместо прозы.** Основную работу делают `form` и `example`. Поле `note` — не более 12 слов простого немецкого.
   ```yaml
   - form: mit + Dativ
     example: Ich fahre mit dem Bus zur Arbeit.
     note: Nach „mit" immer Dativ. der Bus → mit dem Bus.
   ```
2. **Метаязык только из глоссария.** Grammatik-Wörterbuch вводится в диагностике и фиксирован: `der Artikel`, `der Kasus`, `das Nomen`, `das Verb`, `der Plural`, `die Endung`, `der Hauptsatz`, `der Nebensatz`, `das Partizip`, `die Vergangenheit`. Ни одного термина сверх списка.
3. **`explanation` — 1–2 предложения плюс пример.** `„Nach *mit* steht immer der Dativ. mit dem Bus, mit der Bahn."` Не металингвистическое рассуждение.
4. **`definition` — перифраза плюс синоним или антоним**, как в Schritte и Menschen: `der Nachbar → Eine Person. Sie wohnt neben mir.`

Заголовки шагов и сессий тоже немецкие (`Grammatik im Fokus`, `Wortschatz · 1 von 3`) — они короткие, повторяются каждую неделю и работают как первая лексика интерфейса. Глобальный интерфейс приложения не трогаем.

## 6. Профиль модуля

Числа, которые `docs/MODULE-TASK-TEMPLATE.md` подставляет в ТЗ генератору. Откалибровать после пилотного М1.

```
язык контента: немецкий, уровень A2; ни слова по-русски и по-английски
лексем: 30 · лимит теории: ≤2 spotlights × ≤4 items (максимум 8 пунктов)
core: 52 · review_pool: 20 · cloze_cards: 8

разбивка core:
   6 mc_cloze · 8 open_cloze · 6 word_formation · 4 key_word_transformation
   8 grammar_drill · 6 error_correction · 8 collocation_match · 6 reading_comprehension

тексты: text-main 280–330 слов · text-extra 130–150 (Dialog, Anzeige или Posts)
продукция: 50–60 слов (E-Mail, Notiz, Formular) либо монолог 1–2 мин
```

**Чем профиль отличается от en-c1 и почему:**

| | en-c1 | de-a2 | Причина |
|---|---:|---:|---|
| лексем | 45 | 30 | на A2 слово требует больше повторов, колода должна закрываться за 10 мин |
| теория | ≤30 пунктов | ≤8 | главное правило уровня — не перегружать |
| core | 66 | 52 | короче сессии (210 мин против 270) |
| `key_word_transformation` | 8 | 4 | формат тяжёл на A2 и не является экзаменационным якорем Goethe A2 |
| `open_cloze` | 8 | 8 | доля выше: падежи и окончания — идеальный материал для формата |
| текст | 800–900 | 280–330 | предел для A2 без словаря |
| продукция | 220–260 | 50–60 | объём письма Goethe A2 |

## 7. Типы упражнений на немецком

Восемь типов движка без изменений — меняется роль:

| Тип | Что тренирует в de-a2 | Пример |
|---|---|---|
| `mc_cloze` | артикль, форма глагола, предлог | `Ich helfe ___ Bruder.` → dem |
| `open_cloze` | окончания и служебные слова | `Ich fahre ___ dem Bus.` → mit |
| `word_formation` | Plural, Partizip II, Komparativ | `zwei ___ (das Buch)` → Bücher |
| `key_word_transformation` | Präsens ↔ Perfekt, Aussage ↔ Frage | `Ich gehe ins Kino.` → GESTERN → `Ich ___ ins Kino ___.` |
| `grammar_drill` | спряжение, падеж, порядок слов | выбор из четырёх форм |
| `error_correction` | типовые ошибки русскоязычных | `Ich habe nach Berlin gefahren.` → habe → bin |
| `collocation_match` | Verb + Nomen | `Sport` × `treiben`, `Musik` × `hören` |
| `reading_comprehension` | вопросы к Lesetext | — |

**Типовые ошибки русскоязычных** для `error_correction` (отбор по L1-интерференции): пропуск артикля; `sein`/`haben` в Perfekt; порядок слов в придаточном; неразличение `wo`/`wohin`; калька `Ich habe 20 Jahre` вместо `Ich bin 20 Jahre alt`; род существительного по русскому образцу.

**Предложение на будущее (вне текущего плана):** тип `word_order` — перетаскивание слов в правильном порядке. Для немецкого это центральная механика (V2, глагол в конец придаточного), но требует нового значения в `exercise_type`, грейдера и компонента плеера.

## 8. Критерии достижения A2

| Навык | Измеримый критерий |
|---|---|
| Lesen | Короткий бытовой текст 300 слов без словаря, 5 из 6 вопросов верно |
| Schreiben | E-Mail 50–60 слов за 20 минут: обращение, две связки, Perfekt |
| Sprechen | Рассказ 1–2 минуты о прошедшем дне или поездке, без пауз дольше 5 секунд |
| Grammatik | ≥75 % на Abschlusstest в формате Goethe A2 |
| Wortschatz | 600 карточек в ротации (300 слов × 2 стороны), mature retention ≥ 85 % |

Критерии выполнены → уверенный A2, имеет смысл сдать Goethe-Zertifikat A2. Дальше — курс B1 по тому же протоколу с профилем уровня B1.

---

**Связанные документы:** правила проектирования курса — `docs/COURSE-DESIGN-GUIDE.md` · схема контент-пакета — `docs/CONTENT-PACKAGE-SCHEMA.md` · ТЗ на генерацию модуля — `docs/MODULE-TASK-TEMPLATE.md` · скелет курса — `course.yaml`.
