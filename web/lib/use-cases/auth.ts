/**
 * UC-00 · Registration and login (ARCHITECTURE.md §8 D10).
 *
 * Returns a result object instead of throwing on bad credentials: invalid
 * input is an expected outcome of a form submission, not an exception, and
 * the caller (`app/actions/auth.ts`) needs the message to render it back
 * into the form.
 *
 * No progress is created here. A new user's course enrollment and first
 * unlocked module are materialised lazily by `ensureActiveEnrollment` /
 * `ensureFirstModuleUnlocked` on their first dashboard visit, which is what
 * gives every user an independent progress state for free.
 */
import { compare, hash } from 'bcryptjs';
import * as userRepo from '../repositories/user.repo';
import type { SessionClaims } from '../auth/tokens';

const BCRYPT_COST = 12;

/**
 * A precomputed hash of a value nobody can supply, compared against when the
 * username doesn't exist so that a wrong username and a wrong password take
 * the same ~100ms. Without it, response time tells an attacker which
 * usernames are registered.
 */
const DUMMY_HASH = '$2b$12$he9YCyQl1J3iZ7I/IDmXH.CINgbKQDdXAFbLpiyHx7tSl0QoqHaEO';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

export type AuthResult = { ok: true; claims: SessionClaims } | { ok: false; error: string };

/** Lowercased and trimmed so "Pavel" and "pavel" can't become two accounts. */
function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function validateCredentials(username: string, password: string): string | null {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return 'Username may contain only letters, digits, dot, underscore and hyphen.';
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return `Password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters.`;
  }
  return null;
}

export async function register(rawUsername: string, password: string): Promise<AuthResult> {
  const username = normalizeUsername(rawUsername);
  const invalid = validateCredentials(username, password);
  if (invalid) return { ok: false, error: invalid };

  if (await userRepo.findByUsername(username)) {
    return { ok: false, error: 'That username is already taken.' };
  }

  try {
    const user = await userRepo.createUser(username, await hash(password, BCRYPT_COST));
    return { ok: true, claims: { userId: user.id, username: user.username } };
  } catch (e) {
    // The unique index is the real arbiter when two registrations race past
    // the availability check above.
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') {
      return { ok: false, error: 'That username is already taken.' };
    }
    throw e;
  }
}

export async function login(rawUsername: string, password: string): Promise<AuthResult> {
  const username = normalizeUsername(rawUsername);
  if (!username || !password) return { ok: false, error: 'Enter your username and password.' };

  const user = await userRepo.findByUsername(username);
  const matches = await compare(password, user?.passwordHash ?? DUMMY_HASH);

  // One message for both failure modes: naming which half was wrong would
  // confirm to an attacker that a username exists.
  if (!user || !matches) return { ok: false, error: 'Invalid username or password.' };

  return { ok: true, claims: { userId: user.id, username: user.username } };
}
