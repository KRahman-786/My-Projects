import type { StoreSettings } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface Settings extends Omit<StoreSettings, 'defaultGstRate'> {
  defaultGstRate: number;
}

let cache: { value: Settings; at: number } | null = null;
const TTL_MS = 30_000;

function normalize(s: StoreSettings): Settings {
  return { ...s, defaultGstRate: Number(s.defaultGstRate) };
}

/** Returns store settings, creating the singleton row with defaults if missing. Cached briefly. */
export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await prisma.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  cache = { value: normalize(row), at: Date.now() };
  return cache.value;
}

export async function updateSettings(data: Partial<Omit<Settings, 'id' | 'updatedAt'>>): Promise<Settings> {
  const row = await prisma.storeSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  cache = null;
  return normalize(row);
}

export function clearSettingsCache() {
  cache = null;
}

/** Public subset exposed to the storefront (no internal flags). */
export async function getPublicSettings() {
  const s = await getSettings();
  return {
    codEnabled: s.codEnabled,
    codMinOrderValue: s.codMinOrderValue,
    codMaxOrderValue: s.codMaxOrderValue,
    codFee: s.codFee,
    flatShippingFee: s.flatShippingFee,
    freeShippingThreshold: s.freeShippingThreshold,
    pricesIncludeTax: s.pricesIncludeTax,
    returnWindowDays: s.returnWindowDays,
  };
}
