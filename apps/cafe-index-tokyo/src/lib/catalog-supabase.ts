import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { catalogError, shopId, type CatalogSnapshot } from './catalog';
import { supabaseKeyChoice } from './catalog-config';
import { formatCatalogDate, formatCatalogInstant } from './catalog-time';
import type { Attr, Axis, CafeEvent, EventsFile, Facet, MenuItem, Meta, Review, ShopDetail, ShopIndex, ShopRow, Value } from './types';

/**
 * Read-only Supabase catalog.
 *
 * The vendor is Supabase. This module only calls `.select()`. It never
 * inserts, updates, or deletes. RLS in supabase/migrations grants anon
 * SELECT and no writes. SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SECRET_KEY
 * bypass RLS; they are server-only build secrets and must not be NEXT_PUBLIC.
 *
 * Rows match the source catalog's extensible shape: shop identity on
 * `shops`, everything else on `shop_attributes` (EAV), with labels and
 * optional axis metadata on `attribute_definitions`.
 */

const PAGE = 1000;
const NEG = ['なし', '無', '不可', 'false', 'False'];
const FEATURES: { code: string; label: string; key: string; pred: (v: unknown) => boolean }[] = [
  { code: 'wifi', label: 'Wi‑Fi', key: 'facility.wifi', pred: truthy },
  { code: 'power', label: '電源', key: 'facility.power_outlets', pred: truthy },
  { code: 'morning', label: 'モーニング', key: 'basic.morning_service', pred: truthy },
  { code: 'terrace', label: 'テラス', key: 'facility.terrace', pred: truthy },
  { code: 'sofa', label: 'ソファ席', key: 'facility.sofa', pred: truthy },
  { code: 'takeout', label: 'テイクアウト', key: 'facility.takeout', pred: truthy },
  { code: 'nosmoke', label: '全面禁煙', key: 'facility.smoking', pred: (v) => typeof v === 'string' && v.startsWith('全面禁煙') },
  { code: 'solo', label: '一人で入りやすい', key: 'facility.solo_friendly', pred: truthy },
  { code: 'kids', label: '子供可', key: 'facility.kids', pred: (v) => typeof v === 'string' && v.startsWith('子供可') },
];

export interface ShopRec {
  id: number;
  name: string;
  name_kana: string | null;
  uid: string | null;
  region_key: string | null;
  prefecture: string | null;
  ward: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  source_urls: unknown;
  updated_at: string | null;
}
export interface AttrRec {
  id: number;
  shop_id: number;
  attribute_key: string;
  value_json: unknown;
  value_text: string | null;
  value_num: number | null;
  confidence: string | null;
  source_urls: unknown;
  status: string;
  collected_at: string | null;
}
export interface DefRec {
  key: string;
  label_ja: string;
  category: string | null;
  display_order: number | null;
  is_axis: boolean;
  metadata: { atmos?: boolean; score_scale?: { min?: number; max?: number }; allowed_values?: string[] } | null;
}
export interface ReviewRec {
  id: number;
  shop_id: number;
  summary: string;
  sentiment: string | null;
  rating: number | null;
  review_date: string | null;
  source_name: string | null;
  source_url: string | null;
  collected_at: string | null;
  machine_translated: boolean | null;
}
export interface MenuRec {
  id: number;
  shop_id: number;
  item_name: string;
  price_yen: number | null;
  note: string | null;
  source_url: string | null;
  collected_at: string | null;
  extra_json: { section?: string; name_source?: string } | null;
}
export interface EventRec {
  id: number;
  event_uid: string | null;
  shop_id: number | null;
  type: string;
  title: string;
  status: string;
  all_day: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
  date_text: string | null;
  recurrence: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_ward: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  organizer: string | null;
  fee_text: string | null;
  description: string | null;
  booking_url: string | null;
  confidence: string | null;
  last_verified: string | null;
  source_urls: unknown;
  extra_json: Record<string, Value> | null;
}

type Query = {
  eq: (column: string, value: string) => Query;
  order: (column: string) => Query;
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }>;
};

function truthy(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim();
  return !NEG.some((p) => s.startsWith(p));
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
}

function asUrls(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v) as unknown;
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [v];
    } catch {
      return [v];
    }
  }
  return [];
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function asList(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter((x) => x.trim());
  return String(v).split(/[、，,]/).map((s) => s.trim()).filter(Boolean);
}

