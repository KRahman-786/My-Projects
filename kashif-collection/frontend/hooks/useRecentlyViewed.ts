'use client';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'kc_recently_viewed_v1';
const MAX = 12;

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Product ids viewed on this device (most recent first). Product data is always fetched from the API. */
export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => setIds(read()), []);
  const track = useCallback((id: string) => {
    const next = [id, ...read().filter((x) => x !== id)].slice(0, MAX);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setIds(next);
  }, []);
  return { ids, track };
}
