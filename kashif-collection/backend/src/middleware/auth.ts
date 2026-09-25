import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { SESSION_COOKIE, verifySessionToken } from '../services/token.service';

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = req.cookies?.[SESSION_COOKIE];
  return typeof cookie === 'string' && cookie.length > 0 ? cookie : undefined;
}

async function resolveUser(req: Request): Promise<Express.AuthUser | undefined> {
  const token = extractToken(req);
  if (!token) return undefined;
  const payload = verifySessionToken(token);
  if (!payload) return undefined;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true, isActive: true, tokenVersion: true, deletedAt: true },
  });
  if (!user || !user.isActive || user.deletedAt || user.tokenVersion !== payload.tv) return undefined;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Attaches req.user when a valid session exists; never fails. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = await resolveUser(req);
  next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await resolveUser(req);
  if (!user) throw AppError.unauthorized();
  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
}

/** Narrowing helper for controllers behind requireAuth. */
export function currentUser(req: Request): Express.AuthUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
