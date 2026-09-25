import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Consistent success envelope: { success: true, message?, data, meta? } */
export function ok<T>(res: Response, data: T, options: { status?: number; message?: string; meta?: PaginationMeta | Record<string, unknown> } = {}) {
  return res.status(options.status ?? 200).json({
    success: true,
    ...(options.message ? { message: options.message } : {}),
    data,
    ...(options.meta ? { meta: options.meta } : {}),
  });
}

export function created<T>(res: Response, data: T, message?: string) {
  return ok(res, data, { status: 201, message });
}
