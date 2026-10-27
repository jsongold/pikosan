import 'server-only';
import { catalogSourceKind } from './catalog-config';
import { loadFileCatalog } from './catalog-file';
import type { CatalogSnapshot } from './catalog';
import type { EventsFile, Meta, ShopDetail, ShopIndex } from './types';

let pending: Promise<CatalogSnapshot> | null = null;

export function loadCatalog(): Promise<CatalogSnapshot> {
  if (!pending) {
    pending = resolveCatalog().catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}

async function resolveCatalog(): Promise<CatalogSnapshot> {
  const kind = catalogSourceKind();
  if (kind === 'file') return loadFileCatalog(process.env.CATALOG_DATA_DIR!.trim());
  const { loadSupabaseCatalog } = await import('./catalog-supabase');
  return loadSupabaseCatalog();
}

export async function getIndex(): Promise<ShopIndex> {
  return (await loadCatalog()).index;
}
export async function getShop(id: string | number): Promise<ShopDetail | null> {
  return (await loadCatalog()).shop(id);
}
export async function getEvents(): Promise<EventsFile> {
  return (await loadCatalog()).events;
}
export async function getMeta(): Promise<Meta> {
  return (await loadCatalog()).meta;
}
