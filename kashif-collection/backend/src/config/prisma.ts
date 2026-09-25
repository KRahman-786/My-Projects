import { PrismaClient } from '@prisma/client';
import { isProd } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error'] : ['error', 'warn'],
  });

if (!isProd) globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
