import { isProd, isTest } from './env';

type Level = 'debug' | 'info' | 'warn' | 'error';
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel: Level = isTest ? 'error' : isProd ? 'info' : 'debug';

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  if (order[level] < order[minLevel]) return;
  const entry = { level, time: new Date().toISOString(), message, ...(meta ?? {}) };
  const line = isProd ? JSON.stringify(entry) : `[${entry.time}] ${level.toUpperCase()} ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => log('debug', m, meta),
  info: (m: string, meta?: Record<string, unknown>) => log('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log('error', m, meta),
};
