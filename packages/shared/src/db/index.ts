import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { __spravkaPrisma?: PrismaClient };

export const prisma =
  g.__spravkaPrisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'] });

if (process.env.NODE_ENV !== 'production') g.__spravkaPrisma = prisma;

// Re-export generated types + enums so apps get them from one place.
export * from '@prisma/client';
