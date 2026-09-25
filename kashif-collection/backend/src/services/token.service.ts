import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { env, isProd } from '../config/env';

export const SESSION_COOKIE = 'kc_session';

interface SessionPayload {
  sub: string;
  tv: number;
}

export function signSessionToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ tv: tokenVersion }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: `${env.JWT_EXPIRES_IN_DAYS}d`,
    issuer: 'kashif-collection',
    algorithm: 'HS256',
  });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: 'kashif-collection', algorithms: ['HS256'] });
    if (typeof decoded !== 'object' || !decoded.sub || typeof decoded.tv !== 'number') return null;
    return { sub: decoded.sub, tv: decoded.tv };
  } catch {
    return null;
  }
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    domain: env.COOKIE_DOMAIN,
    maxAge: env.JWT_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export function clearSessionCookie(res: Response) {
  const { maxAge: _maxAge, ...opts } = cookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
}
