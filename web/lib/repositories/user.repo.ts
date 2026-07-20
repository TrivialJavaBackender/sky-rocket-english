/**
 * `app_user` reads/writes for the auth flow (ARCHITECTURE §8 D10). Only file
 * (with the other lib/repositories/* modules) allowed to import Prisma
 * (ARCHITECTURE §2) — everything the login/register use-case needs from the
 * database goes through here.
 *
 * Password hashing deliberately lives in lib/use-cases/auth.ts, not here:
 * repositories map rows, they don't hold policy.
 */
import { prisma } from '../db';
import { idToNumber } from '../serialize';

export interface UserDTO {
  id: number;
  username: string;
}

export interface UserWithHashDTO extends UserDTO {
  passwordHash: string;
}

export async function findByUsername(username: string): Promise<UserWithHashDTO | null> {
  const row = await prisma.app_user.findUnique({ where: { username } });
  if (!row) return null;
  return { id: idToNumber(row.id), username: row.username, passwordHash: row.password_hash };
}

export async function findById(id: number): Promise<UserDTO | null> {
  const row = await prisma.app_user.findUnique({ where: { id } });
  return row ? { id: idToNumber(row.id), username: row.username } : null;
}

/**
 * Throws Prisma's P2002 on a duplicate username. The caller checks
 * availability first for a friendly message, but the unique index is what
 * actually decides the race between two simultaneous registrations.
 */
export async function createUser(username: string, passwordHash: string): Promise<UserDTO> {
  const row = await prisma.app_user.create({
    data: { username, password_hash: passwordHash },
    select: { id: true, username: true },
  });
  return { id: idToNumber(row.id), username: row.username };
}
