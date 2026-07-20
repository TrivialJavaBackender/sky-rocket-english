/**
 * Reading the session out of the request cookies, for Server Components and
 * Server Actions (ARCHITECTURE.md §8 D10).
 *
 * Only ever trusts the *access* cookie. Keeping the refresh token out of
 * this path is the whole point of having two tokens: renewal happens in
 * exactly one place (`middleware.ts`), which every page and action request
 * passes through, so by the time this code runs the access cookie is
 * already fresh.
 *
 * Nothing is cached across requests here — a module-level cache would be
 * shared by all concurrent users on the same server instance and would hand
 * one learner another learner's progress.
 */
import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from './cookies';
import { verifyToken, type SessionClaims } from './tokens';

export async function getSessionClaims(): Promise<SessionClaims | null> {
  const store = await cookies();
  return verifyToken(store.get(ACCESS_COOKIE)?.value, 'access');
}
