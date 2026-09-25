'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { auth, misc } from '@/services/account';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDateTime } from '@/utils/format';

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState<'profile' | 'pw' | null>(null);
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: misc.notifications, enabled: Boolean(user) });

  useEffect(() => {
    if (user) setProfile({ name: user.name, phone: user.phone ?? '' });
  }, [user]);

  if (isLoading || !user) return <Skeleton className="h-80 w-full rounded-2xl" />;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('profile');
    try {
      const { user: u } = await auth.updateProfile({ name: profile.name, phone: profile.phone || null });
      qc.setQueryData(['me'], u);
      toast('Profile updated');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('pw');
    try {
      await auth.changePassword(pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast('Password changed. Other devices have been signed out.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(null);
    }
  };

  const unread = notifications.data?.filter((n) => !n.isRead) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-semibold">My profile</h1>
      <section className="card p-6 md:p-8">
        <h2 className="font-semibold">Personal details</h2>
        <form onSubmit={saveProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="Full name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
          <Input label="Mobile number" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} inputMode="tel" />
          <Input label="Email" value={user.email} disabled hint="Contact support to change your email" />
          <div className="flex items-end">
            <Button type="submit" loading={saving === 'profile'}>
              Save changes
            </Button>
          </div>
        </form>
      </section>

      <section className="card p-6 md:p-8">
        <h2 className="font-semibold">Change password</h2>
        <form onSubmit={changePassword} className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
          <Input label="New password" type="password" autoComplete="new-password" hint="8+ characters with a letter and a number" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />
          <div>
            <Button type="submit" variant="outline" loading={saving === 'pw'}>
              Update password
            </Button>
          </div>
        </form>
      </section>

      <section className="card p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Bell className="h-4 w-4" /> Notifications {unread.length > 0 && <span className="rounded-full bg-plum-700 px-2 text-xs text-white">{unread.length}</span>}
          </h2>
          {unread.length > 0 && (
            <button onClick={() => void misc.readNotifications().then(() => notifications.refetch())} className="text-xs font-semibold text-plum-700">
              Mark all read
            </button>
          )}
        </div>
        {notifications.isLoading ? (
          <Skeleton className="mt-4 h-20 w-full" />
        ) : !notifications.data?.length ? (
          <p className="mt-4 text-sm text-ink-muted">No notifications yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {notifications.data.slice(0, 10).map((n) => (
              <li key={n.id} className="flex gap-3 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-line' : 'bg-plum-600'}`} />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-ink-soft">{n.message}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{formatDateTime(n.createdAt)}</p>
                </div>
                {n.link && (
                  <a href={n.link} className="self-center text-xs font-semibold text-plum-700">
                    View
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
