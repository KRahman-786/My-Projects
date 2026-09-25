import { prisma } from '../config/prisma';
import { buildMeta, getPagination } from '../utils/pagination';
import { notifyAdmins } from './notification.service';

export async function submitContactMessage(input: { name: string; email: string; phone?: string; subject: string; message: string }) {
  const msg = await prisma.contactMessage.create({ data: input });
  await notifyAdmins({ type: 'SYSTEM', title: 'New contact message', message: `${input.name}: ${input.subject}`, link: '/admin/messages' });
  return { id: msg.id };
}

export async function listContactMessages(page = 1, limit = 30) {
  const p = getPagination(page, limit);
  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }),
    prisma.contactMessage.count(),
  ]);
  return { items, meta: buildMeta(p.page, p.limit, total) };
}

export async function markContactHandled(id: string, isHandled: boolean) {
  return prisma.contactMessage.update({ where: { id }, data: { isHandled } });
}
