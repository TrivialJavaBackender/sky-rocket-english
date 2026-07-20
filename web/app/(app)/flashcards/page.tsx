import { getCurrentUserId } from '@/lib/current-user';
import { catchUpModuleIntroductions, getDueCards } from '@/lib/use-cases/flashcards';

// The due-card queue changes with every review — must be dynamic, not build-time static (see app/page.tsx).
export const dynamic = 'force-dynamic';
import { FlashcardPlayer } from '@/components/player/FlashcardPlayer';

// UC-15 SRS flashcard player (ARCHITECTURE.md §1.4, §7.1 `/flashcards`).
export default async function FlashcardsPage() {
  const userId = await getCurrentUserId();
  // Picks up cards a started module gained since its intro step — the reverse
  // side of every word, after 0005.
  await catchUpModuleIntroductions(userId);
  const cards = await getDueCards(userId);
  return <FlashcardPlayer cards={cards} backHref="/" />;
}
