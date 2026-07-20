'use server';

/**
 * UC-00 · Sign up / sign in / sign out (ARCHITECTURE.md §8 D10).
 *
 * These are the only places that mint cookies from scratch; `middleware.ts`
 * only ever refreshes the access cookie. Shaped for `useActionState`, so
 * they take the previous state and return `{ error }` to render back into
 * the form.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearedCookieOptions,
  refreshCookieOptions,
} from '@/lib/auth/cookies';
import { signAccessToken, signRefreshToken, type SessionClaims } from '@/lib/auth/tokens';
import * as authUseCase from '@/lib/use-cases/auth';

export type AuthFormState = { error: string } | null;

async function startSession(claims: SessionClaims): Promise<void> {
  const [accessToken, refreshToken] = await Promise.all([signAccessToken(claims), signRefreshToken(claims)]);
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, accessCookieOptions());
  store.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

/**
 * Only same-origin, path-absolute destinations survive: a `next` of
 * `//evil.example` or `https://evil.example` would otherwise turn the login
 * form into an open redirect.
 */
function safeRedirectTarget(raw: FormDataEntryValue | null): string {
  if (typeof raw !== 'string') return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password !== confirm) return { error: 'Passwords do not match.' };

  const result = await authUseCase.register(username, password);
  if (!result.ok) return { error: result.error };

  await startSession(result.claims);
  // Outside any try/catch on purpose: redirect() signals by throwing.
  redirect(safeRedirectTarget(formData.get('next')));
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  const result = await authUseCase.login(username, password);
  if (!result.ok) return { error: result.error };

  await startSession(result.claims);
  redirect(safeRedirectTarget(formData.get('next')));
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, '', clearedCookieOptions());
  store.set(REFRESH_COOKIE, '', clearedCookieOptions());
  redirect('/login');
}
