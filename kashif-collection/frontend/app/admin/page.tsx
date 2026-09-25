'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { IndianRupee, ShoppingCart, Users, Package, Clock, AlertTriangle, RotateCcw, TrendingUp } from 'lucide-react';
import { admin } from '@/services/admin';
import { PageHeader, Panel, Table } from '@/components/admin/ui';
import { ChartCard, HBars, RevenueArea, VBars } from '@/components/admin/Charts';
import { Badge, statusTone } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDateTime, formatPrice, ORDER_STATUS_LABEL, titleCase } from '@/utils/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

export default function DashboardPage() {
  const q = useQuery({ queryKey: ['admin-dashboard'], queryFn: admin.dashboard, refetchInterval: 120_000 });

  if (q.isLoading)
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  if (q.isError || !q.data) return <ErrorState message="Could not load dashboard." onRetry={() => void q.refetch()} />;
  const { stats, charts, recentOrders } = q.data;

  const tiles = [
    { label: "Today's sales", value: formatPrice(stats.todaySales), icon: IndianRupee, href: '/admin/orders' },
    { label: "Today's orders", value: stats.todayOrders, icon: ShoppingCart, href: '/admin/orders' },
    { label: 'Total revenue', value: formatPrice(stats.totalRevenue), icon: TrendingUp, sub: `${stats.totalOrders} orders` },
    { label: 'Customers', value: stats.totalCustomers, icon: Users, href: '/admin/customers' },
    { label: 'Products', value: stats.totalProducts, icon: Package, href: '/admin/products' },
    { label: 'Orders to fulfil', value: stats.pendingOrders, icon: Clock, href: '/admin/orders?status=CONFIRMED', alert: stats.pendingOrders > 0 },
    { label: 'Low stock variants', value: stats.lowStockProducts, icon: AlertTriangle, href: '/admin/inventory?lowStock=true', alert: stats.lowStockProducts > 0 },
    { label: 'Returns & refunds', value: stats.refundRequests, icon: RotateCcw, href: '/admin/returns', alert: stats.refundRequests > 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Sales count confirmed, paid and in-fulfilment orders (excludes unpaid, cancelled and refunded)." />
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-ink-muted">{t.label}</p>
                <t.icon className={`h-4 w-4 ${t.alert ? 'text-danger' : 'text-plum-500'}`} aria-hidden />
              </div>
              <p className="mt-2 text-2xl font-bold text-ink md:text-[28px]">{t.value}</p>
              {t.sub && <p className="text-xs text-ink-muted">{t.sub}</p>}
              {t.alert && <p className="mt-0.5 text-xs font-medium text-danger">Needs attention</p>}
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="rounded-2xl border border-line bg-white p-4 transition hover:shadow-card md:p-5">
              {body}
            </Link>
          ) : (
            <div key={t.label} className="rounded-2xl border border-line bg-white p-4 md:p-5">
              {body}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Daily sales" subtitle="Revenue, last 30 days" table={{ head: ['Date', 'Revenue', 'Orders'], rows: charts.dailySales.map((d) => [d.date, formatPrice(d.revenue), d.orders]) }}>
          <RevenueArea data={charts.dailySales} xKey="date" tickFormatter={dayLabel} />
        </ChartCard>
        <ChartCard title="Monthly sales" subtitle="Revenue, last 12 months" table={{ head: ['Month', 'Revenue', 'Orders'], rows: charts.monthlySales.map((m) => [monthLabel(m.month), formatPrice(m.revenue), m.orders]) }}>
          <VBars data={charts.monthlySales} xKey="month" valueKey="revenue" tickFormatter={monthLabel} />
        </ChartCard>
        <ChartCard title="Sales by category" subtitle="Net revenue after coupons" table={{ head: ['Category', 'Revenue', 'Units'], rows: charts.categorySales.map((c) => [c.category, formatPrice(c.revenue), c.units]) }}>
          <HBars data={charts.categorySales} labelKey="category" valueKey="revenue" extra={(r) => `${r.units} units`} />
        </ChartCard>
        <ChartCard title="Best-selling products" subtitle="Units sold" table={{ head: ['Product', 'Units', 'Revenue'], rows: charts.bestSellers.map((b) => [b.name, b.units, formatPrice(b.revenue)]) }}>
          <HBars data={charts.bestSellers} labelKey="name" valueKey="units" extra={(r) => formatPrice(r.revenue as number)} />
        </ChartCard>
        <ChartCard title="Payment methods" subtitle="Revenue by method" table={{ head: ['Method', 'Orders', 'Revenue'], rows: charts.paymentMethods.map((p) => [p.method, p.orders, formatPrice(p.revenue)]) }}>
          <HBars data={charts.paymentMethods.map((p) => ({ ...p, label: p.method === 'COD' ? 'Cash on Delivery' : titleCase(p.method) }))} labelKey="label" valueKey="revenue" extra={(r) => `${r.orders} orders`} />
        </ChartCard>
        <ChartCard title="Orders by status" subtitle="All time" table={{ head: ['Status', 'Orders'], rows: charts.ordersByStatus.map((s) => [ORDER_STATUS_LABEL[s.status] ?? s.status, s.count]) }}>
          <HBars data={charts.ordersByStatus.map((s) => ({ ...s, label: ORDER_STATUS_LABEL[s.status] ?? s.status }))} labelKey="label" valueKey="count" />
        </ChartCard>
      </div>

      <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-xs font-semibold text-plum-700">View all</Link>}>
        <Table head={['Order', 'Customer', 'Date', 'Payment', 'Status', 'Total']} empty={!recentOrders.length}>
          {recentOrders.map((o) => (
            <tr key={o.orderNumber} className="hover:bg-ivory">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">
                <Link href={`/admin/orders/${o.orderNumber}`} className="text-plum-700 hover:underline">
                  {o.orderNumber}
                </Link>
              </td>
              <td className="px-4 py-3">{o.shipName}</td>
              <td className="px-4 py-3 text-ink-muted">{formatDateTime(o.createdAt)}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(o.paymentStatus)}>
                  {o.paymentMethod} · {o.paymentStatus.toLowerCase()}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge>
              </td>
              <td className="px-4 py-3 font-semibold">{formatPrice(o.grandTotal)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
