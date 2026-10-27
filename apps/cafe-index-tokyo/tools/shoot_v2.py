"""Mobile-first QA: screenshots to ../app_screens/v2/ + horizontal-overflow and tap-target audit."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from qa_data import detail_path, shop_ids
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173'
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'app_screens' / 'v2'
OUT.mkdir(parents=True, exist_ok=True)
ids = shop_ids()
DETAIL = detail_path()
MOB = dict(device_scale_factor=2, is_mobile=True, has_touch=True)
OVER = """() => { const w = document.documentElement.clientWidth; const bad = [];
  for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect();
    if (r.width && (r.right > w + 0.5 || r.left < -0.5) && getComputedStyle(el).position !== 'fixed' && !el.closest('.evtabs,.facets')) bad.push((el.className||el.tagName)+':'+Math.round(r.right)); }
  for (const el of document.querySelectorAll('.stats b,.actbar a,.nm,.num,.fbar *,.ed,.et')) if (el.scrollWidth > el.clientWidth + 1) bad.push('clip:'+el.className+':'+el.textContent.slice(0,20));
  return {sw: document.documentElement.scrollWidth, w, bad: bad.slice(0,5)}; }"""
TAP = """() => { const out = [];
  for (const el of document.querySelectorAll('a,button,select,summary,input')) { const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).visibility==='hidden') continue;
    if (el.matches('.src, .rvm a, .et a, .ir dd a, .credit a') ) continue; // inline text links (WCAG inline exception)
    if (r.height < 44 || r.width < 44) out.push((el.className||el.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height)); }
  return [...new Set(out)].slice(0,8); }"""
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    def page(w, mobile=True):
        pg = b.new_page(viewport={'width': w, 'height': 844}, **(MOB if mobile else {}))
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        return pg
    # screenshots
    pg = page(390)
    pg.goto(BASE + '/', wait_until='networkidle'); pg.screenshot(path=str(OUT / 'index_390.png'))
    pg.screenshot(path=str(OUT / 'index_390_full.png'), full_page=True)
    pg.evaluate('window.scrollTo(0, 900)'); pg.wait_for_timeout(200); pg.screenshot(path=str(OUT / 'index_390_scrolled.png'))
    pg.click('.fbtn'); pg.wait_for_timeout(400); pg.screenshot(path=str(OUT / 'index_390_filter_sheet.png'))
    pg.click('#facets .fgroup >> text=渋谷区'); pg.click('#facets >> text=Wi‑Fi'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(OUT / 'index_390_filter_sheet_selected.png'))
    print('sheet apply label:', pg.inner_text('.sapply'), '| bar:', pg.inner_text('.fbtn'))
    pg.click('.sapply'); pg.wait_for_timeout(300); pg.evaluate('window.scrollTo(0,0)'); pg.screenshot(path=str(OUT / 'index_390_filtered.png'))
    pg.close()
    pg = page(390); pg.goto(BASE + DETAIL, wait_until='networkidle')
    pg.screenshot(path=str(OUT / 'detail_390.png')); pg.screenshot(path=str(OUT / 'detail_390_full.png'), full_page=True)
    pg.click('summary >> text=メニューを見る'); pg.wait_for_timeout(200)
    pg.locator('details.fold').first.scroll_into_view_if_needed(); pg.evaluate('window.scrollBy(0,-120)'); pg.screenshot(path=str(OUT / 'detail_390_menu_open.png'))
    pg.close()
    pg = page(390); pg.goto(BASE + '/events/', wait_until='networkidle')
    pg.screenshot(path=str(OUT / 'events_390.png')); pg.screenshot(path=str(OUT / 'events_390_full.png'), full_page=True); pg.close()
    pg = page(1280, False); pg.goto(BASE + '/', wait_until='networkidle')
    pg.screenshot(path=str(OUT / 'index_1280.png')); pg.screenshot(path=str(OUT / 'index_1280_full.png'), full_page=True)
    pg.goto(BASE + DETAIL, wait_until='networkidle'); pg.screenshot(path=str(OUT / 'detail_1280_full.png'), full_page=True)
    pg.goto(BASE + '/events/', wait_until='networkidle'); pg.screenshot(path=str(OUT / 'events_1280.png'))
    pg.close()
    # audits
    paths = ['/', '/events/', '/404.html'] + [f'/cafes/{i}/' for i in ids]
    for w in (360, 390, 430):
        pg = page(w); bad = []; taps = {}
        for path in paths:
            pg.goto(BASE + path, wait_until='load')
            pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
            r = pg.evaluate(OVER)
            if r['sw'] > r['w'] or r['bad']: bad.append((path, r))
            if path in ('/', '/events/', DETAIL):
                taps[path] = pg.evaluate(TAP)
        pg.goto(BASE + '/'); pg.click('.fbtn'); pg.wait_for_timeout(300)
        sheet = pg.evaluate("() => { const f = document.querySelector('#facets'); return [f.scrollWidth, f.clientWidth]; }")
        print(f'{w}px: pages={len(paths)} overflow={len(bad)} {bad[:3]} sheet={sheet}')
        print('   small taps:', taps)
        pg.close()
    b.close()
print('js errors:', errs or 'none')
