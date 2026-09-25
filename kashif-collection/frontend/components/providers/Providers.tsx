'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './ToastProvider';
import { AuthProvider } from './AuthProvider';
import { CartProvider } from './CartProvider';
import { WishlistProvider } from './WishlistProvider';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>{children}</WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
