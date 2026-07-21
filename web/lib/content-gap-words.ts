/**
 * Word lists behind the open_cloze determinacy rule (content/en-c1/README.md).
 *
 * An open cloze gap is fair only if the learner can recover the answer from
 * the sentence. That holds when the missing word is closed-class (grammar
 * forces it — CAE Reading & Use of English Part 2 is built entirely this way,
 * see docs/PLAN.md §6) or when it is the head of a fixed expression the rest
 * of the frame gives away. It does not hold when the answer is a content word
 * chosen lexically: "He denied ___ anything about the missing files" admits
 * knowing, taking, hearing and saying alike, so the item must supply the base
 * form via `hint`.
 *
 * Both sets are deliberately hand-curated rather than derived from a POS
 * tagger: the question is not "what part of speech is this word" but "does
 * this sentence leave the learner a choice". Extend them when a new module
 * needs a frame that isn't here yet — adding a word is a claim that the
 * surrounding context pins it down.
 */

/** Closed-class words: articles, prepositions, conjunctions, auxiliaries, modals, pronouns, determiners, degree adverbs, particles. */
const CLOSED_CLASS = `
a an the
of to in on at by for with from into onto over under about above across after against along among amongst
around as before behind below beneath beside besides between beyond despite during except inside near off
out outside past since through throughout till toward towards until unto up upon via within without notwithstanding
and or but nor yet so if unless although though whereas while whilst whether because that which who whom whose
when where why how what lest once provided providing supposing assuming given otherwise else plus hence thus
therefore moreover nevertheless however
be am is are was were been being have has had having do does did doing will would shall should can could may
might must ought need dare used
needn't shouldn't mustn't couldn't wouldn't can't cannot don't doesn't didn't isn't aren't wasn't weren't
haven't hasn't hadn't won't shan't mightn't oughtn't
not no never none nothing nobody nowhere
all any both each either neither every few many more most much several some such one other others another
this these those there here it its my your his her our their mine yours hers ours theirs
i you he she we they me him us them myself yourself himself herself itself ourselves themselves
whoever whatever whichever whenever wherever
than then too very just only even also still ever rather sooner quite enough far well almost hardly scarcely
barely seldom rarely nearly indeed less least
down back away forward ahead apart aside
`;

/**
 * Content words that are nonetheless determinate because they head a fixed
 * multi-word frame the rest of the sentence supplies: "in ___ of the evidence"
 * (light/view), "it is well ___ revisiting" (worth), "as ___ as nobody
 * ploughs it" (long), "it's high ___" (time).
 */
const FIXED_FRAME_HEADS = `
light view case time long worth order spite account means sake point verge brink event terms regard respect
addition place favour behalf charge risk expense virtue extent matter doubt wonder use good contrary whole
average purpose condition grounds hand chance heart least last large best worst stake odds ease length random
way deal lot bit
`;

const toSet = (s: string) => new Set(s.trim().split(/\s+/));

export const DETERMINATE_GAP_WORDS: ReadonlySet<string> = new Set([
  ...toSet(CLOSED_CLASS),
  ...toSet(FIXED_FRAME_HEADS),
]);

/** True when every token of every accepted answer is recoverable from the frame. */
export function isDeterminateGap(answers: readonly string[]): boolean {
  return answers.every((answer) =>
    answer
      .toLowerCase()
      // Sentence punctuation only — the apostrophe is part of the word here
      // (needn't, shouldn't), so it survives; a quoted answer loses its wrapper.
      .replace(/[.,!?;:"]/g, '')
      .split(/\s+/)
      .map((token) => token.replace(/^'+|'+$/g, ''))
      .filter(Boolean)
      .every((token) => DETERMINATE_GAP_WORDS.has(token)),
  );
}

/**
 * How many accepted answers count as "the whole semantic class is open".
 * Some gaps are pinned by grammar to a class rather than a word — the
 * subjunctive trigger in "It is ___ that every child have a safe route"
 * takes essential, vital, imperative, crucial, important or necessary, and a
 * base-form hint would simply be the answer. Listing the class exhaustively
 * is the fix there, so a generous `answers` set stands in for a hint.
 */
export const OPEN_CLASS_ANSWER_THRESHOLD = 4;
