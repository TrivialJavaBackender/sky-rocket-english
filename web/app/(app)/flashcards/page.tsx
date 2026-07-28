import { getCurrentUserId } from '@/lib/current-user';
import { catchUpModuleIntroductions, getDueCards } from '@/lib/use-cases/flashcards';

// The due-card queue changes with every review — must be dynamic, not build-time static (see app/page.tsx).
export const dynamic = 'force-dynamic';
import { FlashcardPlayer } from '@/components/player/FlashcardPlayer';

// UC-15 SRS flashcard player (ARCHITECTURE.md §1.4, §7.1 `/flashcards`).
// `?course=<slug>` runs one course's deck — the review hub links here per
// course so a run is never half German, half English.
export default async function FlashcardsPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const userId = await getCurrentUserId();
  // Picks up cards a started module became eligible for since its intro step:
  // a later vocab batch, or the reverse side of every word after 0005.
  await catchUpModuleIntroductions(userId);
  const { course } = await searchParams;
  const { cards, totalDue } = await getDueCards(userId, new Date(), undefined, course);
  return <FlashcardPlayer cards={cards} totalDue={totalDue} backHref={course ? '/review' : '/'} />;
}
