import 'dotenv/config';
import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  /** Comma separated list of extra allowed CORS origins */
  CORS_ORIGINS: optional,
  COOKIE_DOMAIN: optional,
  /** Public base URL of this API (used for locally stored uploads) */
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  RAZORPAY_KEY_ID: optional,
  RAZORPAY_KEY_SECRET: optional,
  RAZORPAY_WEBHOOK_SECRET: optional,

  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_PUBLISHABLE_KEY: optional,

  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,
  CLOUDINARY_FOLDER: z.string().default('kashif-collection'),

  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  MAIL_FROM: z.string().default('Kashif Collection <no-reply@kashifcollection.in>'),
  ADMIN_NOTIFICATION_EMAIL: optional,

  ENABLE_JOBS: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

if (isProd && /dev_only|change_me/i.test(env.JWT_SECRET)) {
  // eslint-disable-next-line no-console
  console.error('❌ Refusing to start in production with a development JWT_SECRET.');
  process.exit(1);
}

export const features = {
  razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  stripe: Boolean(env.STRIPE_SECRET_KEY),
  cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  smtp: Boolean(env.SMTP_HOST),
};
