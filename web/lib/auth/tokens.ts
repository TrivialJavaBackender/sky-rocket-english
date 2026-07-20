/**
 * JWT minting/verification for the cookie session (ARCHITECTURE.md §8 D10).
 *
 * Two tokens, both HS256 and both signed with the same `AUTH_JWT_SECRET`:
 * a short-lived access token that every request carries, and a long-lived
 * refresh token that only exists so `middleware.ts` can mint a new access
 * token without a round-trip to the login form.
 *
 * Edge-safe on purpose: `jose` + `TextEncoder` only, no Node built-ins and
 * no Prisma — middleware runs in the Edge runtime and must be able to
 * validate a session without touching the database. That is also why the
 * payload carries `username`: it is the only user data available to code
 * running before the DB layer.
 */
// Deep imports, not the `jose` barrel: the barrel drags in the JWE decrypt
// path, whose DecompressionStream use makes Next warn that middleware pulls
// an unsupported Node API into the Edge runtime. We only ever sign/verify
// JWS, so importing just those two keeps the warning — and the bundle — away.
import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const ISSUER = 'skyrocket';

export type TokenKind = 'access' | 'refresh';

export type SessionClaims = {
  userId: number;
  username: string;
};

/**
 * Read lazily rather than at module load: `next build` imports this module
 * while prerendering, and a missing secret must fail the request that needs
 * a session, not the build itself (the build must succeed with no user and
 * no auth env — see scripts/README of stage 5).
 */
function secretKey(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error('AUTH_JWT_SECRET is not set — see web/.env.example.');
  if (secret.length < 32) throw new Error('AUTH_JWT_SECRET must be at least 32 characters.');
  return new TextEncoder().encode(secret);
}

async function sign(claims: SessionClaims, kind: TokenKind, ttlSeconds: number): Promise<string> {
  return new SignJWT({ username: claims.username, kind })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(claims.userId))
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey());
}

export function signAccessToken(claims: SessionClaims): Promise<string> {
  return sign(claims, 'access', ACCESS_TOKEN_TTL_SECONDS);
}

export function signRefreshToken(claims: SessionClaims): Promise<string> {
  return sign(claims, 'refresh', REFRESH_TOKEN_TTL_SECONDS);
}

/**
 * Returns the claims when `token` is a valid, unexpired token of exactly
 * `kind`, and null otherwise — expired, tampered, wrong kind, wrong issuer,
 * or minted under a different secret all collapse to the same null so
 * callers cannot accidentally treat one as recoverable. Checking `kind`
 * matters: without it a stolen refresh token would be accepted wherever an
 * access token is, defeating the short access TTL.
 */
export async function verifyToken(token: string | undefined, kind: TokenKind): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER });
    if (payload.kind !== kind) return null;
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    if (typeof payload.username !== 'string') return null;
    return { userId, username: payload.username };
  } catch {
    return null;
  }
}
