"""QA for the Sage & Cream default (no query param): 390px index/filter/detail/events + 1280 index to
../app_screens/sage_default/, AA contrast audit, overflow audit at 360/390/430 on every page, switcher visibility, JS errors."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from qa_data import detail_path, shop_ids
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:4173'
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'app_screens' / 'sage_default'; OUT.mkdir(parents=True, exist_ok=True)
ids = shop_ids()
DETAIL = detail_path()
MOB = dict(device_scale_factor=2, is_mobile=True, has_touch=True)
src = open(ROOT / 'tools/shoot_themes.py').read()
OVER = open(ROOT / 'tools/shoot_v2.py').read().split('OVER = """')[1].split('"""')[0]
CONTRAST = src.split('CONTRAST = """')[1].split('"""')[0].replace('\\\\', '\\')  # undo source-level escaping
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    def page(w, mob=True):
        pg = b.new_page(viewport={'width': w, 'height': 844 if mob else 900}, **(MOB if mob else {}))  # fresh context = clean localStorage
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        return pg
    pg = page(390)
    pg.goto(BASE + '/', wait_until='networkidle'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
    th = pg.evaluate("document.documentElement.getAttribute('data-theme')")
    sw = pg.evaluate("getComputedStyle(document.querySelector('.thsw')).display")
    print('default data-theme:', th, '| switcher display:', sw)
    pg.screenshot(path=str(OUT / 'index_390.png'))
    con = {'/': pg.evaluate(CONTRAST.replace("r.top > innerHeight * 3", "false"))}
    pg.click('.fbtn'); pg.wait_for_timeout(350)
    pg.locator('#facets .fx-b', has_text='渋谷区').first.click(); pg.wait_for_timeout(250)
    pg.screenshot(path=str(OUT / 'filter_390.png'))
    con['sheet'] = pg.evaluate(CONTRAST.replace("r.top > innerHeight * 3", "!el.closest('#facets')"))
    pg.goto(BASE + DETAIL, wait_until='networkidle'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / 'detail_390.png'))
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    con[DETAIL] = pg.evaluate(CONTRAST.replace("r.top > innerHeight * 3", "false"))
    pg.goto(BASE + '/events/', wait_until='networkidle'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / 'events_390.png'))
    con['/events/'] = pg.evaluate(CONTRAST.replace("r.top > innerHeight * 3", "false"))
    pg.goto(BASE + '/404.html', wait_until='networkidle')
    con['/404'] = pg.evaluate(CONTRAST.replace("r.top > innerHeight * 3", "false"))
    pg.close()
    dp = page(1280, mob=False); dp.goto(BASE + '/', wait_until='networkidle'); dp.evaluate('document.fonts.ready'); dp.wait_for_timeout(300)
    dp.screenshot(path=str(OUT / 'index_1280.png'))
    con['/ @1280'] = dp.evaluate(CONTRAST.replace("r.top > innerHeight * 3", "false"))
    dp.close()
    print('AA contrast failures:', {k: v for k, v in con.items() if v} or 'none')
    # contrast on a sample of detail pages
    pg = page(390); bad = {}
    for i in ids[::6]:
        pg.goto(f'{BASE}/cafes/{i}/', wait_until='load'); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
        r = pg.evaluate(CONTRAST.replace("r.top > innerHeight * 3", "false"))
        if r: bad[i] = r
    print(f'AA on {len(ids[::6])} sampled detail pages:', bad or 'none'); pg.close()
    # switcher reachability via ?theme=
    for q, want in (('blush', 'blush'), ('d', None), ('', 'sage')):
        pg = page(390); pg.goto(f'{BASE}/?theme={q}', wait_until='load')
        print(f'?theme={q}:', pg.evaluate("document.documentElement.getAttribute('data-theme')"), '| switcher', pg.evaluate("getComputedStyle(document.querySelector('.thsw')).display"),
              'OK' if pg.evaluate("document.documentElement.getAttribute('data-theme')") == want else 'MISMATCH'); pg.close()
    for w in (360, 390, 430):
        pg = page(w); bad = []
        for path in ['/', '/events/', '/404.html'] + [f'/cafes/{i}/' for i in ids]:
            pg.goto(BASE + path, wait_until='load')
            pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
            r = pg.evaluate(OVER); r['bad'] = [x for x in r['bad'] if not x.startswith('clip:vh')]
            if r['sw'] > r['w'] or r['bad']: bad.append((path, r))
        print(f'{w}px overflow pages: {len(bad)}/{len(ids)+3} {bad[:2]}'); pg.close()
    b.close()
print('js errors:', errs or 'none')
