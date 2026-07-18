import { prisma } from './db';

/**
 * Single hardcoded user for now (ARCHITECTURE.md §0, §8 D10) — no auth flow
 * exists yet. Every repository/use-case still takes `userId` as a real
 * parameter rather than reading a global, so swapping this for a real
 * session lookup (bcrypt + jose, cookie-based — see the interview-prep
 * reference's lib/auth.ts) later touches only this file.
 *
 * Resolves + caches the id of the row scripts/seed-user.ts creates for
 * APP_USER_USERNAME. This is a narrow, intentional exception to "Prisma
 * only in lib/repositories/* and scripts/*" (ARCHITECTURE §2) — user
 * identity resolution isn't a content/domain repository, it's the identity
 * of the auth boundary itself, same footing as lib/db.ts.
 */
let cachedUserId: number | null = null;

export async function getCurrentUserId(): Promise<number> {
  if (cachedUserId !== null) return cachedUserId;
  const username = process.env.APP_USER_USERNAME ?? 'pavel';
  const user = await prisma.app_user.findUniqueOrThrow({ where: { username } });
  cachedUserId = Number(user.id);
  return cachedUserId;
}
