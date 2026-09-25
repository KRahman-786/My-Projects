import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

export const CLIENT_HEADER = 'x-kc-client';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated requests.
 * State-changing requests must carry a custom header. Browsers cannot attach custom headers to
 * cross-site form posts, and cross-origin fetches with custom headers require a CORS preflight,
 * which is only granted to our own frontend origins. Combined with SameSite=Lax cookies this blocks CSRF.
 * Bearer-token requests (non-browser clients) and signed webhooks are exempt.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  // Webhooks are authenticated by their HMAC signatures instead.
  if (/^\/api\/payments\/(razorpay|stripe)\/webhook\/?$/.test(req.originalUrl.split('?')[0]!)) return next();
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  if (!req.headers[CLIENT_HEADER]) {
    throw AppError.forbidden('Missing client header', 'CSRF_CHECK_FAILED');
  }
  next();
}
