"""Locate a catalog export for the screenshot scripts.

Catalog JSON is not stored in the repo. Set CATALOG_DATA_DIR to an export
from tools/export_site_data.py, or to fixtures/demo for the labelled demo set.
"""
import json
import os
import sys
from pathlib import Path


def index_path() -> Path:
    env = os.environ.get('CATALOG_DATA_DIR')
    if not env:
        sys.exit('Set CATALOG_DATA_DIR to a catalog export. Catalog JSON is not in this repo '
                 '(fixtures/demo is the labelled fictional set).')
    p = Path(env).expanduser().resolve() / 'shops-index.json'
    if not p.is_file():
        sys.exit(f'No shops-index.json in {env}')
    return p


def shop_ids() -> list:
    return [s['id'] for s in json.loads(index_path().read_text())['shops']]


def detail_path() -> str:
    ids = shop_ids()
    if not ids:
        sys.exit('Catalog index has no shops')
    return f'/cafes/{ids[0]}/'
