'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cartApi } from '@/services/account';
import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';
import { errorMessage } from '@/lib/api';
import type { Quote } from '@/types';

const GUEST_KEY = 'kc_guest_cart_v1';
const GUEST_COUPON_KEY = 'kc_guest_coupon_v1';

interface GuestItem {
  variantId: string;
  quantity: number;
}

function readGuest(): GuestItem[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as GuestItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => typeof i.variantId === 'string' && i.quantity > 0).slice(0, 50) : [];
  } catch {
    return [];
  }
}
function writeGuest(items: GuestItem[]) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable (private mode) — cart still works for this page view */
  }
}

interface CartContextValue {
  quote: Quote | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  count: number;
  isGuest: boolean;
  add: (variantId: string, quantity?: number, label?: string) => Promise<boolean>;
  setQuantity: (key: string, quantity: number) => Promise<void>;
  remove: (key: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
  refetch: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Guests: items live in localStorage and are priced by POST /api/cart/quote.
 * Logged in: the cart lives in PostgreSQL. On login the guest cart is merged once.
 * In both cases every price shown comes from the server.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [guestItems, setGuestItems] = useState<GuestItem[]>([]);
  const [guestCoupon, setGuestCoupon] = useState<string | undefined>();
  const merging = useRef(false);

  useEffect(() => {
    setGuestItems(readGuest());
    try {
      setGuestCoupon(localStorage.getItem(GUEST_COUPON_KEY) ?? undefined);
    } catch {
      /* ignore */
    }
  }, []);

  // Merge the guest cart into the account cart right after login.
  useEffect(() => {
    if (!user || merging.current) return;
    const items = readGuest();
    if (!items.length) return;
    merging.current = true;
    cartApi
      .merge(items)
      .then((q) => {
        qc.setQueryData(['cart', user.id], q);
        writeGuest([]);
        setGuestItems([]);
      })
      .catch(() => undefined)
      .finally(() => (merging.current = false));
  }, [user, qc]);

  const serverCart = useQuery({
    queryKey: ['cart', user?.id],
    queryFn: () => cartApi.get(),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const guestQuote = useQuery({
    queryKey: ['guest-quote', guestItems, guestCoupon],
    queryFn: () => cartApi.quote(guestItems, guestCoupon),
    enabled: !user && !authLoading && guestItems.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const setServer = useCallback((q: Quote) => qc.setQueryData(['cart', user?.id], q), [qc, user?.id]);

  const persistGuest = useCallback((items: GuestItem[]) => {
    writeGuest(items);
    setGuestItems(items);
  }, []);

  const mutation = useMutation({ mutationFn: async (fn: () => Promise<void>) => fn() });

  const add = useCallback(
    async (variantId: string, quantity = 1, label?: string) => {
      try {
        if (user) {
          setServer(await cartApi.add(variantId, quantity));
        } else {
          const items = readGuest();
          const existing = items.find((i) => i.variantId === variantId);
          const next = existing
            ? items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(10, i.quantity + quantity) } : i))
            : [...items, { variantId, quantity }];
          // Validate against live stock before committing locally.
          const q = await cartApi.quote(next, guestCoupon);
          const line = [...q.lines, ...q.unavailable].find((l) => l.variantId === variantId);
          if (line?.issue === 'OUT_OF_STOCK' || line?.issue === 'UNAVAILABLE') throw new Error('This item is currently out of stock');
          if (line?.issue === 'INSUFFICIENT_STOCK') throw new Error(`Only ${line.available} unit(s) available`);
          persistGuest(next);
          qc.setQueryData(['guest-quote', next, guestCoupon], q);
        }
        toast(`${label ?? 'Item'} added to your bag`, 'success', { label: 'View bag', href: '/cart' });
        return true;
      } catch (e) {
        toast(errorMessage(e), 'error');
        return false;
      }
    },
    [user, setServer, persistGuest, toast, guestCoupon, qc],
  );

  const setQuantity = useCallback(
    async (key: string, quantity: number) => {
      await mutation
        .mutateAsync(async () => {
          if (user) setServer(await cartApi.update(key, quantity));
          else persistGuest(readGuest().map((i) => (i.variantId === key ? { ...i, quantity } : i)));
        })
        .catch((e) => toast(errorMessage(e), 'error'));
    },
    [mutation, user, setServer, persistGuest, toast],
  );

  const remove = useCallback(
    async (key: string) => {
      await mutation
        .mutateAsync(async () => {
          if (user) setServer(await cartApi.remove(key));
          else persistGuest(readGuest().filter((i) => i.variantId !== key));
        })
        .catch((e) => toast(errorMessage(e), 'error'));
    },
    [mutation, user, setServer, persistGuest, toast],
  );

  const applyCoupon = useCallback(
    async (code: string) => {
      try {
        if (user) {
          setServer(await cartApi.applyCoupon(code));
        } else {
          const q = await cartApi.quote(readGuest(), code);
          if (q.couponError) throw new Error(q.couponError.message);
          try {
            localStorage.setItem(GUEST_COUPON_KEY, code);
          } catch {
            /* ignore */
          }
          setGuestCoupon(code);
        }
        toast('Coupon applied');
        return true;
      } catch (e) {
        toast(errorMessage(e), 'error');
        return false;
      }
    },
    [user, setServer, toast],
  );

  const removeCoupon = useCallback(async () => {
    if (user) setServer(await cartApi.removeCoupon());
    else {
      try {
        localStorage.removeItem(GUEST_COUPON_KEY);
      } catch {
        /* ignore */
      }
      setGuestCoupon(undefined);
    }
  }, [user, setServer]);

  const value = useMemo<CartContextValue>(() => {
    const quote = user ? (serverCart.data ?? null) : guestItems.length ? (guestQuote.data ?? null) : null;
    const count = user
      ? (serverCart.data?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0) + (serverCart.data?.unavailable.length ?? 0)
      : guestItems.reduce((s, i) => s + i.quantity, 0);
    return {
      quote,
      isLoading: authLoading || (user ? serverCart.isLoading : guestItems.length > 0 && guestQuote.isLoading),
      isFetching: serverCart.isFetching || guestQuote.isFetching || mutation.isPending,
      isError: user ? serverCart.isError : guestQuote.isError,
      count,
      isGuest: !user,
      add,
      setQuantity,
      remove,
      applyCoupon,
      removeCoupon,
      refetch: () => void (user ? serverCart.refetch() : guestQuote.refetch()),
    };
  }, [user, authLoading, serverCart, guestQuote, guestItems, mutation.isPending, add, setQuantity, remove, applyCoupon, removeCoupon]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
