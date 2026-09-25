import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { buildMeta, getPagination } from '../utils/pagination';

// Never select passwordHash / tokenVersion for admin views.
const customerSelect = { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true, lastLoginAt: true } as const;

export async function listCustomers(params: { q?: string; status?: 'active' | 'inactive'; page: number; limit: number }) {
  const p = getPagination(params.page, params.limit, 100);
  const where: Prisma.UserWhereInput = {
    role: 'CUSTOMER',
    deletedAt: null,
    ...(params.status ? { isActive: params.status === 'active' } : {}),
    ...(params.q
      ? { OR: [{ name: { contains: params.q, mode: 'insensitive' } }, { email: { contains: params.q, mode: 'insensitive' } }, { phone: { contains: params.q } }] }
      : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, select: { ...customerSelect, _count: { select: { orders: true } } }, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }),
    prisma.user.count({ where }),
  ]);
  const spend = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: users.map((u) => u.id) }, status: { notIn: ['PENDING', 'CANCELLED', 'REFUNDED'] } },
    _sum: { grandTotal: true },
  });
  return {
    items: users.map(({ _count, ...u }) => ({ ...u, orderCount: _count.orders, totalSpent: spend.find((s) => s.userId === u.id)?._sum.grandTotal ?? 0 })),
    meta: buildMeta(p.page, p.limit, total),
  };
}

export async function getCustomer(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, role: 'CUSTOMER', deletedAt: null },
    select: {
      ...customerSelect,
      addresses: { orderBy: { isDefault: 'desc' } },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { orderNumber: true, status: true, paymentStatus: true, paymentMethod: true, grandTotal: true, createdAt: true },
      },
      _count: { select: { reviews: true, orders: true } },
    },
  });
  if (!user) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');
  const spend = await prisma.order.aggregate({ where: { userId: id, status: { notIn: ['PENDING', 'CANCELLED', 'REFUNDED'] } }, _sum: { grandTotal: true } });
  return { ...user, totalSpent: spend._sum.grandTotal ?? 0 };
}

/** Deactivation also revokes all existing sessions (tokenVersion bump). */
export async function setCustomerActive(id: string, isActive: boolean) {
  const user = await prisma.user.findFirst({ where: { id, role: 'CUSTOMER', deletedAt: null } });
  if (!user) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');
  return prisma.user.update({
    where: { id },
    data: { isActive, ...(isActive ? {} : { tokenVersion: { increment: 1 } }) },
    select: customerSelect,
  });
}
