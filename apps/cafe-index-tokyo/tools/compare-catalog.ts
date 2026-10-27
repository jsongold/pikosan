/**
 * Same logical catalog, two providers. The strings the pages print must match:
 * month-precision review dates, Tokyo event clocks, date-only all-day events,
 * upcoming order, and axis order (display_order, is_axis only).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCatalogFromRows, type AttrRec, type DefRec, type EventRec, type ReviewRec, type ShopRec } from '../src/lib/catalog-supabase';
import { loadFileCatalog } from '../src/lib/catalog-file';
import { jstParts } from '../src/lib/format';

const shop: ShopRec = {
  id: 1, name: 'DEMO 比較店', name_kana: null, uid: 'demo-uid', region_key: 'demo-region',
  prefecture: 'デモ都', ward: '架空区', address: '架空区1-1（実在しない）',
  lat: null, lng: null, status: 'active', source_urls: [], updated_at: '2099-01-01T00:00:00+09:00',
};
const defs: DefRec[] = [
  { key: 'flavor.aroma', label_ja: '香り', category: 'flavor', display_order: 20, is_axis: true, metadata: { score_scale: { min: 1, max: 5 } } },
  { key: 'flavor.evidence', label_ja: '根拠', category: 'flavor', display_order: 1, is_axis: false, metadata: null },
  { key: 'flavor.confidence', label_ja: '確度', category: 'flavor', display_order: 2, is_axis: false, metadata: null },
  { key: 'flavor.zest', label_ja: '鮮度', category: 'flavor', display_order: 5, is_axis: true, metadata: { atmos: false, score_scale: { min: 1, max: 5 } } },
  { key: 'event_type.cafe_run', label_ja: 'デモ・カフェラン', category: 'event_type', display_order: 1, is_axis: false, metadata: null },
];
// Alphabetical key order is how PostgREST returns them. display_order must win.
defs.sort((a, b) => (a.key < b.key ? -1 : 1));

const attrs: AttrRec[] = [
  { id: 1, shop_id: 1, attribute_key: 'flavor.zest', value_json: 'すっきり', value_text: null, value_num: null, confidence: 'low', source_urls: [], status: 'ok', collected_at: '2099-01-01T15:00:00.000Z' },
  { id: 2, shop_id: 1, attribute_key: 'flavor.zest_score', value_json: 3, value_text: null, value_num: null, confidence: 'low', source_urls: [], status: 'ok', collected_at: null },
  { id: 3, shop_id: 1, attribute_key: 'flavor.evidence', value_json: '根拠メモ', value_text: null, value_num: null, confidence: 'low', source_urls: [], status: 'ok', collected_at: null },
];
const reviews: ReviewRec[] = [
  { id: 1, shop_id: 1, summary: '架空の要約', sentiment: 'neutral', rating: 1, review_date: '2026-10', source_name: 'DEMO', source_url: 'https://example.com/demo', collected_at: null, machine_translated: false },
];
const events: EventRec[] = [
  // Deliberately not in start order.
  { id: 2, event_uid: 'later', shop_id: 1, type: 'cafe_run', title: 'DEMO 午後の回', status: 'upcoming', all_day: false, starts_at: '2099-05-02T06:00:00.000Z', ends_at: '2099-05-02T07:00:00.000Z', date_text: null, recurrence: null, venue_name: 'DEMO 比較店', venue_address: null, venue_ward: '架空区', venue_lat: null, venue_lng: null, organizer: null, fee_text: null, description: null, booking_url: null, confidence: null, last_verified: null, source_urls: [], extra_json: null },
  { id: 3, event_uid: 'allday', shop_id: 1, type: 'cafe_run', title: 'DEMO 日付のみ', status: 'upcoming', all_day: true, starts_at: '2099-05-31T15:00:00.000Z', ends_at: null, date_text: null, recurrence: null, venue_name: 'DEMO 比較店', venue_address: null, venue_ward: '架空区', venue_lat: null, venue_lng: null, organizer: null, fee_text: null, description: null, booking_url: null, confidence: null, last_verified: null, source_urls: [], extra_json: null },
  { id: 1, event_uid: 'earlier', shop_id: 1, type: 'cafe_run', title: 'DEMO 早い回', status: 'upcoming', all_day: false, starts_at: '2099-05-01T06:00:00.000Z', ends_at: '2099-05-01T08:00:00.000Z', date_text: null, recurrence: null, venue_name: 'DEMO 比較店', venue_address: null, venue_ward: '架空区', venue_lat: null, venue_lng: null, organizer: null, fee_text: null, description: null, booking_url: null, confidence: null, last_verified: null, source_urls: [], extra_json: null },
];

const db = buildCatalogFromRows({ shops: [shop], attributes: attrs, definitions: defs, reviews, menu: [], events }, new Date('2099-01-01T00:00:00+09:00'));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-compare-'));
const fileEvents = {
  types: { cafe_run: 'デモ・カフェラン' },
  total: 3,
  groups: {
    upcoming: [
      { id: 1, event_uid: 'earlier', type: 'cafe_run', typeLabel: 'cafe_run', title: 'DEMO 早い回', starts_at: '2099-05-01T15:00:00+09:00', ends_at: '2099-05-01T17:00:00+09:00', status: 'upcoming', venue_name: 'DEMO 比較店', venue_ward: '架空区', shop_id: 1, linkBy: 'shop_id' },
      { id: 2, event_uid: 'later', type: 'cafe_run', typeLabel: 'cafe_run', title: 'DEMO 午後の回', starts_at: '2099-05-02T15:00:00+09:00', ends_at: '2099-05-02T16:00:00+09:00', status: 'upcoming', venue_name: 'DEMO 比較店', venue_ward: '架空区', shop_id: 1, linkBy: 'shop_id' },
      { id: 3, event_uid: 'allday', type: 'cafe_run', typeLabel: 'cafe_run', title: 'DEMO 日付のみ', starts_at: '2099-06-01', status: 'upcoming', venue_name: 'DEMO 比較店', venue_ward: '架空区', shop_id: 1, linkBy: 'shop_id' },
    ],
    recurring: [],
    past: [],
  },
};
fs.writeFileSync(path.join(dir, 'shops-index.json'), JSON.stringify({
  total: 1,
  facets: { wards: [], genres: [], features: [] },
  axes: [
    { key: 'zest', label: '鮮度', scale: [1, 5] },
    { key: 'aroma', label: '香り', scale: [1, 5] },
  ],
  shops: [{ id: 1, name: 'DEMO 比較店', ward: '架空区' }],
}));
fs.writeFileSync(path.join(dir, 'events.json'), JSON.stringify(fileEvents));
fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ exportedAt: '2099-01-01T00:00:00+09:00', shops: 1, events: 3, menuItems: 0, reviews: 1, linkedEvents: 1 }));
fs.mkdirSync(path.join(dir, 'shops'));
fs.writeFileSync(path.join(dir, 'shops', '1.json'), JSON.stringify({
  id: 1, name: 'DEMO 比較店', ward: '架空区', attrs: {},
  reviews: [{ summary: '架空の要約', sentiment: 'neutral', rating: 1, date: '2026-10', source: 'DEMO', url: 'https://example.com/demo' }],
  events: fileEvents.groups.upcoming.map((e) => ({ id: e.id, type: e.type, title: e.title, starts_at: e.starts_at, status: e.status })),
}));
const file = loadFileCatalog(dir);

function clocks(starts: (string | undefined)[]) {
  return starts.map((s) => jstParts(s)?.hm ?? '');
}
const dbUpcoming = db.events.groups.upcoming;
const fileUpcoming = file.events.groups.upcoming;
const problems: string[] = [];
const eq = (label: string, a: unknown, b: unknown) => {
  const as = JSON.stringify(a);
  const bs = JSON.stringify(b);
  if (as !== bs) problems.push(`${label}\n  db   ${as}\n  file ${bs}`);
};

eq('axis keys', db.index.axes.map((a) => a.key), file.index.axes.map((a) => a.key));
eq('upcoming ids', dbUpcoming.map((e) => e.id), fileUpcoming.map((e) => e.id));
eq('upcoming starts_at', dbUpcoming.map((e) => e.starts_at), fileUpcoming.map((e) => e.starts_at));
eq('clocks', clocks(dbUpcoming.map((e) => e.starts_at)), clocks(fileUpcoming.map((e) => e.starts_at)));
eq('review date', db.shop(1)?.reviews?.[0]?.date, file.shop(1)?.reviews?.[0]?.date);
eq('detail event clocks', clocks((db.shop(1)?.events ?? []).map((e) => e.starts_at)), clocks((file.shop(1)?.events ?? []).map((e) => e.starts_at)));

const axisKeys = db.index.axes.map((a) => a.key);
if (axisKeys.includes('evidence') || axisKeys.includes('confidence')) problems.push('non-axis flavor fields leaked into axes');
if (clocks(dbUpcoming.map((e) => e.starts_at)).includes('06:00')) problems.push('UTC hour leaked into the clock');
if (clocks([dbUpcoming[2]?.starts_at]).some((h) => h === '00:00')) problems.push('all-day event rendered midnight');

if (problems.length) {
  console.error(problems.join('\n\n'));
  process.exit(1);
}
console.log('providers match', {
  axes: axisKeys,
  starts: dbUpcoming.map((e) => e.starts_at),
  clocks: clocks(dbUpcoming.map((e) => e.starts_at)),
  reviewDate: db.shop(1)?.reviews?.[0]?.date,
});
