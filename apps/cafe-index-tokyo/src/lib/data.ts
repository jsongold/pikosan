// Build-time data access (server only). JSON is produced by tools/export_site_data.py.
import fs from 'node:fs';
import path from 'node:path';
import type { EventsFile, Meta, ShopDetail, ShopIndex } from './types';

const DATA = path.join(process.cwd(), 'data');
const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')) as T;

export const getIndex = (): ShopIndex => read<ShopIndex>('shops-index.json');
export const getShop = (id: string | number): ShopDetail | null => {
  const f = path.join(DATA, 'shops', `${id}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as ShopDetail) : null;
};
export const getEvents = (): EventsFile => read<EventsFile>('events.json');
export const getMeta = (): Meta => read<Meta>('meta.json');

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://cafe-index-tokyo.vercel.app').replace(/\/$/, '');
export const SITE_NAME = 'Café Index Tokyo';
