import { NextResponse, type NextRequest } from 'next/server';

/**
 * Fast redirect for signed-out visitors. This only checks that a session cookie exists;
 * the API remains the authority (every request is verified server-side, and the admin
 * layout additionally verifies the ADMIN role).
 */
export function middleware(req: NextRequest) {
  if (!req.cookies.get('kc_session')?.value) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/account/:path*', '/checkout/:path*', '/admin/:path*'] };
