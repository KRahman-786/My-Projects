import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { startJobs, stopJobs } from './jobs/scheduler';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`🛍️  Kashif Collection API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

if (env.ENABLE_JOBS) startJobs();

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  stopJobs();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', { reason: String(reason) }));
