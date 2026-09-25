import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { lowStockCount } from './inventory.service';

/** Orders that count as sales: confirmed or paid, not cancelled/refunded, not awaiting payment. */
const SALE_STATUSES = ['CONFIRMED', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED'] as const;
const saleStatusSql = Prisma.join(SALE_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`));

/** Start of "today" in India Standard Time, expressed as a UTC Date. */
function startOfTodayIST(): Date {
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 330 * 60_000);
}

export async function getDashboard() {
  const today = startOfTodayIST();
  const saleWhere = { status: { in: [...SALE_STATUSES] } };

  const [todayAgg, totalAgg, customers, products, pendingOrders, lowStock, refundRequests, returnRequests] = await Promise.all([
    prisma.order.aggregate({ where: { ...saleWhere, placedAt: { gte: today } }, _sum: { grandTotal: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: saleWhere, _sum: { grandTotal: true }, _count: { _all: true } }),
    prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.order.count({ where: { status: { in: ['CONFIRMED', 'PAID', 'PROCESSING', 'PACKED'] } } }),
    lowStockCount(),
    prisma.refund.count({ where: { status: { in: ['PENDING', 'FAILED'] } } }),
    prisma.return.count({ where: { status: { in: ['REQUESTED', 'APPROVED'] } } }),
  ]);

  const [daily, monthly, byCategory, bestSellers, paymentMethods, byStatus, recentOrders] = await Promise.all([
    prisma.$queryRaw<{ day: string; revenue: bigint; orders: bigint }[]>`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(o."grandTotal"), 0)::bigint AS revenue,
             COUNT(o."id")::bigint AS orders
        FROM generate_series((NOW() AT TIME ZONE 'Asia/Kolkata')::date - 29, (NOW() AT TIME ZONE 'Asia/Kolkata')::date, '1 day') AS d(day)
        LEFT JOIN "orders" o ON (o."placedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date = d.day AND o."status" IN (${saleStatusSql})
       GROUP BY d.day ORDER BY d.day`,
    prisma.$queryRaw<{ month: string; revenue: bigint; orders: bigint }[]>`
      SELECT to_char(m.month, 'YYYY-MM') AS month,
             COALESCE(SUM(o."grandTotal"), 0)::bigint AS revenue,
             COUNT(o."id")::bigint AS orders
        FROM generate_series(date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '11 months', date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata'), '1 month') AS m(month)
        LEFT JOIN "orders" o ON date_trunc('month', o."placedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = m.month AND o."status" IN (${saleStatusSql})
       GROUP BY m.month ORDER BY m.month`,
    prisma.$queryRaw<{ category: string; revenue: bigint; units: bigint }[]>`
      SELECT c."name" AS category, COALESCE(SUM(oi."lineTotal" - oi."couponShare"), 0)::bigint AS revenue, COALESCE(SUM(oi."quantity"), 0)::bigint AS units
        FROM "order_items" oi
        JOIN "orders" o ON o."id" = oi."orderId" AND o."status" IN (${saleStatusSql})
        JOIN "products" p ON p."id" = oi."productId"
        JOIN "categories" c ON c."id" = p."categoryId"
       GROUP BY c."name" ORDER BY revenue DESC`,
    prisma.$queryRaw<{ name: string; slug: string; units: bigint; revenue: bigint }[]>`
      SELECT oi."productName" AS name, oi."productSlug" AS slug, SUM(oi."quantity")::bigint AS units, SUM(oi."lineTotal" - oi."couponShare")::bigint AS revenue
        FROM "order_items" oi
        JOIN "orders" o ON o."id" = oi."orderId" AND o."status" IN (${saleStatusSql})
       GROUP BY oi."productName", oi."productSlug" ORDER BY units DESC LIMIT 10`,
    prisma.order.groupBy({ by: ['paymentMethod'], where: saleWhere, _count: { _all: true }, _sum: { grandTotal: true } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { orderNumber: true, status: true, paymentStatus: true, paymentMethod: true, grandTotal: true, createdAt: true, shipName: true },
    }),
  ]);

  return {
    stats: {
      todaySales: todayAgg._sum.grandTotal ?? 0,
      todayOrders: todayAgg._count._all,
      totalRevenue: totalAgg._sum.grandTotal ?? 0,
      totalOrders: totalAgg._count._all,
      totalCustomers: customers,
      totalProducts: products,
      pendingOrders,
      lowStockProducts: lowStock,
      refundRequests: refundRequests + returnRequests,
    },
    charts: {
      dailySales: daily.map((d) => ({ date: d.day, revenue: Number(d.revenue), orders: Number(d.orders) })),
      monthlySales: monthly.map((m) => ({ month: m.month, revenue: Number(m.revenue), orders: Number(m.orders) })),
      categorySales: byCategory.map((c) => ({ category: c.category, revenue: Number(c.revenue), units: Number(c.units) })),
      bestSellers: bestSellers.map((b) => ({ name: b.name, slug: b.slug, units: Number(b.units), revenue: Number(b.revenue) })),
      paymentMethods: paymentMethods.map((p) => ({ method: p.paymentMethod, orders: p._count._all, revenue: p._sum.grandTotal ?? 0 })),
      ordersByStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })).sort((a, b) => b.count - a.count),
    },
    recentOrders,
  };
}
