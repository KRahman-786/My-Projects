import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { isTest } from '../config/env';

/** Rate limits key on the real visitor IP (see clientIp middleware), normalised for IPv6 subnets. */
const keyGenerator = (req: Request) => ipKeyGenerator(req.clientIp ?? req.ip ?? 'unknown');

const handler = (_req: unknown, res: import('express').Response) =>
  res.status(429).json({ success: false, message: 'Too many requests, please try again later.', errorCode: 'RATE_LIMITED' });

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator,
  handler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator,
  handler,
});

export const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator,
  handler,
});
