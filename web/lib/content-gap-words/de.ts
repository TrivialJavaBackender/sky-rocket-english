/**
 * German word lists behind the open_cloze determinacy rule
 * (docs/CONTENT-PACKAGE-SCHEMA.md). Counterpart of ./en.ts; dispatcher is
 * ./index.ts.
 *
 * German suits this format better than English does: because case, gender and
 * number are carried by the closed class itself, a gap on an article or a
 * preposition is pinned by the surrounding grammar with no lexical guessing at
 * all. "Ich fahre ___ dem Bus" admits only *mit*; "Ich sehe ___ Mann" only
 * *den*. That is why courses/de-a2 leans on open_cloze for case work.
 *
 * Every inflected form is listed separately — the checker compares surface
 * tokens, so *dem* being determinate says nothing about *den*. As in English,
 * the lists are hand-curated: the question is not "is this a function word"
 * but "does the sentence leave the learner a choice".
 */

/**
 * Closed class: articles and determiners in every case, pronouns, prepositions
 * (incl. the verschmolzene forms am/im/zum/zur), conjunctions and subjunctions,
 * auxiliaries and modals in the forms an A1–B1 learner meets, negation,
 * question words, and the particles that carry no lexical choice.
 */
const CLOSED_CLASS = `
der die das den dem des
ein eine einen einem einer eines
kein keine keinen keinem keiner keines
mein meine meinen meinem meiner meines
dein deine deinen deinem deiner deines
sein seine seinen seinem seiner seines
ihr ihre ihren ihrem ihrer ihres
unser unsere unseren unserem unserer unseres
euer eure euren eurem eurer eures
dieser diese dieses diesen diesem
jeder jede jedes jeden jedem
welcher welche welches welchen welchem
alle alles allen allem manche mehrere einige beide
ich du er sie es wir ihr Sie
mich dich ihn uns euch sich
mir dir ihm ihnen
man wer wen wem wessen was
der die das denen dessen deren
in an auf über unter vor hinter neben zwischen
mit nach bei seit von zu aus außer gegenüber
für gegen ohne um durch bis entlang
während wegen trotz statt innerhalb außerhalb
am im vom zum zur ans ins aufs beim
und oder aber denn sondern
dass weil wenn als ob obwohl damit bevor nachdem seitdem bis solange sobald
sowie beziehungsweise entweder weder noch
bin bist ist sind seid war warst waren wart gewesen sei wäre wären
habe hast hat haben habt hatte hattest hatten hattet gehabt hätte hätten
werde wirst wird werden werdet wurde wurden worden würde würden
kann kannst können könnt konnte konnten könnte könnten
muss musst müssen müsst musste mussten müsste müssten
darf darfst dürfen dürft durfte durften dürfte dürften
soll sollst sollen sollt sollte sollten
will willst wollen wollt wollte wollten
mag magst mögen mögt möchte möchtest möchten möchtet
nicht nichts nie niemals niemand nirgends kaum
wie wo wann warum wieso weshalb woher wohin
ja nein doch schon noch nur auch sehr zu erst denn mal etwa
sehr mehr am meisten weniger als so dann also aber jedoch trotzdem deshalb darum
es gibt hier dort da her hin
zurück weg mit ab an auf aus ein vor nach bei los
`;

/**
 * Content words that are nonetheless determinate because they head a fixed
 * expression the rest of the sentence supplies: "Ich habe ___" (Hunger/Durst
 * are pinned by their own frames), "es tut mir ___" (leid), "in ___ Fall"
 * (diesem/jedem), "zu ___" (Hause/Fuß).
 */
const FIXED_FRAME_HEADS = `
Hause Fuß Uhr Recht Angst Lust Glück Pech Zeit Hunger Durst Spaß Ahnung
leid weh gern gerne los fertig kaputt bereit schuld einverstanden
Fall Beispiel Ordnung Grund Bescheid statt teil acht
`;

const toSet = (s: string) => new Set(s.trim().split(/\s+/).map((w) => w.toLowerCase()));

export const DETERMINATE_GAP_WORDS: ReadonlySet<string> = new Set([
  ...toSet(CLOSED_CLASS),
  ...toSet(FIXED_FRAME_HEADS),
]);
