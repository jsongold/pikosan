import type { EventsFile, Meta, ShopDetail, ShopIndex } from './types';

/** What every page reads. File and Supabase providers both return this snapshot. */
export interface CatalogSnapshot {
  index: ShopIndex;
  events: EventsFile;
  meta: Meta;
  shop(id: string | number): ShopDetail | null;
}

export function catalogError(message: string): Error {
  return new Error(`Café Index Tokyo: ${message}`);
}

export function shopId(id: string | number): number | null {
  const raw = String(id).trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}
