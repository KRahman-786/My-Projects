'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auth } from '@/services/account';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: auth.session,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const value: AuthContextValue = {
    user: data ?? null,
    isLoading,
    refresh: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
    logout: async () => {
      await auth.logout().catch(() => undefined);
      qc.setQueryData(['me'], null);
      qc.removeQueries({ queryKey: ['cart'] });
      qc.removeQueries({ queryKey: ['wishlist'] });
      qc.removeQueries({ queryKey: ['wishlist-ids'] });
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
