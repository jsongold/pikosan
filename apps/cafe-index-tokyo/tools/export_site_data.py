#!/usr/bin/env python3
"""Export cafe.db (opened READ-ONLY) + YAML labels -> static JSON for the Next.js site.

Writes, into CATALOG_DATA_DIR or --out (must be outside this git repo):
  shops-index.json   list rows + facet definitions (for / filters)
  shops/<id>.json    full detail per shop (attributes keep value/confidence/sources)
  events.json        events grouped by status (upcoming / recurring / past)
  meta.json          counts + export timestamp

Rules: empty values (None, '', [], {}) are dropped; nothing is invented; every attribute keeps
its confidence and source URLs. Env overrides: CAFE_DB, CAFE_CONFIG_DIR, CATALOG_DATA_DIR.
Flag --if-available: when the DB file is missing, write nothing and exit 0.
PyYAML is imported only when the DB exists, so that path does not require it.
Catalog JSON is never written inside the repo and must not be committed.
"""
import json, math, os, re, shutil, sqlite3, subprocess, sys
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = ''  # set in main() from CATALOG_DATA_DIR / --out, outside the repo
# Optional local catalog checkout. Not part of this repo. Override with CAFE_DB / CAFE_CONFIG_DIR.
_CATALOG = os.path.normpath(os.path.join(APP, '..', '..', 'catalog'))
DB = os.environ.get('CAFE_DB', os.path.join(_CATALOG, 'data', 'cafe.db'))
CFG = os.environ.get('CAFE_CONFIG_DIR', os.path.join(_CATALOG, 'config', 'domains', 'cafe'))
JST = timezone(timedelta(hours=9))


def git_root():
    r = subprocess.run(['git', '-C', APP, 'rev-parse', '--show-toplevel'], capture_output=True, text=True)
    if r.returncode == 0 and r.stdout.strip():
        return os.path.realpath(r.stdout.strip())
    return os.path.realpath(os.path.join(APP, '..', '..'))


def resolve_out_dir():
    """Directory that receives the export. Refuses any path inside the git repo."""
    out = os.environ.get('CATALOG_DATA_DIR')
    args = sys.argv[1:]
    if '--out' in args:
        i = args.index('--out')
        if i + 1 >= len(args):
            sys.exit('[data] --out requires a directory')
        out = args[i + 1]
    if not out:
        sys.exit('[data] set CATALOG_DATA_DIR (or pass --out) to a directory outside this repo.\n'
                 '       Example: CATALOG_DATA_DIR=$HOME/cafe-index-data npm run data')
    out = os.path.realpath(os.path.abspath(out))
    root = git_root()
    if out == root or out.startswith(root + os.sep):
        sys.exit(f'[data] refusing to write catalog JSON inside the repo: {out}\n'
                 f'       choose a directory outside {root}')
    return out


def empty(v):
    return v is None or (isinstance(v, (str, list, dict)) and len(v) == 0) or (isinstance(v, str) and not v.strip())


def clean(o):
    """Recursively drop empty values."""
    if isinstance(o, dict):
        r = {k: clean(v) for k, v in o.items()}
        return {k: v for k, v in r.items() if not empty(v)}
    if isinstance(o, list):
        r = [clean(v) for v in o]
        return [v for v in r if not empty(v)]
    return o


def jload(s, default=None):
    if s is None:
        return default
    try:
        return json.loads(s)
    except Exception:
        return default


# ---------------------------------------------------------------- labels from YAML (+ DB fallback)
def load_labels(conn):
    # PyYAML is only needed when exporting from the DB. The --if-available path
    # (no DB, committed JSON) must not fail on machines that do not have it.
    import yaml

    labels, order, cats = {}, {}, {}
    fields = yaml.safe_load(open(os.path.join(CFG, 'fields.yaml')))
    for f in fields.get('fields', []):
        if isinstance(f, dict) and 'key' in f:
            labels[f['key']] = f.get('label_ja', f['key'])
            order[f['key']] = (f.get('category', ''), f.get('display_order', 999))
    fp = yaml.safe_load(open(os.path.join(CFG, 'flavor_profile.yaml')))
    axes = []
    for i, a in enumerate(fp['axes']):
        k = 'flavor.' + a['key']
        labels[k] = a.get('label_ja', a['key'])
        order[k] = ('flavor', i)
        if a.get('score_scale'):
            labels[k + '_score'] = a['score_scale'].get('label_ja', k + '_score')
        axes.append(clean({'key': a['key'], 'label': re.split(r'[（(]', a.get('label_ja', a['key']))[0],
                           'atmos': a['key'].startswith('atmos_'),
                           'scale': [a['score_scale'].get('min', 1), a['score_scale'].get('max', 5)] if a.get('score_scale') else None,
                           'values': a.get('allowed_values')}))
    for k, lab in conn.execute('select key,label_ja from attribute_definitions'):
        labels.setdefault(k, lab or k)
    ev = yaml.safe_load(open(os.path.join(CFG, 'events.yaml')))
    ev_types = {k: v.get('label_ja', k) for k, v in (ev.get('types') or {}).items()}
    return labels, order, axes, ev_types


