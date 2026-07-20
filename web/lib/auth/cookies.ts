/**
 * Cookie contract for the session (ARCHITECTURE.md §8 D10). Shared by the
 * server actions in `app/actions/auth.ts` (which own login/logout) and by
 * `middleware.ts` (which refreshes the access cookie in place), so the flags
 * are defined exactly once.
 *
 * Both cookies are httpOnly — no client JS ever reads them — and `sameSite:
 * lax`, which still sends them on top-level navigation (so a bookmarked
 * `/progress` works) while blocking cross-site form posts.
 */
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './tokens';

export const ACCESS_COOKIE = 'sr_access';
export const REFRESH_COOKIE = 'sr_refresh';

type CookieOptions = {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
};

/**
 * `secure` is off in development because localhost is plain HTTP and a
 * secure cookie would simply never be stored; Netlify serves HTTPS, so it
 * is on everywhere else.
 */
function baseOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

export const accessCookieOptions = () => baseOptions(ACCESS_TOKEN_TTL_SECONDS);
export const refreshCookieOptions = () => baseOptions(REFRESH_TOKEN_TTL_SECONDS);

/** maxAge 0 expires the cookie immediately — used by logout and by middleware when a refresh token is rejected. */
export const clearedCookieOptions = () => baseOptions(0);
