/**
 * UC-16/17 · Review hub (ARCHITECTURE.md §1.4, §7 `/review`) — read-only
 * summary across all three lanes.
 */
import * as srsRepo from '../repositories/srs.repo';
import * as reviewRepo from '../repositories/review.repo';
import type { NoteType, ReviewStage } from '../domain/types';

export interface ReviewHubLane1CourseDTO {
  courseSlug: string;
  courseName: string;
  levelLabel: string;
  cardsDue: number;
  breakdown: Record<NoteType, number>;
}

export interface ReviewHubLane1DTO {
  cardsDue: number;
  breakdown: Record<NoteType, number>;
  /** One row per course with cards due (§7.1). A German card and an English one both carry English metalanguage, so a single merged count is unreadable — and unstartable as one run. */
  byCourse: ReviewHubLane1CourseDTO[];
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
  // Lane 1 is counted with an aggregate, not by paging rows: the old
  // `listDueCards(…, 200).length` silently capped the headline number at 200
  // while `/` reported the true count, so the two screens disagreed.
  const [byCourse, queueItems, queueDueCount, upcomingModuleReviews] = await Promise.all([
    srsRepo.countDueCardsByCourse(userId, now),
    reviewRepo.listDueReviewQueueItems(userId, now, 10),
    reviewRepo.countDueReviewQueueItems(userId, now),
    reviewRepo.listUpcomingModuleReviews(userId, 10),
  ]);

  const breakdown: Record<NoteType, number> = { vocab: 0, vocab_reverse: 0 };
  for (const c of byCourse) {
    for (const [noteType, n] of Object.entries(c.byNoteType)) breakdown[noteType as NoteType] = (breakdown[noteType as NoteType] ?? 0) + n;
  }

  return {
    lane1: {
      cardsDue: byCourse.reduce((sum, c) => sum + c.cardsDue, 0),
      breakdown,
      byCourse: byCourse.map((c) => ({ courseSlug: c.courseSlug, courseName: c.courseName, levelLabel: c.levelLabel, cardsDue: c.cardsDue, breakdown: c.byNoteType })),
    },
    lane2: {
      itemsDue: queueDueCount,
      items: queueItems.map((i) => ({ moduleTitle: i.moduleTitle, moduleSlug: i.moduleSlug, dueAt: i.dueAt })),
    },
    lane3: {
      items: upcomingModuleReviews.map((r) => ({ moduleId: r.moduleId, moduleTitle: r.moduleTitle, moduleSlug: r.moduleSlug, stage: r.stage, dueAt: r.dueAt, dueNow: r.dueAt.getTime() <= now.getTime() })),
    },
  };
}
