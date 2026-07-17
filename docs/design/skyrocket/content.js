// SkyRocket sample course data — English B2+ → C1, Module 09 "Work & Careers".
// The engine is course-agnostic: the app renders whatever this shape carries.
window.SKY = {
course: { name: 'English', level: 'B2+ → C1', switcher: 'EN · B2+ → C1', other: 'German · A2 → B1' },
blocks: [
 { n: 1, name: 'Consolidate', color: '#B23A2E', tint: '#F6E8E6', range: 'M01–M04', pct: 100,
   cp: { label: 'Checkpoint 1', state: 'passed', score: 86 },
   modules: [
    { n: '01', name: 'Time & tense', state: 'Mastered' },
    { n: '02', name: 'Telling stories', state: 'Mastered' },
    { n: '03', name: 'People & personality', state: 'Mastered' },
    { n: '04', name: 'Modality I', state: 'Mastered' } ] },
 { n: 2, name: 'Expand', color: '#2E5F9E', tint: '#E8EEF6', range: 'M05–M08', pct: 100,
   cp: { label: 'Checkpoint 2', state: 'passed', score: 81 },
   modules: [
    { n: '05', name: 'Hypothesis & conditionals', state: 'Mastered' },
    { n: '06', name: 'Media & reporting', state: 'Mastered' },
    { n: '07', name: 'Comparison & degree', state: 'Completed', note: '+21-day quiz in 3 days' },
    { n: '08', name: 'Cause & effect', state: 'Completed', note: '+7-day quiz due today' } ] },
 { n: 3, name: 'Refine', color: '#2E7D4F', tint: '#E8F1EB', range: 'M09–M12', pct: 31,
   cp: { label: 'Checkpoint 3', state: 'locked', hint: 'complete M09–M12 to unlock · pass mark 75%' },
   modules: [
    { n: '09', name: 'Work & careers', state: 'In progress', note: 'Session 2 of 4', open: true },
    { n: '10', name: 'Hedging & stance', state: 'Upcoming' },
    { n: '11', name: 'Passives & impersonality', state: 'Upcoming' },
    { n: '12', name: 'Cohesion & flow', state: 'Upcoming' } ] },
 { n: 4, name: 'Command', color: '#B97417', tint: '#F6EDDD', range: 'M13–M16', pct: 0, locked: true,
   cp: { label: 'Final checkpoint', state: 'locked', hint: 'unlocks after Checkpoint 3' },
   modules: [
    { n: '13', name: 'Register & formality', state: 'Locked' },
    { n: '14', name: 'Idiom & collocation', state: 'Locked' },
    { n: '15', name: 'Argument & emphasis', state: 'Locked' },
    { n: '16', name: 'Polish & precision', state: 'Locked' } ] }
],
today: {
 date: 'FRIDAY 17 JULY', streak: 23, cards: 34, queue: 6,
 session: 'Session 2 of 4', name: 'Input', len: '75 min', module: 'Module 09 · Work & Careers',
 steps: [
  { t: 'Review Slot', d: '10 items from the re-queue · M07–M08' },
  { t: 'Long-read · Part B', d: 'The rise of the portfolio career · ≈ 6 min' },
  { t: 'Vocabulary in focus', d: 'Career moves · 6 lexemes with use cases' },
  { t: 'Exercises 9.3 – 9.5', d: 'MC cloze · collocation match · word formation' } ],
 overdue: { n: 9, msg: 'Retention slips fastest in the first missed week — the backlog takes about 12 minutes.' }
},
unit: {
 block: 'BLOCK 3 · MODULE 09', title: 'Work & Careers',
 standfirst: 'Perfect aspect for career narratives · 18 lexemes · one professional bio.',
 goals: [
  'Use the perfect aspect confidently when narrating a career',
  'Deploy 18 high-value career collocations in your own sentences',
  'Distinguish neutral, formal and informal workplace register',
  'Write a 220-word professional bio (Session 4)' ],
 sessions: [
  { n: 1, name: 'Prime', len: '60′', state: 'done' },
  { n: 2, name: 'Input', len: '75′', state: 'current' },
  { n: 3, name: 'Workout', len: '75′', state: 'todo' },
  { n: 4, name: 'Output', len: '60′', state: 'todo' } ],
 spotlight: {
  title: 'The perfect aspect in career narratives',
  intro: 'English connects past experience to the present with the perfect — not the present tense. Three forms carry almost every career sentence you will ever need:',
  rows: [
   { form: 'have + past participle', ex: 'She has led three product teams.', note: 'Completed experience that matters now — the CV tense.' },
   { form: 'have been + -ing', ex: 'I have been managing the migration since March.', note: 'Ongoing activity; stresses duration, not completion.' },
   { form: 'had (been) + …', ex: 'By thirty, she had run two startups.', note: 'An earlier past inside a past narrative.' } ] },
 watchout: {
  title: 'since + present perfect',
  bad: 'I am working here since 2019.',
  good: 'I have been working here since 2019.',
  note: 'A past starting point (since 2019) needs the perfect to reach the present. This is the single most harvested error in Block 3.' },
 reading: {
  kicker: 'LONG-READ · PART B', title: 'The rise of the portfolio career',
  meta: '≈ 6 min · dotted words carry glosses — tap to reveal',
  paras: [
   [ { t: 'For most of the twentieth century, a career was a ladder: you joined a firm, accumulated ' },
     { g: { id: 'tenure', word: 'tenure', pos: 'noun', def: 'the length of time you hold a position; also the secure form of it', ex: 'Professors with tenure cannot easily be dismissed.' } },
     { t: ', and climbed until you retired. That model has quietly collapsed. The average worker now changes employers every four years, and many have stopped climbing altogether — they have been assembling something messier and, arguably, more resilient.' } ],
   [ { t: 'The portfolio career — several part-time engagements in place of one full-time role — was once a euphemism for unemployment. It has since become a deliberate strategy. Designers ' },
     { g: { id: 'niche', word: 'carve out a niche', pos: 'idiom', def: 'to establish a small, secure position that suits you specifically', ex: 'She carved out a niche translating legal tech patents.' } },
     { t: ' in two industries at once; engineers ' },
     { g: { id: 'stock', word: 'take stock of', pos: 'idiom', def: 'to pause and assess a situation carefully before deciding', ex: 'Every January he takes stock of which skills still earn their keep.' } },
     { t: ' their skills each year and ' },
     { g: { id: 'pivot', word: 'pivot', pos: 'verb · business register', def: 'to change direction strategically while keeping what already works', ex: 'The studio pivoted from print to motion design within a year.' } },
     { t: ' before the market forces them to.' } ],
   [ { t: 'Critics answer that the trend simply repackages precarity, and burnout is ' },
     { g: { id: 'rife', word: 'rife', pos: 'adjective · used of bad things', def: 'widespread — collocates with rumours, corruption, speculation', ex: 'Burnout is rife among freelancers juggling four clients.' } },
     { t: ' among those holding four clients together with goodwill and a shared calendar. Yet for workers who have been treating their skills as a portfolio rather than a job title, the reward is a kind of leverage employers can no longer quietly take back.' } ] ] },
 vocab: {
  title: 'Career moves',
  entries: [
   { term: 'hand in your notice', tag: 'neutral', def: 'to formally tell your employer you are leaving',
     ex: ['She handed in her notice the day her visa cleared.', 'He had been threatening to hand it in for a year before he finally did.'],
     col: 'give in / work your notice · notice period', reg: 'Formal: resign · Informal: quit' },
   { term: 'take on responsibility', tag: 'neutral', def: 'to accept new duties or a bigger role',
     ex: ['She took on responsibility for the whole EU rollout.', 'Don’t take on more than the role actually pays for.'],
     col: 'take on staff / work / a role', reg: 'Also: shoulder responsibility (formal)' },
   { term: 'climb the corporate ladder', tag: 'idiom · often ironic', def: 'to advance through the ranks of a large organisation',
     ex: ['He spent a decade climbing the corporate ladder before realising it leaned against the wrong wall.', 'She has no interest in climbing the ladder — she wants the work itself.'],
     col: 'rise through the ranks · work your way up', reg: 'Neutral alternative: advance, be promoted' } ] },
 launchers: [
  { key: 'grammar', label: 'Practise the spotlight', detail: 'Grammar drill · error correction · key-word transformation — 3 items' },
  { key: 'reading', label: 'Check the reading', detail: 'Open cloze · reading comprehension — 2 items' },
  { key: 'vocab', label: 'Practise the vocabulary', detail: 'MC cloze · collocation match · word formation — 3 items' } ]
},
exSets: { grammar: ['gd', 'ec', 'kwt'], reading: ['oc', 'rc'], vocab: ['mc', 'cm', 'wf'],
          all: ['gd', 'ec', 'kwt', 'oc', 'rc', 'mc', 'cm', 'wf'] },
exercises: [
 { id: 'gd', type: 'drill', label: 'Grammar drill',
   pre: 'By the time she turned thirty, she ', post: ' two startups.', prompt: 'RUN',
   options: ['ran', 'has run', 'had run', 'had been running'], answer: 2,
   explain: '“By the time + past” sets an earlier-past frame, so the earlier event takes the past perfect: had run. “Had been running” would stress the ongoing activity rather than the completed achievement.' },
 { id: 'ec', type: 'error', label: 'Error correction',
   words: ['I', 'am', 'working', 'for', 'this', 'company', 'since', '2021.'], wrong: 1, correction: 'am → have been',
   explain: '“Since 2021” anchors the sentence to a past starting point, so English needs the present perfect continuous: I have been working… The present continuous cannot reach back into the past.' },
 { id: 'kwt', type: 'kwt', label: 'Key-word transformation',
   s1: 'I started this job three years ago.', key: 'BEEN', pre: 'I have ', post: ' three years.',
   answers: ['been in this job for', 'been doing this job for', 'been at this job for'], hint: '3–6 words, including the key word',
   answerShown: 'been in this job for',
   explain: 'The transformation swaps a past starting point (started … ago) for a present-perfect duration (have been … for). Keep the meaning identical: for + period of time, not since.' },
 { id: 'oc', type: 'open', label: 'Open cloze',
   pre: '', post: ' having no formal training, she rose to design director within five years.',
   answers: ['despite'], answerShown: 'Despite',
   explain: '“Despite + -ing” concedes an obstacle inside a single clause. “Although” would need a full clause (Although she had no…); “in spite of” also works but needs three words.' },
 { id: 'rc', type: 'read', label: 'Reading comprehension',
   passage: 'The portfolio career was once a euphemism for unemployment. It has since become a deliberate strategy.',
   q: 'What does the writer imply about portfolio careers today?',
   options: ['They are still a polite word for being out of work.', 'People now choose them on purpose.', 'They pay better than full-time roles.', 'They were invented by designers.'], answer: 1,
   explain: '“Has since become a deliberate strategy” marks a change of state: what was a face-saving label is now an intentional choice. Nothing is claimed about pay, and designers appear only as an example.' },
 { id: 'mc', type: 'mc', label: 'Multiple-choice cloze',
   pre: 'She ', post: ' her notice on Friday and walked out into the rain feeling ten kilos lighter.',
   options: ['gave', 'handed in', 'passed', 'delivered'], answer: 1,
   explain: '“Hand in your notice” is the fixed collocation for formally resigning. “Give in your notice” exists but is weaker; “pass” and “deliver” do not collocate with notice at all.' },
 { id: 'cm', type: 'match', label: 'Collocation match',
   left: ['hand in', 'take on', 'meet', 'carve out'], right: ['a niche', 'your notice', 'a deadline', 'responsibility'],
   pairs: { 0: 1, 1: 3, 2: 2, 3: 0 },
   explain: 'These four verb–noun pairs are fixed: swap the verbs and the phrase collapses. Learn the verb and the noun as one item.' },
 { id: 'wf', type: 'wf', label: 'Word formation',
   pre: 'Youth ', post: ' remains stubbornly high across the region.', prompt: 'EMPLOY',
   answers: ['unemployment'], answerShown: 'unemployment',
   explain: 'You need a noun with a negative sense: un + employ + ment. Watch the double move — many learners stop at “employment”, which reverses the meaning.' }
],
flashcards: [
 { type: 'Vocab', front: 'hand in your notice',
   main: 'to formally tell your employer you are leaving',
   cases: ['She handed in her notice the day her visa cleared.', 'He had been threatening to hand it in for a year before he finally did.'],
   extra: 'Register: neutral · formal “resign” · informal “quit”' },
 { type: 'Grammar cloze', front: 'She ______ (work) here since 2019 — and she still loves it.',
   main: 'has been working',
   cases: ['since + starting point → present perfect; continuous for ongoing activity.'],
   extra: 'Harvested from Exercise 9.2 · 12 May' },
 { type: 'Transformation', front: 'I started this job three years ago.  →  BEEN',
   main: 'I have BEEN in this job for three years.',
   cases: ['started … ago (past point) → have been … for (duration up to now)'],
   extra: 'KWT pattern · for + period, never since' },
 { type: 'Vocab', front: 'rife',
   main: '(adjective) widespread — used of bad things',
   cases: ['Burnout is rife among freelancers.', 'Speculation was rife that the CEO would step down.'],
   extra: 'Collocates: rumours / corruption / speculation + be rife' }
],
review: {
 lanes: [
  { kicker: 'LANE 1 · FLASHCARDS', due: 34, unit: 'cards due', breakdown: '21 vocab · 9 grammar cloze · 4 transformations', time: '≈ 12 min' },
  { kicker: 'LANE 2 · EXERCISE RE-QUEUE', due: 6, unit: 'items due', breakdown: 'Missed items return at 2 · 7 · 21 days. Sessions 2–3 open with a 10-item Review Slot from this queue.',
    items: [ { m: 'M07 · Comparison & degree', d: 'degree modifiers — due today' }, { m: 'M08 · Cause & effect', d: 'result clauses — due today' } ] },
  { kicker: 'LANE 3 · MODULE REVIEWS', note: '80%+ on both quizzes promotes a module to Mastered.',
    items: [ { m: 'M08 · Cause & effect', d: '+7-day quiz', when: 'due today', act: true }, { m: 'M07 · Comparison & degree', d: '+21-day quiz', when: 'in 3 days' } ] } ]
},
progress: {
 stats: [
  { big: '62%', label: 'lexis Known or In use', sub: '487 / 780 lexemes' },
  { big: '54%', label: 'constructions Reliable', sub: '39 / 72 constructions' },
  { big: '91%', label: '30-day retention', sub: 'flashcard first-try rate' },
  { big: '23', label: 'day streak', sub: 'longest: 41 days' } ],
 ladder: [
  { k: 'Lexeme', v: 'New → Learning → Known → In use' },
  { k: 'Construction', v: 'Introduced → Practising → Reliable' },
  { k: 'Module', v: 'In progress → Completed → Mastered' } ],
 upcoming: [
  { d: 'Today', t: 'M08 · +7-day review quiz' },
  { d: '20 Jul', t: 'M07 · +21-day review quiz' },
  { d: '19 Jul', t: 'Re-queue · 2 items from Exercise 9.2' } ],
 completed: { headline: 'Course complete', sub: '16 / 16 modules Mastered · final checkpoint 87% · 214-day run', cta: 'Start German · A2 → B1' }
}
};
