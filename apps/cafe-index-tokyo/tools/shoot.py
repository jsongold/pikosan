"""Screenshot the served static export (npm run serve) into ../app_screens/."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from qa_data import detail_path
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173'
OUT = Path(__file__).resolve().parents[2] / 'app_screens'
OUT.mkdir(exist_ok=True)
DETAIL = detail_path()
SHOTS = [
    ('index_desktop.png', '/', 1280, True),
    ('index_desktop_filtered.png', '/?ward=%E6%B8%8B%E8%B0%B7%E5%8C%BA&f=wifi&sort=priceAsc', 1280, False),
    ('index_mobile.png', '/', 390, True),
    ('detail_desktop.png', DETAIL, 1280, True),
    ('detail_mobile.png', DETAIL, 390, True),
    ('events_desktop.png', '/events/', 1280, True),
    ('events_mobile.png', '/events/', 390, False),
]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, path, w, full in SHOTS:
        pg = b.new_page(viewport={'width': w, 'height': 900}, device_scale_factor=1 if w > 500 else 2)
        pg.on('console', lambda m: m.type == 'error' and errs.append(f'{path}: {m.text}'))
        pg.on('pageerror', lambda e: errs.append(f'{path}: {e}'))
        pg.goto(BASE + path, wait_until='networkidle')
        pg.wait_for_timeout(400)
        pg.screenshot(path=str(OUT / name), full_page=full)
        print(name, pg.evaluate('document.documentElement.scrollHeight'))
        pg.close()
    b.close()
print('errors:', errs or 'none')
