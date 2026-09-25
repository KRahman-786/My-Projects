import type { PaginationMeta } from './response';

export function getPagination(page = 1, limit = 20, maxLimit = 60) {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), maxLimit);
  const safePage = Math.max(1, Math.floor(page));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit, take: safeLimit };
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
