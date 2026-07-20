/**
 * The auth boundary (ARCHITECTURE.md §8 D10). Runs before every page and
 * Server Action request and does two things:
 *
 *  1. **Gate.** No valid session → redirect to `/login`. A signed-in user
 *     landing on `/login` or `/register` → redirect to `/`.
 *  2. **Silent refresh.** Access token expired but the refresh token still
 *     valid → mint a new access token, hand it to the current request *and*
 *     set it on the response. Doing renewal here, in one place, is what lets
 *     `lib/auth/session.ts` trust the access cookie unconditionally.
 *
 * Runs in the Edge runtime, so it must not touch Prisma: everything it needs
 * (user id, username) is inside the signed token. A user deleted from the
 * database therefore keeps a working token until it expires — acceptable at
 * this scale, and the page's own DB reads fail closed anyway.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearedCookieOptions,
} from '@/lib/auth/cookies';
import { signAccessToken, verifyToken } from '@/lib/auth/tokens';

const AUTH_ROUTES = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const accessClaims = await verifyToken(request.cookies.get(ACCESS_COOKIE)?.value, 'access');
  if (accessClaims) {
    if (isAuthRoute) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  const refreshClaims = await verifyToken(request.cookies.get(REFRESH_COOKIE)?.value, 'refresh');
  if (refreshClaims) {
    if (isAuthRoute) return NextResponse.redirect(new URL('/', request.url));

    const accessToken = await signAccessToken(refreshClaims);
    // Setting it on `request.cookies` before forwarding makes the *current*
    // render see the fresh token; setting it on the response persists it in
    // the browser. Both are needed — without the first, the page this
    // request is already serving would still look signed out.
    request.cookies.set(ACCESS_COOKIE, accessToken);
    const response = NextResponse.next({ request });
    response.cookies.set(ACCESS_COOKIE, accessToken, accessCookieOptions());
    return response;
  }

  // Genuinely signed out. The auth pages themselves must stay reachable.
  if (isAuthRoute) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  // Remember where they were headed so login can send them back, but only
  // for real navigation — bouncing a Server Action POST to a URL is
  // meaningless, the client just needs the redirect.
  if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`);

  const response = NextResponse.redirect(loginUrl);
  // A refresh cookie that failed verification is expired or forged; clearing
  // it stops every subsequent request from re-testing the same dead token.
  if (request.cookies.has(REFRESH_COOKIE)) {
    response.cookies.set(REFRESH_COOKIE, '', clearedCookieOptions());
    response.cookies.set(ACCESS_COOKIE, '', clearedCookieOptions());
  }
  return response;
}

export const config = {
  // Everything except Next's own assets and static files. `_next/static` and
  // `_next/image` are public by design; matching them would just burn CPU on
  // every asset request.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|webmanifest)$).*)'],
};
