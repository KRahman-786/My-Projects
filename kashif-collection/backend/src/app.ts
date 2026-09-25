import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env, isProd, isTest } from './config/env';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { csrfProtection, CLIENT_HEADER } from './middleware/csrf';
import { apiLimiter } from './middleware/rateLimit';
import { clientIp } from './middleware/clientIp';
import { UPLOAD_DIR } from './services/storage.service';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      // Allow images served from /uploads (dev storage) to be embedded by the storefront origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    }),
  );

  const allowedOrigins = new Set([env.FRONTEND_URL, ...(env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [])]);
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', CLIENT_HEADER],
      maxAge: 600,
    }),
  );

  app.use(compression());
  app.use(
    express.json({
      limit: '1mb',
      // Webhook signatures are computed over the exact raw bytes, so keep them for those routes.
      verify: (req, _res, buf) => {
        if ((req as Request).originalUrl?.includes('/webhook')) (req as Request).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  if (!isTest) app.use(morgan(isProd ? 'combined' : 'dev'));

  if (!isProd) app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

  app.use('/api', clientIp, apiLimiter, csrfProtection, apiRouter);
  app.get('/', (_req, res) => res.json({ success: true, data: { name: 'Kashif Collection API', docs: '/api/health' } }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
