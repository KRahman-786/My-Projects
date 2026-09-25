import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';

const handler = (_req: unknown, res: import('express').Response) =>
  res.status(429).json({ success: false, message: 'Too many requests, please try again later.', errorCode: 'RATE_LIMITED' });

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  handler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  handler,
});

export const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  handler,
});
