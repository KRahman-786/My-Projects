import type { NextRequest } from 'next/server';

/**
 * Same-origin proxy: browser → /api/* (this route) → backend /api/*.
 * Keeps the session cookie first-party, resolves the backend URL at runtime, and forwards the visitor IP
 * in X-Client-IP authenticated by PROXY_SHARED_SECRET so the API can rate-limit per visitor.
 * Payment webhooks should be pointed at the backend directly, not at this proxy.
 */
export const dynamic = 'force-dynamic';

const API = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');

// Hop-by-hop and length/encoding headers must not be copied between the two connections.
const DROP_REQUEST = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-length', 'x-client-ip', 'x-proxy-secret', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port']);
const DROP_RESPONSE = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length']);

/**
 * The visitor IP as seen by the platform in front of Next.js. On Vercel and behind a correctly configured
 * reverse proxy (nginx `proxy_set_header X-Real-IP $remote_addr`) these headers are set by the edge.
 */
function visitorIp(req: NextRequest): string {
  return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${API}/api/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!DROP_REQUEST.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set('x-client-ip', visitorIp(req));
  if (process.env.PROXY_SHARED_SECRET) headers.set('x-proxy-secret', process.env.PROXY_SHARED_SECRET);

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      redirect: 'manual',
      cache: 'no-store',
      // Required by Node's fetch when streaming a request body.
      ...(hasBody ? ({ duplex: 'half' } as Record<string, string>) : {}),
    });
  } catch {
    return Response.json({ success: false, message: 'The store is temporarily unavailable. Please try again shortly.', errorCode: 'UPSTREAM_UNAVAILABLE' }, { status: 502 });
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE.has(key.toLowerCase()) && key.toLowerCase() !== 'set-cookie') out.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) out.append('set-cookie', cookie);

  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
