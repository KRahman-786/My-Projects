import nodemailer, { type Transporter } from 'nodemailer';
import { env, features, isTest } from '../config/env';
import { logger } from '../config/logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!features.smtp) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/** Test hook: every message sent is kept here during tests. */
export const sentMail: MailMessage[] = [];

/**
 * Sends email through SMTP when configured (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
 * Without SMTP the message is written to the server log so development flows (password reset) still work.
 * Mail failures never break the calling business operation.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (isTest) {
    sentMail.push(message);
    return;
  }
  if (process.env.SEED_MODE === '1') return;
  const t = getTransporter();
  if (!t) {
    logger.info('📧 [mail:console] SMTP not configured — email logged instead of sent', {
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return;
  }
  try {
    await t.sendMail({ from: env.MAIL_FROM, ...message });
  } catch (error) {
    logger.error('Failed to send email', { to: message.to, subject: message.subject, error: (error as Error).message });
  }
}
