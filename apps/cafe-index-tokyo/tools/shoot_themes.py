"""Theme QA: 390px screens per theme (index / filter sheet / detail top) to ../app_screens/themes/,
labeled compare.png, horizontal-overflow audit at 360/390/430 on every page, and in-page WCAG AA text-contrast audit."""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
BASE = 'http://localhost:4173'
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'app_screens' / 'themes'; OUT.mkdir(parents=True, exist_ok=True)
THEMES = [('blush', '1 Blush'), ('sage', '2 Sage & Cream'), ('latte', '3 Latte'), ('lilac', '4 Lilac & Butter')]
DETAIL = '/cafes/8/'
ids = [s['id'] for s in json.load(open(ROOT / 'data/shops-index.json'))['shops']]
MOB = dict(device_scale_factor=2, is_mobile=True, has_touch=True)
OVER = open(ROOT / 'tools/shoot_v2.py').read().split('OVER = """')[1].split('"""')[0]
CONTRAST = """() => {
  const P = s => { const m = s.match(/[\\d.]+/g).map(Number); return m; };
  const L = ([r,g,b]) => { const f = c => (c/=255) <= .03928 ? c/12.92 : ((c+.055)/1.055)**2.4; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = P(getComputedStyle(e).backgroundColor); if (c.length < 4 || c[3] > .5) { if (c.length===3 || c[3]>.5) { if (!(c.length===4 && c[3]===0)) return c.slice(0,3); } } } return [255,255,255]; };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('.vh,[aria-hidden=true]') || r.bottom < 0 || r.top > innerHeight * 3) continue;
    if (el.closest('button:disabled')) continue;  // disabled controls are exempt
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity; if (op < .99) continue;
    const fg = P(cs.color).slice(0,3), bg = bgOf(el);
    const a = L(fg), b = L(bg), cr = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const fs = parseFloat(cs.fontSize), fw = +cs.fontWeight, large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    if (cr < (large ? 3 : 4.5)) out.push(`${el.tagName.toLowerCase()}.${el.className}「${el.textContent.trim().slice(0,12)}」 ${cr.toFixed(2)}`);
  }
  return [...new Set(out)].slice(0, 10); }"""
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    def page(w):
        pg = b.new_page(viewport={'width': w, 'height': 844}, **MOB)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        return pg
    for th, _ in THEMES + [('d', 'D original')]:
        name = 'default_D' if th == 'd' else th
        pg = page(390)
        pg.goto(f'{BASE}/?theme={th}', wait_until='networkidle'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
        assert (pg.evaluate("document.documentElement.getAttribute('data-theme')") or 'd') == th
        pg.screenshot(path=str(OUT / f'{name}_index.png'))
        con = {'/': pg.evaluate(CONTRAST)}
        pg.click('.fbtn'); pg.wait_for_timeout(350)
        pg.locator('#facets .fx-b', has_text='渋谷区').first.click(); pg.wait_for_timeout(250)
        pg.screenshot(path=str(OUT / f'{name}_filter.png'))
        con['sheet'] = pg.evaluate(CONTRAST.replace("r.top > innerHeight * 3", "!el.closest('#facets')"))
        pg.goto(BASE + DETAIL, wait_until='networkidle'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT / f'{name}_detail.png'))
        pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
        con[DETAIL] = pg.evaluate(CONTRAST.replace("r.top > innerHeight * 3", "false"))
        pg.goto(BASE + '/events/', wait_until='networkidle'); pg.wait_for_timeout(200)
        pg.screenshot(path=str(OUT / f'{name}_events.png'))
        con['/events/'] = pg.evaluate(CONTRAST)
        pg.close()
        print(f'[{name}] contrast failures:', {k: v for k, v in con.items() if v} or 'none')
        if th != 'd' and '--quick' not in sys.argv:
            for w in (360, 390, 430):
                pg = page(w); pg.goto(f'{BASE}/?theme={th}', wait_until='load'); bad = []
                for path in ['/', '/events/', '/404.html'] + [f'/cafes/{i}/' for i in ids]:
                    pg.goto(BASE + path, wait_until='load')
                    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
                    r = pg.evaluate(OVER); r['bad'] = [x for x in r['bad'] if not x.startswith('clip:vh')]
                    if r['sw'] > r['w'] or r['bad']: bad.append((path, r))
                print(f'   {w}px overflow pages: {len(bad)} {bad[:2]}'); pg.close()
    b.close()
# labeled side-by-side compare (index screens 1–4)
ims = [Image.open(OUT / f'{t}_index.png') for t, _ in THEMES]
W, H = ims[0].size; pad, lab = 40, 120
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 52)
except Exception: font = ImageFont.load_default()
sheet = Image.new('RGB', (pad + len(ims) * (W + pad), lab + H + pad), '#e9e6e3'); d = ImageDraw.Draw(sheet)
for i, (im, (_, label)) in enumerate(zip(ims, THEMES)):
    x = pad + i * (W + pad); d.text((x, 34), label, fill='#222', font=font); sheet.paste(im.convert('RGB'), (x, lab))
sheet.save(OUT / 'compare.png'); print('compare.png', sheet.size)
print('js errors:', errs or 'none')
