import { redirect } from 'next/navigation';
import { getSessionClaims } from './auth/session';

/**
 * The identity of the current request (ARCHITECTURE.md §0, §8 D10).
 *
 * Every repository and use-case already takes `userId` as a real parameter,
 * so swapping the old single-hardcoded-user stub for a real cookie session
 * touched only this file, exactly as its previous incarnation predicted.
 * Progress tables are all keyed by `user_id`, which is what makes each
 * registered learner's progress independent.
 *
 * This is a narrow, intentional exception to "Prisma only in
 * lib/repositories/*" (ARCHITECTURE §2) — user identity resolution isn't a
 * content/domain repository, it's the identity of the auth boundary itself,
 * same footing as lib/db.ts. (It no longer touches Prisma at all: the id
 * comes from the signed access token.)
 *
 * Deliberately not cached across requests: a module-level cache is shared by
 * every concurrent request on the instance and would leak one user's id into
 * another user's session.
 */
export async function getCurrentUserId(): Promise<number> {
  const claims = await getSessionClaims();
  // `middleware.ts` normally redirects unauthenticated traffic long before a
  // page renders; reaching this branch means the cookie died mid-request, so
  // send them to the login form rather than throwing a 500 at them.
  if (!claims) redirect('/login');
  return claims.userId;
}

/** The same identity, minus the redirect — for UI that renders differently when signed out. */
export async function getCurrentUser(): Promise<{ userId: number; username: string } | null> {
  const claims = await getSessionClaims();
  return claims ? { userId: claims.userId, username: claims.username } : null;
}
