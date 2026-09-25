import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import multer from 'multer';
import { AppError } from '../utils/AppError';
import { isProd } from '../config/env';
import { logger } from '../config/logger';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found`, errorCode: 'ROUTE_NOT_FOUND' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let message = 'Something went wrong. Please try again.';
  let errorCode = 'INTERNAL_ERROR';
  let details: unknown;

  if (err instanceof AppError) {
    status = err.statusCode;
    message = err.message;
    errorCode = err.errorCode;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.issues[0] ? `${err.issues[0].path.join('.') || 'input'}: ${err.issues[0].message}` : 'Invalid input';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      errorCode = 'DUPLICATE_RESOURCE';
      const target = (err.meta?.target as string[] | string | undefined) ?? 'field';
      message = `A record with this ${Array.isArray(target) ? target.join(', ') : target} already exists`;
    } else if (err.code === 'P2025') {
      status = 404;
      errorCode = 'NOT_FOUND';
      message = 'Resource not found';
    } else if (err.code === 'P2003') {
      status = 409;
      errorCode = 'RELATION_CONSTRAINT';
      message = 'This record is referenced by other data and cannot be changed';
    }
  } else if (err instanceof multer.MulterError) {
    status = 400;
    errorCode = 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
  } else if (err instanceof SyntaxError && 'body' in (err as object)) {
    status = 400;
    errorCode = 'INVALID_JSON';
    message = 'Malformed JSON body';
  } else if (typeof err === 'object' && err && 'type' in err && (err as { type: string }).type === 'entity.too.large') {
    status = 413;
    errorCode = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  }

  if (status >= 500) {
    logger.error('Unhandled error', {
      path: req.path,
      method: req.method,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }

  res.status(status).json({
    success: false,
    message,
    errorCode,
    ...(details !== undefined ? { details } : {}),
    ...(!isProd && status >= 500 && err instanceof Error ? { stack: err.stack } : {}),
  });
}
