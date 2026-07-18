import { PrismaClient } from '@prisma/client';

// Singleton across HMR reloads in dev (ARCHITECTURE.md §2, ported from
// ../concurrency/web/lib/db.ts). This is the ONLY place `lib/repositories/*`
// should import PrismaClient from — see the layering rule in ARCHITECTURE §2.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
