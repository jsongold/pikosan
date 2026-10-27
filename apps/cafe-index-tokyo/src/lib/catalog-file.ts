import fs from 'node:fs';
import path from 'node:path';
import { catalogError, shopId, type CatalogSnapshot } from './catalog';
import type { EventsFile, Meta, ShopDetail, ShopIndex } from './types';

function readJson<T>(root: string, file: string): T {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    throw catalogError(`Catalog export is missing ${file} (${full}). Refusing to build an empty site.`);
  }
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
  } catch (err) {
    throw catalogError(`Catalog export file ${file} is not valid JSON: ${err instanceof Error ? err.message : err}`);
  }
}

/** Local JSON produced by tools/export_site_data.py, or the labelled fixtures/demo set. */
export function loadFileCatalog(dir: string): CatalogSnapshot {
  const root = path.resolve(dir);
  const index = readJson<ShopIndex>(root, 'shops-index.json');
  const events = readJson<EventsFile>(root, 'events.json');
  const meta = readJson<Meta>(root, 'meta.json');
  if (!Array.isArray(index.shops) || index.shops.length === 0) {
    throw catalogError(`Catalog export at ${root} has no shops. Refusing to build an empty site.`);
  }
  events.groups = {
    upcoming: events.groups?.upcoming ?? [],
    recurring: events.groups?.recurring ?? [],
    past: events.groups?.past ?? [],
  };
  const shops = new Map<number, ShopDetail>();
  for (const row of index.shops) {
    const id = shopId(row.id);
    if (id === null) throw catalogError(`Catalog index has an invalid shop id: ${String(row.id)}`);
    const detail = readJson<ShopDetail>(root, path.join('shops', `${id}.json`));
    shops.set(id, detail);
  }
  console.info(`[catalog] reading JSON from ${root}${meta.demo ? ' (labelled demo fixture, not a real catalog)' : ''}`);
  return {
    index,
    events,
    meta,
    shop(id) {
      const n = shopId(id);
      return n === null ? null : shops.get(n) ?? null;
    },
  };
}
