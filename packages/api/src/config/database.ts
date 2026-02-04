import { PrismaClient } from '@prisma/client';
import { config } from './index.js';

// Create Prisma client with logging based on environment
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      config.nodeEnv === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    errorFormat: config.nodeEnv === 'development' ? 'pretty' : 'minimal',
  });

// Prevent multiple instances in development
if (config.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown handler
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

// Health check for database
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export default prisma;
