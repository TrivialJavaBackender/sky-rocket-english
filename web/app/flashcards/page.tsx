import { getCurrentUserId } from '@/lib/current-user';
import { getDueCards } from '@/lib/use-cases/flashcards';

// The due-card queue changes with every review — must be dynamic, not build-time static (see app/page.tsx).
export const dynamic = 'force-dynamic';
import { FlashcardPlayer } from '@/components/player/FlashcardPlayer';

// UC-15 SRS flashcard player (ARCHITECTURE.md §1.4, §7.1 `/flashcards`).
export default async function FlashcardsPage() {
  const userId = await getCurrentUserId();
  const cards = await getDueCards(userId);
  return <FlashcardPlayer cards={cards} backHref="/" />;
}