function attrValue(row: AttrRec): unknown {
  if (row.value_json !== null && row.value_json !== undefined) return row.value_json;
  if (row.value_text !== null && row.value_text !== undefined) return row.value_text;
  if (row.value_num !== null && row.value_num !== undefined) return row.value_num;
  return null;
}

function norm(s: string | null | undefined): string {
  return (s ?? '').replace(/[\s　・()（）]/g, '').toLowerCase();
}

function distM(a: number | null, b: number | null, c: number | null, d: number | null): number {
  if (a == null || b == null || c == null || d == null) return Number.POSITIVE_INFINITY;
  const p = Math.PI / 180;
  const x = (d - b) * p * Math.cos(((a + c) / 2) * p);
  const y = (c - a) * p;
  return 6371000 * Math.hypot(x, y);
}

function dayKey(iso: string | null): string | undefined {
  return formatCatalogDate(iso);
}

async function readAll<T>(supabase: SupabaseClient, table: string, apply: (q: Query) => Query): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const q = apply(supabase.from(table).select('*') as unknown as Query);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) {
      throw catalogError(
        `Supabase read of public.${table} failed (${error.code ?? 'error'}): ${error.message}. This provider only selects. Check SUPABASE_URL, the key, and that the catalog migration's RLS policies allow select.`,
      );
    }
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function axesFrom(defs: DefRec[]): Axis[] {
  const axes: (Axis & { order: number })[] = [];
  for (const d of defs) {
    if (!d.is_axis) continue;
    if (d.key.endsWith('_score')) continue;
    const key = d.key.startsWith('flavor.') ? d.key.slice('flavor.'.length) : d.key;
    const meta = d.metadata ?? {};
    const scale = meta.score_scale;
    axes.push({
      key,
      order: d.display_order ?? 999,
      label: d.label_ja.split(/[（(]/)[0] || key,
      atmos: Boolean(meta.atmos) || key.startsWith('atmos_'),
      ...(scale ? { scale: [scale.min ?? 1, scale.max ?? 5] as [number, number] } : {}),
      ...(meta.allowed_values?.length ? { values: meta.allowed_values } : {}),
    });
  }
  axes.sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return axes.map(({ order: _order, ...axis }) => axis);
}

export async function loadSupabaseCatalog(): Promise<CatalogSnapshot> {
  const url = process.env.SUPABASE_URL!.trim();
  const key = supabaseKeyChoice();
  if (!key) throw catalogError('Supabase key is missing.');
  let supabase: SupabaseClient;
  try {
    supabase = createClient(url, key.value, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  } catch (err) {
    throw catalogError(`Could not create the Supabase client: ${err instanceof Error ? err.message : err}`);
  }
  const serverOnly = key.name !== 'SUPABASE_ANON_KEY';
  console.info(`[catalog] reading Supabase (${serverOnly ? 'server-only key, bypasses RLS' : 'anon key'}); select only`);

  const [shopRows, attrRows, defRows, reviewRows, menuRows, eventRows] = await Promise.all([
    readAll<ShopRec>(supabase, 'shops', (q) => q.eq('status', 'active').order('id')),
    readAll<AttrRec>(supabase, 'shop_attributes', (q) => q.eq('status', 'ok').order('id')),
    readAll<DefRec>(supabase, 'attribute_definitions', (q) => q.order('key')),
    readAll<ReviewRec>(supabase, 'reviews', (q) => q.order('id')),
    readAll<MenuRec>(supabase, 'menu_items', (q) => q.order('id')),
    readAll<EventRec>(supabase, 'events', (q) => q.order('id')),
  ]);

  return buildCatalogFromRows({
    shops: shopRows,
    attributes: attrRows,
    definitions: defRows,
    reviews: reviewRows,
    menu: menuRows,
    events: eventRows,
  });
}

export function buildCatalogFromRows(input: {
  shops: ShopRec[];
  attributes: AttrRec[];
  definitions: DefRec[];
  reviews: ReviewRec[];
  menu: MenuRec[];
  events: EventRec[];
}, now = new Date()): CatalogSnapshot {
  const { shops: shopRows, attributes: attrRows, definitions: defRows, reviews: reviewRows, menu: menuRows, events: eventRows } = input;

  if (shopRows.length === 0) {
    throw catalogError('Supabase returned no active shops. Refusing to build an empty site.');
  }

  const labels = new Map(defRows.map((d) => [d.key, d.label_ja || d.key]));
  const order = new Map(defRows.map((d) => [d.key, { category: d.category ?? '', display: d.display_order ?? 999 }]));
  const active = new Set(shopRows.map((s) => Number(s.id)));

  const attrsByShop = new Map<number, Map<string, Attr>>();
  for (const row of attrRows) {
    const sid = Number(row.shop_id);
    if (!active.has(sid)) continue;
    const value = attrValue(row);
    if (isEmpty(value)) continue;
    const bag = attrsByShop.get(sid) ?? new Map<string, Attr>();
    bag.set(row.attribute_key, {
      v: value as Value,
      ...(row.confidence ? { conf: row.confidence } : {}),
      ...(asUrls(row.source_urls).length ? { src: asUrls(row.source_urls) } : {}),
      ...(dayKey(row.collected_at) ? { at: dayKey(row.collected_at) } : {}),
      label: labels.get(row.attribute_key) ?? row.attribute_key,
    });
    attrsByShop.set(sid, bag);
  }

  const menuByShop = new Map<number, MenuItem[]>();
  for (const row of menuRows) {
    const sid = Number(row.shop_id);
    if (!active.has(sid)) continue;
    const extra = row.extra_json ?? {};
    const item: MenuItem = { name: row.item_name };
    if (row.price_yen != null) item.price = row.price_yen;
    if (row.note) item.note = row.note;
    if (row.source_url) item.src = row.source_url;
    if (extra.section) item.section = extra.section;
    if (extra.name_source) {
      item.nameSource = extra.name_source;
      if (extra.name_source.includes('機械翻訳')) item.mt = true;
    }
    const list = menuByShop.get(sid) ?? [];
    list.push(item);
    menuByShop.set(sid, list);
  }

  const reviewsByShop = new Map<number, Review[]>();
  const reviewsSorted = [...reviewRows].sort((a, b) => (b.review_date ?? '').localeCompare(a.review_date ?? '') || b.id - a.id);
  for (const row of reviewsSorted) {
    const sid = Number(row.shop_id);
    if (!active.has(sid) || !row.summary) continue;
    const review: Review = { summary: row.summary };
    if (row.sentiment) review.sentiment = row.sentiment;
    if (row.rating != null) review.rating = Number(row.rating);
    if (row.review_date) review.date = String(row.review_date);
    if (row.source_name) review.source = row.source_name;
    if (row.source_url) review.url = row.source_url;
    const list = reviewsByShop.get(sid) ?? [];
    list.push(review);
    reviewsByShop.set(sid, list);
  }

  const shops: { row: ShopRec; attrs: Map<string, Attr>; menu: MenuItem[]; reviews: Review[] }[] = shopRows.map((row) => ({
    row: { ...row, id: Number(row.id) },
    attrs: attrsByShop.get(Number(row.id)) ?? new Map(),
    menu: menuByShop.get(Number(row.id)) ?? [],
    reviews: reviewsByShop.get(Number(row.id)) ?? [],
  }));

  const A = (sh: (typeof shops)[number], key: string): unknown => sh.attrs.get(key)?.v;

  const types: Record<string, string> = {};
  for (const d of defRows) if (d.category === 'event_type') types[d.key] = d.label_ja;

  const events: CafeEvent[] = eventRows.map((row) => {
    let status = row.status;
    const end = row.ends_at || row.starts_at;
    if (status === 'upcoming' && end) {
      const dt = new Date(end);
      if (!Number.isNaN(dt.getTime()) && dt < now) status = 'past';
    }
    if (row.type && !types[row.type]) types[row.type] = row.type;
    const allDay = Boolean(row.all_day);
    const startsAt = formatCatalogInstant(row.starts_at, allDay);
    const endsAt = formatCatalogInstant(row.ends_at, allDay);
    const e: CafeEvent = {
      id: Number(row.id),
      event_uid: row.event_uid ?? String(row.id),
      type: row.type,
      typeLabel: types[row.type] ?? row.type,
      title: row.title,
      status,
    };
    if (startsAt) e.starts_at = startsAt;
    if (endsAt) e.ends_at = endsAt;
    if (row.date_text) e.date_text = row.date_text;
    if (row.recurrence) e.recurrence = row.recurrence;
    if (row.venue_name) e.venue_name = row.venue_name;
    if (row.venue_address) e.venue_address = row.venue_address;
    if (row.venue_ward) e.venue_ward = row.venue_ward;
    if (row.venue_lat != null) e.venue_lat = row.venue_lat;
    if (row.venue_lng != null) e.venue_lng = row.venue_lng;
    if (row.organizer) e.organizer = row.organizer;
    if (row.fee_text) e.fee_text = row.fee_text;
    if (row.description) e.description = row.description;
    if (row.booking_url) e.booking_url = row.booking_url;
    if (row.confidence) e.confidence = row.confidence;
    if (row.last_verified) e.last_verified = row.last_verified;
    const sources = asUrls(row.source_urls);
    if (sources.length) e.sources = sources;
    if (row.extra_json && !isEmpty(row.extra_json)) e.extra = row.extra_json;
    if (row.shop_id != null) {
      e.shop_id = Number(row.shop_id);
      e.linkBy = 'shop_id';
    }
    return e;
  });

  events.sort((a, b) => {
    const as = a.starts_at ?? '9999';
    const bs = b.starts_at ?? '9999';
    if (as < bs) return -1;
    if (as > bs) return 1;
    return a.id - b.id;
  });

  for (const e of events) {
    if (e.shop_id) continue;
    for (const sh of shops) {
      const row = sh.row;
      const sameName = norm(row.name) && norm(e.venue_name).includes(norm(row.name)) && (!e.venue_ward || e.venue_ward === row.ward);
      const near = distM(e.venue_lat ?? null, e.venue_lng ?? null, row.lat, row.lng) <= 80 && norm(row.name).slice(0, 3) !== '' && norm(e.venue_name).includes(norm(row.name).slice(0, 3));
      if (sameName || near) {
        e.shop_id = row.id;
        e.linkBy = sameName ? 'name_ward' : 'proximity';
        break;
      }
    }
  }

  const byShop = new Map<number, CafeEvent[]>();
  for (const e of events) {
    if (!e.shop_id) continue;
    const list = byShop.get(e.shop_id) ?? [];
    list.push(e);
    byShop.set(e.shop_id, list);
  }

  const details = new Map<number, ShopDetail>();
  const rows: ShopRow[] = [];
  for (const sh of shops) {
    const s = sh.row;
    const feats = FEATURES.filter((f) => f.pred(A(sh, f.key))).map((f) => f.code);
    const priceText = A(sh, 'basic.price_range_text');
    const score = asNumber(A(sh, 'award.tabelog_score'));
    const reviews = asNumber(A(sh, 'award.tabelog_review_count'));
    const priceMin = asNumber(A(sh, 'basic.price_min'));
    const priceMax = asNumber(A(sh, 'basic.price_max'));
    const genres = asList(A(sh, 'basic.genres'));
    const row: ShopRow = {
      id: s.id,
      name: s.name,
      ...(s.name_kana ? { kana: s.name_kana } : {}),
      ...(s.ward ? { ward: s.ward } : {}),
      ...(typeof A(sh, 'basic.nearest_station') === 'string' ? { station: String(A(sh, 'basic.nearest_station')) } : {}),
      ...(genres.length ? { genres } : {}),
      ...(asList(A(sh, 'flavor.atmos_mood')).length ? { mood: asList(A(sh, 'flavor.atmos_mood')) } : {}),
      ...(score !== undefined ? { score } : {}),
      ...(reviews !== undefined ? { reviews } : {}),
      ...(typeof priceText === 'string' ? { price: priceText.split('（')[0].trim() } : {}),
      ...(priceMin !== undefined ? { priceMin } : {}),
      ...(priceMax !== undefined ? { priceMax } : {}),
      ...(feats.length ? { feats } : {}),
    };
    rows.push(row);

    const sortedAttrs = [...sh.attrs.entries()].sort((a, b) => {
      const oa = order.get(a[0]) ?? { category: 'zz', display: 999 };
      const ob = order.get(b[0]) ?? { category: 'zz', display: 999 };
      return oa.category < ob.category ? -1 : oa.category > ob.category ? 1 : oa.display - ob.display;
    });
    const detail: ShopDetail = {
      id: s.id,
      name: s.name,
      ...(s.name_kana ? { kana: s.name_kana } : {}),
      ...(s.uid ? { uid: s.uid } : {}),
      ...(s.region_key ? { regionKey: s.region_key } : {}),
      ...(s.prefecture ? { prefecture: s.prefecture } : {}),
      ...(s.ward ? { ward: s.ward } : {}),
      ...(s.address ? { address: s.address } : {}),
      ...(s.lat != null ? { lat: s.lat } : {}),
      ...(s.lng != null ? { lng: s.lng } : {}),
      ...(asUrls(s.source_urls).length ? { sources: asUrls(s.source_urls) } : {}),
      ...(s.updated_at ? { updated: s.updated_at } : {}),
      ...(feats.length ? { feats } : {}),
      attrs: Object.fromEntries(sortedAttrs),
      ...(sh.menu.length ? { menu: sh.menu } : {}),
      ...(sh.reviews.length ? { reviews: sh.reviews } : {}),
      ...(byShop.get(s.id)?.length
        ? {
            events: byShop.get(s.id)!.map((e) => ({
              id: e.id,
              type: e.type,
              ...(e.typeLabel ? { typeLabel: e.typeLabel } : {}),
              title: e.title,
              ...(e.starts_at ? { starts_at: e.starts_at } : {}),
              ...(e.date_text ? { date_text: e.date_text } : {}),
              ...(e.recurrence ? { recurrence: e.recurrence } : {}),
              ...(e.status ? { status: e.status } : {}),
              ...(e.booking_url ? { booking_url: e.booking_url } : {}),
              ...(e.sources?.length ? { sources: e.sources } : {}),
              ...(e.linkBy ? { linkBy: e.linkBy } : {}),
            })),
          }
        : {}),
    };
    details.set(s.id, detail);
  }

  const count = (values: string[]) => {
    const c = new Map<string, number>();
    for (const v of values) c.set(v, (c.get(v) ?? 0) + 1);
    return c;
  };
  const wards = count(rows.map((r) => r.ward).filter((w): w is string => Boolean(w)));
  const genres = count(rows.flatMap((r) => r.genres ?? []));
  const featCounts = count(rows.flatMap((r) => r.feats ?? []));
  const wardFacets: Facet[] = [...wards.entries()]
    .map(([v, n]) => ({ v, n }))
    .sort((a, b) => Number(!a.v.endsWith('区')) - Number(!b.v.endsWith('区')) || b.n - a.n || (a.v < b.v ? -1 : 1));
  const genreFacets: Facet[] = [...genres.entries()]
    .map(([v, n]) => ({ v, n }))
    .sort((a, b) => b.n - a.n || (a.v < b.v ? -1 : 1));

  const index: ShopIndex = {
    total: rows.length,
    facets: {
      wards: wardFacets,
      genres: genreFacets,
      features: FEATURES.filter((f) => featCounts.get(f.code)).map((f) => ({ v: f.code, label: f.label, n: featCounts.get(f.code) ?? 0 })),
    },
    axes: axesFrom(defRows),
    shops: rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  };

  const byStart = (a: CafeEvent, b: CafeEvent) => {
    const as = a.starts_at ?? '9999';
    const bs = b.starts_at ?? '9999';
    if (as < bs) return -1;
    if (as > bs) return 1;
    return a.id - b.id;
  };
  const groups: EventsFile['groups'] = { upcoming: [], recurring: [], past: [] };
  for (const e of events) {
    if (e.status === 'upcoming' || e.status === 'recurring' || e.status === 'past') groups[e.status].push(e);
  }
  groups.upcoming.sort(byStart);
  groups.recurring.sort(byStart);
  groups.past.sort((a, b) => (b.starts_at ?? '').localeCompare(a.starts_at ?? '') || b.id - a.id);
  const eventsFile: EventsFile = { types, groups, total: events.length };
  const meta: Meta = {
    exportedAt: new Date().toISOString(),
    shops: rows.length,
    events: events.length,
    menuItems: shops.reduce((n, s) => n + s.menu.length, 0),
    reviews: shops.reduce((n, s) => n + s.reviews.length, 0),
    linkedEvents: events.filter((e) => e.shop_id).length,
  };

  return {
    index,
    events: eventsFile,
    meta,
    shop(id) {
      const n = shopId(id);
      return n === null ? null : details.get(n) ?? null;
    },
  };
}
