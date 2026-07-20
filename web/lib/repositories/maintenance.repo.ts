/**
 * Dev/testing affordance only — wipes every progress row for one user so
 * the app can be exercised from a clean slate without re-running
 * migrate/sync (mirrors scripts/reset-progress.ts exactly; keep
 * the two in sync if the progress schema changes).
 *
 * Deletes are ordered so FK references clear before their targets (e.g.
 * review_queue_item/error_map_entry before exercise_attempt) even though
 * every relevant FK is ON DELETE CASCADE/SET NULL and would tolerate any
 * order — explicit ordering just keeps the intent readable. Content tables
 * and the app_user row itself are untouched.
 *
 * User-created flashcards (source='gloss'|'error_harvest'|'manual', i.e.
 * created_by_user_id set) only exist *because of* progress the learner
 * made, so they're deleted outright rather than orphaned; content-sourced
 * flashcards (source='content', created_by_user_id null) are untouched.
 */
import { prisma } from '../db';

export async function resetAllProgress(userId: number): Promise<void> {
  await prisma.$transaction([
    prisma.flashcard.deleteMany({ where: { created_by_user_id: userId } }),
    prisma.review_queue_item.deleteMany({ where: { user_id: userId } }),
    prisma.module_review.deleteMany({ where: { user_id: userId } }),
    prisma.error_map_entry.deleteMany({ where: { user_id: userId } }),
    prisma.exercise_attempt.deleteMany({ where: { user_id: userId } }),
    prisma.writing_submission.deleteMany({ where: { user_id: userId } }),
    prisma.card_review_log.deleteMany({ where: { user_id: userId } }),
    prisma.card_state.deleteMany({ where: { user_id: userId } }),
    prisma.daily_activity.deleteMany({ where: { user_id: userId } }),
    prisma.user_vocab_state.deleteMany({ where: { user_id: userId } }),
    prisma.user_grammar_state.deleteMany({ where: { user_id: userId } }),
    prisma.user_module_state.deleteMany({ where: { user_id: userId } }),
    prisma.user_session_state.deleteMany({ where: { user_id: userId } }),
    prisma.user_step_state.deleteMany({ where: { user_id: userId } }),
    prisma.user_checkpoint_state.deleteMany({ where: { user_id: userId } }),
    prisma.user_course.deleteMany({ where: { user_id: userId } }),
  ]);
}
