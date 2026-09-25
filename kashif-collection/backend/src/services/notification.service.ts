import type { NotificationType } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { env } from '../config/env';
import { sendMail } from './mailer.service';

interface NotifyInput {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export async function notifyUser(userId: string, input: NotifyInput, db: Tx | typeof prisma = prisma) {
  await db.notification.create({ data: { userId, audience: 'CUSTOMER', ...input } });
}

export async function notifyAdmins(input: NotifyInput, db: Tx | typeof prisma = prisma) {
  await db.notification.create({ data: { userId: null, audience: 'ADMIN', ...input } });
  if (env.ADMIN_NOTIFICATION_EMAIL) {
    void sendMail({ to: env.ADMIN_NOTIFICATION_EMAIL, subject: `[Kashif Collection] ${input.title}`, text: input.message });
  }
}

export async function listUserNotifications(userId: string) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
}

export async function markNotificationsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}

export async function listAdminNotifications() {
  return prisma.notification.findMany({ where: { audience: 'ADMIN' }, orderBy: { createdAt: 'desc' }, take: 50 });
}

export async function markAdminNotificationsRead() {
  await prisma.notification.updateMany({ where: { audience: 'ADMIN', isRead: false }, data: { isRead: true } });
}
