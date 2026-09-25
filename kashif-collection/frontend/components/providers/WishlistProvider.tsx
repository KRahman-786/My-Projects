'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { wishlistApi } from '@/services/account';
import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';
import { errorMessage } from '@/lib/api';

interface WishlistContextValue {
  ids: Set<string>;
  toggle: (productId: string, name?: string) => Promise<void>;
}
const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const { data } = useQuery({ queryKey: ['wishlist-ids', user?.id], queryFn: wishlistApi.ids, enabled: Boolean(user), staleTime: 60_000 });

  const toggle = useCallback(
    async (productId: string, name?: string) => {
      if (!user) {
        toast('Log in to save items to your wishlist', 'info');
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const current = new Set(data ?? []);
      const had = current.has(productId);
      // Optimistic update
      qc.setQueryData(['wishlist-ids', user.id], had ? [...current].filter((i) => i !== productId) : [...current, productId]);
      try {
        if (had) await wishlistApi.remove(productId);
        else await wishlistApi.add(productId);
        toast(had ? 'Removed from wishlist' : `${name ?? 'Item'} saved to wishlist`, 'success', had ? undefined : { label: 'View', href: '/wishlist' });
        void qc.invalidateQueries({ queryKey: ['wishlist'] });
      } catch (e) {
        qc.setQueryData(['wishlist-ids', user.id], [...current]);
        toast(errorMessage(e), 'error');
      }
    },
    [user, data, qc, toast, router],
  );

  const value = useMemo(() => ({ ids: new Set(data ?? []), toggle }), [data, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