# ---------------------------------------------------------------- feature flags (derived from stored values only)
NEG = ('なし', '無', '不可', 'false', 'False')


def truthy(v):
    if v is None:
        return False
    if isinstance(v, bool):
        return v
    return not str(v).strip().startswith(NEG)


FEATURES = [  # code, label, attribute, predicate
    ('wifi', 'Wi‑Fi', 'facility.wifi', truthy),
    ('power', '電源', 'facility.power_outlets', truthy),
    ('morning', 'モーニング', 'basic.morning_service', truthy),
    ('terrace', 'テラス', 'facility.terrace', truthy),
    ('sofa', 'ソファ席', 'facility.sofa', truthy),
    ('takeout', 'テイクアウト', 'facility.takeout', truthy),
    ('nosmoke', '全面禁煙', 'facility.smoking', lambda v: isinstance(v, str) and v.startswith('全面禁煙')),
    ('solo', '一人で入りやすい', 'facility.solo_friendly', truthy),
    ('kids', '子供可', 'facility.kids', lambda v: isinstance(v, str) and v.startswith('子供可')),
]


def as_list(v):
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x) for x in v if not empty(x)]
    return [x.strip() for x in re.split('[、，,]', str(v)) if x.strip()]


def dist_m(a, b, c, d):
    if None in (a, b, c, d):
        return math.inf
    p = math.pi / 180
    x = (d - b) * p * math.cos((a + c) / 2 * p)
    y = (c - a) * p
    return 6371000 * math.hypot(x, y)


def norm(s):
    return re.sub(r'[\s　・()（）]', '', (s or '')).lower()


