/**
 * UC-16/17 · Review hub (ARCHITECTURE.md §1.4, §7 `/review`) — read-only
 * summary across all three lanes.
 */
import * as srsRepo from '../repositories/srs.repo';
import * as reviewRepo from '../repositories/review.repo';
import type { NoteType, ReviewStage } from '../domain/types';

export interface ReviewHubLane1DTO {
  cardsDue: number;
  breakdown: Record<NoteType, number>;
}

export interface ReviewHubLane2ItemDTO {
  moduleTitle: string | null;
  moduleSlug: string | null;
  dueAt: Date;
}

export interface ReviewHubLane2DTO {
  itemsDue: number;
  items: ReviewHubLane2ItemDTO[];
}

export interface ReviewHubLane3ItemDTO {
  /** Added in stage 4 (frontend) — the "Take quiz" launcher needs the numeric id to fetch the review's exercise set and to call finishModuleReview. */
  moduleId: number;
  moduleTitle: string;
  moduleSlug: string;
  stage: ReviewStage;
  dueAt: Date;
  dueNow: boolean;
}

export interface ReviewHubLane3DTO {
  items: ReviewHubLane3ItemDTO[];
}

export interface ReviewHubDTO {
  lane1: ReviewHubLane1DTO;
  lane2: ReviewHubLane2DTO;
  lane3: ReviewHubLane3DTO;
}

export async function getReviewHub(userId: number, now: Date = new Date()): Promise<ReviewHubDTO> {
  const [dueCards, queueItems, queueDueCount, upcomingModuleReviews] = await Promise.all([
    srsRepo.listDueCards(userId, now, 200),
    reviewRepo.listDueReviewQueueItems(userId, now, 10),
    reviewRepo.countDueReviewQueueItems(userId, now),
    reviewRepo.listUpcomingModuleReviews(userId, 10),
  ]);

  const breakdown: Record<NoteType, number> = { vocab: 0, grammar_cloze: 0, transformation: 0 };
  for (const c of dueCards) breakdown[c.flashcard.noteType] += 1;

  return {
    lane1: { cardsDue: dueCards.length, breakdown },
    lane2: {
      itemsDue: queueDueCount,
      items: queueItems.map((i) => ({ moduleTitle: i.moduleTitle, moduleSlug: i.moduleSlug, dueAt: i.dueAt })),
    },
    lane3: {
      items: upcomingModuleReviews.map((r) => ({ moduleId: r.moduleId, moduleTitle: r.moduleTitle, moduleSlug: r.moduleSlug, stage: r.stage, dueAt: r.dueAt, dueNow: r.dueAt.getTime() <= now.getTime() })),
    },
  };
}
