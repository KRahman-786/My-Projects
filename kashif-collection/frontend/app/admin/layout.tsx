import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import type { User } from '@/types';
import { AdminShell } from '@/components/admin/AdminShell';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin · Kashif Collection' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Server-side role check: non-admins never receive the admin UI. The API enforces the same rule on every request. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await serverApi<{ user: User | null }>('/auth/session').catch(() => ({ user: null }));
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'ADMIN') redirect('/');
  return <AdminShell user={user}>{children}</AdminShell>;
}
