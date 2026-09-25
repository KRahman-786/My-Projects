import type { NextFunction, Request, Response } from 'express';
import { safeEqual } from '../utils/crypto';
import { env } from '../config/env';

export const PROXY_SECRET_HEADER = 'x-proxy-secret';
export const CLIENT_IP_HEADER = 'x-client-ip';

/**
 * Resolves the visitor IP. Requests relayed by our Next.js proxy carry the visitor IP in X-Client-IP,
 * which is trusted only when accompanied by the shared PROXY_SHARED_SECRET — so clients cannot spoof it.
 * Everything else uses Express' req.ip (governed by TRUST_PROXY).
 */
export function clientIp(req: Request, _res: Response, next: NextFunction) {
  const secret = req.headers[PROXY_SECRET_HEADER];
  const forwarded = req.headers[CLIENT_IP_HEADER];
  if (env.PROXY_SHARED_SECRET && typeof secret === 'string' && typeof forwarded === 'string' && safeEqual(secret, env.PROXY_SHARED_SECRET)) {
    req.clientIp = forwarded.split(',')[0]!.trim().slice(0, 64);
  } else {
    req.clientIp = req.ip;
  }
  next();
}