def main():
    global OUT
    if not os.path.exists(DB):
        if '--if-available' in sys.argv:
            print(f'[data] {DB} not found; not writing catalog JSON')
            return
        sys.exit(f'[data] database not found: {DB} (set CAFE_DB)')
    OUT = resolve_out_dir()
    conn = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)  # READ-ONLY
    conn.row_factory = sqlite3.Row
    labels, order, axes, ev_types = load_labels(conn)
    now = datetime.now(JST)

    shops = []
    for s in conn.execute("select * from shops where status='active' order by id"):
        attrs = {}
        for r in conn.execute("select * from shop_attributes where shop_id=? and status='ok'", (s['id'],)):
            v = jload(r['value_json'], r['value_text']) if r['value_json'] is not None else (
                r['value_text'] if r['value_text'] is not None else r['value_num'])
            v = clean(v)
            if empty(v):
                continue
            attrs[r['attribute_key']] = clean({'v': v, 'conf': r['confidence'], 'src': jload(r['source_urls'], []),
                                               'at': r['collected_at']})
        menu = []
        for m in conn.execute('select * from menu_items where shop_id=? order by id', (s['id'],)):
            ex = jload(m['extra_json'], {}) or {}
            menu.append(clean({'name': m['item_name'], 'price': m['price_yen'], 'note': m['note'], 'src': m['source_url'],
                               'section': ex.get('section'), 'mt': bool(ex.get('name_source') and '機械翻訳' in ex['name_source']) or None,
                               'nameSource': ex.get('name_source')}))
        reviews = [clean({'summary': r['summary'], 'sentiment': r['sentiment'], 'rating': r['rating'], 'date': r['review_date'],
                          'source': r['source_name'], 'url': r['source_url']})
                   for r in conn.execute('select * from reviews where shop_id=? order by review_date desc, id', (s['id'],))]
        shops.append(dict(row=dict(s), attrs=attrs, menu=menu, reviews=reviews))

    # ------------------------------------------------ events (+ venue -> shop link, per events.yaml venue_match)
    events = []
    for r in conn.execute('select * from events order by coalesce(starts_at, "9999"), id'):
        e = {k: r[k] for k in r.keys() if k not in ('created_at', 'updated_at', 'extra_json', 'source_urls')}
        e['sources'] = jload(r['source_urls'], [])
        e['extra'] = jload(r['extra_json'], {})
        e['typeLabel'] = ev_types.get(r['type'], r['type'])
        st = r['status']
        end = r['ends_at'] or r['starts_at']
        if st == 'upcoming' and end:
            try:
                dt = datetime.fromisoformat(end)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=JST)
                if dt < now:
                    st = 'past'  # re-evaluated at export time
            except ValueError:
                pass
        e['status'] = st
        link, how = r['shop_id'], 'shop_id' if r['shop_id'] else None
        if not link:
            for sh in shops:
                row = sh['row']
                same_name = norm(row['name']) and norm(row['name']) in norm(r['venue_name']) and (not r['venue_ward'] or r['venue_ward'] == row['ward'])
                near = dist_m(r['venue_lat'], r['venue_lng'], row['lat'], row['lng']) <= 80 and norm(row['name'])[:3] in norm(r['venue_name'])
                if same_name or near:
                    link, how = row['id'], 'name_ward' if same_name else 'proximity'
                    break
        e['shop_id'] = link
        e['linkBy'] = how
        events.append(clean(e))
    by_shop = {}
    for e in events:
        if e.get('shop_id'):
            by_shop.setdefault(e['shop_id'], []).append(e)

    # ------------------------------------------------ index rows + detail files
    def A(sh, k):
        x = sh['attrs'].get(k)
        return None if x is None else x['v']

    rows = []
    if os.path.isdir(os.path.join(OUT, 'shops')):
        shutil.rmtree(os.path.join(OUT, 'shops'))
    os.makedirs(os.path.join(OUT, 'shops'), exist_ok=True)
    for sh in shops:
        s = sh['row']
        feats = [c for c, _, k, pred in FEATURES if pred(A(sh, k))]
        price_text = A(sh, 'basic.price_range_text')
        rows.append(clean({
            'id': s['id'], 'name': s['name'], 'kana': s['name_kana'], 'ward': s['ward'],
            'station': A(sh, 'basic.nearest_station'),
            'genres': as_list(A(sh, 'basic.genres')),
            'mood': as_list(A(sh, 'flavor.atmos_mood')),
            'score': A(sh, 'award.tabelog_score'), 'reviews': A(sh, 'award.tabelog_review_count'),
            'price': price_text.split('（')[0].strip() if isinstance(price_text, str) else None,
            'priceMin': A(sh, 'basic.price_min'), 'priceMax': A(sh, 'basic.price_max'),
            'feats': feats,
        }))
        detail = clean({
            'id': s['id'], 'name': s['name'], 'kana': s['name_kana'], 'prefecture': s['prefecture'], 'ward': s['ward'],
            'address': s['address'], 'lat': s['lat'], 'lng': s['lng'], 'sources': jload(s['source_urls'], []),
            'updated': s['updated_at'], 'feats': feats,
            'attrs': {k: dict(v, label=labels.get(k, k)) for k, v in sorted(
                sh['attrs'].items(), key=lambda kv: order.get(kv[0], ('zz', 999)))},
            'menu': sh['menu'], 'reviews': sh['reviews'],
            'events': [{k: e[k] for k in ('id', 'type', 'typeLabel', 'title', 'starts_at', 'date_text', 'recurrence', 'status', 'booking_url', 'sources', 'linkBy') if k in e}
                       for e in by_shop.get(s['id'], [])],
        })
        json.dump(detail, open(os.path.join(OUT, 'shops', f"{s['id']}.json"), 'w'), ensure_ascii=False, indent=1)

    def facet(values):
        c = {}
        for v in values:
            c[v] = c.get(v, 0) + 1
        return c
    wards = facet(r['ward'] for r in rows if r.get('ward'))
    genres = facet(g for r in rows for g in r.get('genres', []))
    fc = facet(f for r in rows for f in r.get('feats', []))
    index = {
        'total': len(rows),
        'facets': {
            # 23 wards first (by count), then cities
            'wards': [{'v': w, 'n': n} for w, n in sorted(wards.items(), key=lambda x: (not x[0].endswith('区'), -x[1], x[0]))],
            'genres': [{'v': g, 'n': n} for g, n in sorted(genres.items(), key=lambda x: (-x[1], x[0]))],
            'features': [{'v': c, 'label': l, 'n': fc.get(c, 0)} for c, l, _, _ in FEATURES if fc.get(c)],
        },
        'axes': axes,
        'shops': sorted(rows, key=lambda r: (-(r.get('score') or 0), r['name'])),
    }
    json.dump(index, open(os.path.join(OUT, 'shops-index.json'), 'w'), ensure_ascii=False, indent=1)

    groups = {'upcoming': [], 'recurring': [], 'past': []}
    for e in events:
        groups.setdefault(e['status'] if e['status'] in groups else 'other', []).append(e)
    groups['past'].sort(key=lambda e: e.get('starts_at', ''), reverse=True)
    json.dump({'types': ev_types, 'groups': groups, 'total': len(events)},
              open(os.path.join(OUT, 'events.json'), 'w'), ensure_ascii=False, indent=1)
    meta = {'exportedAt': now.isoformat(timespec='seconds'), 'shops': len(rows), 'events': len(events),
            'menuItems': sum(len(s['menu']) for s in shops), 'reviews': sum(len(s['reviews']) for s in shops),
            'linkedEvents': sum(1 for e in events if e.get('shop_id'))}
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    print('[data]', OUT, json.dumps(meta, ensure_ascii=False))


if __name__ == '__main__':
    main()
