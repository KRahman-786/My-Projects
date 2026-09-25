import 'server-only';
import { cookies } from 'next/headers';
import { api, apiRequest, type RequestOptions } from './api';

/** Server-component fetch that forwards the visitor's session cookie (never cached). */
export async function serverApi<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  return api<T>(path, { ...opts, cookie: cookieHeader || undefined, revalidate: false });
}

export async function serverApiRequest<T>(path: string, opts: RequestOptions = {}) {
  const cookieHeader = (await cookies()).toString();
  return apiRequest<T>(path, { ...opts, cookie: cookieHeader || undefined, revalidate: false });
}
