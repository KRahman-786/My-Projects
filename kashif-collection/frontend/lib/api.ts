import type { ApiEnvelope } from '@/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errorCode: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const isServer = typeof window === 'undefined';

/** Browser → same-origin proxy (/api). Server → backend directly. */
export function apiBase(): string {
  if (isServer) return `${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/api`;
  return process.env.NEXT_PUBLIC_API_URL || '/api';
}

type Query = Record<string, string | number | boolean | undefined | null | string[]>;

export function toQueryString(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Query;
  /** Forwarded cookie header (server components) */
  cookie?: string;
  /** Next.js fetch cache revalidation in seconds (server only) */
  revalidate?: number | false;
}

/** Full envelope (data + meta + message). Throws ApiError on non-2xx responses. */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { body, query, cookie, revalidate, headers, ...init } = opts;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}${toQueryString(query)}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        'x-kc-client': 'web',
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      ...(isServer ? (revalidate === false || cookie ? { cache: 'no-store' as const } : { next: { revalidate: revalidate ?? 60 } }) : {}),
    });
  } catch {
    throw new ApiError('Unable to reach the server. Please check your internet connection.', 0, 'NETWORK_ERROR');
  }

  let json: (ApiEnvelope<T> & { errorCode?: string; details?: unknown }) | null = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok || !json || json.success === false) {
    throw new ApiError(json?.message ?? `Request failed (${res.status})`, res.status, json?.errorCode ?? 'UNKNOWN_ERROR', json?.details);
  }
  return json;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return (await apiRequest<T>(path, opts)).data;
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
