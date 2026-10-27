# Café Index Tokyo

東京のカフェ85軒・イベント29件を同じ項目で索引する静的サイト（デザインD「Swiss Typographic Index」）。
Next.js 16（App Router）+ TypeScript、`output: 'export'` による完全静的書き出し。CSSはプレーンCSS（`src/app/globals.css`）。

> **未デプロイ**です。下記「デプロイ」は手順のみ。

## ページ

| パス | 内容 |
|---|---|
| `/` | 全85軒の索引テーブル。エリア（区・市）/ジャンル/設備・特徴（AND）で絞り込み、食べログ評価・予算・店名で並べ替え、キーワード検索。状態はURLクエリ（`?ward=&genre=&f=&sort=&q=`）に反映 |
| `/cafes/<id>/` | 詳細。01 基本情報 / 02 味と雰囲気 / 03 軸（確度つき）/ 04 評判・口コミ要約（出典リンク）/ 05 メニュー / 06 店舗情報（出典・確度）/ 関連イベント（紐付けがある場合のみ）。番号は存在する節だけで振り直し |
| `/events/` | カフェラン・カフェ音楽イベント。開催予定 / 定期開催 / 開催済み、種類フィルタ |
| `/sitemap.xml`, `/robots.txt`, `404.html` | SEO・エラーページ |

## データの更新

データはアプリディレクトリからの相対パス `../../catalog/data/cafe.db`（このリポジトリでは `catalog/data/cafe.db`）を **読み取り専用**（`?mode=ro`）で開き、YAMLのラベル定義
（同じ catalog の `config/domains/cafe/*.yaml`）と合わせて JSON に書き出します。空の値は除外し、各値の出典URL・確度は保持します。
`cafe.db` はこのリポジトリに含まれません。DB が無いとき `npm run data`（`prebuild`）は PyYAML を読まず、コミット済みの `data/*.json` を維持して終了コード 0 で終わります。

```bash
npm run data          # tools/export_site_data.py --if-available（DBが無ければ既存JSONを維持して終了0）
npm run data:strict   # DBが無ければ失敗
CAFE_DB=/path/to/cafe.db CAFE_CONFIG_DIR=/path/to/config/domains/cafe npm run data
```

出力（コミット対象。Vercel等DBの無い環境でもビルドできるように）:

- `data/shops-index.json` — 一覧用の行・ファセット件数・軸定義
- `data/shops/<id>.json` — 店ごとの全属性（`v`値 / `conf`確度 / `src`出典 / `at`取得日 / `label`）、メニュー、口コミ要約、関連イベント
- `data/events.json` — イベント（ステータスは書き出し時刻で再計算：終了済みの「開催予定」は「開催済み」へ）
- `data/meta.json` — 書き出し日時と件数

更新手順: `npm run data` → 差分確認 → `npm run build` → `git commit data/`。
`npm run build` は `prebuild` で自動的に `npm run data` を実行します。

## 開発・ビルド

```bash
npm ci
npm run dev           # http://localhost:3000
npm run build         # → out/（静的HTML一式）
npm run serve         # out/ を http://localhost:4173 で配信（python3 http.server）
npm run lint          # tsc --noEmit
python3 tools/shoot.py  # serve中に ../app_screens/ へスクリーンショット（Playwright）
```

フォントは `next/font/google`（Inter Tight / Noto Sans JP）をビルド時に取得するため、ビルド環境にネットワークが必要です。

## デプロイ（Vercel CLI）

1. 公開URLを決め、`NEXT_PUBLIC_SITE_URL` を設定（canonical・OGP・sitemap に使用。未設定時は仮の `https://cafe-index-tokyo.vercel.app`）。
   Vercelの Project Settings → Environment Variables に登録するか、`--build-env` で渡します。
2. デプロイ:

```bash
vercel deploy --prod --token $VERCEL_TOKEN
# 例: vercel deploy --prod --token $VERCEL_TOKEN --build-env NEXT_PUBLIC_SITE_URL=https://example.com
```

`vercel.json` は framework=nextjs / `npm ci` / `npm run build` を指定しています。Vercel上には cafe.db が無いので
`npm run data` は既存の `data/*.json` をそのまま使います（＝デプロイ前に data を更新してコミットしておく）。
静的ファイルとして他のホスティングに置く場合は `out/` をそのままアップロードすれば動きます（`trailingSlash: true`）。

## 既知の制約

- イベント29件はいずれも店舗IDに紐付いておらず（名称・区・80m以内の位置でも一致なし）、詳細ページの「関連イベント」節は現状どの店にも表示されません。
- メニュー名は食べログ英語版の表記で、機械翻訳の可能性があります（フッター・メニュー節に注記）。
- 味・雰囲気の軸と口コミ要約は口コミ等からの独自推定・要約です。

## Mobile-first layout (v2)
- Base CSS targets ~390px phones; `@media (min-width:900px)` restores the desktop 12-col table/sidebar.
- Index: list rows + filter bottom sheet (`絞り込み（n）`) + native sort select; desktop keeps the full table.
- Detail: key facts first, collapsible menu/store info (auto-open on desktop), sticky bottom action bar (地図/電話/公式サイト).
- QA: `python3 tools/shoot_v2.py` (screens to ../app_screens/v2/, overflow audit at 360/390/430, 44px tap audit).

## Themes (variants of design D)
**Default: 2 Sage & Cream.** `data-theme="sage"` is in the static HTML, so it needs no query and no JS; meta theme-color is `#f7f5ec`.
The other skins share the same layout and markup and stay available for comparison:
- Switch: `?theme=d|blush|sage|latte|lilac`, where `d` is the original design D. The choice is saved in localStorage `ci-theme`; `?theme=` resets to the default.
- The footer theme switcher is hidden from normal visitors and only appears when a `?theme=` override is present or saved (`html[data-thsw]`).
- QA for the default: `python3 tools/shoot_sage_default.py` writes `../app_screens/sage_default/`.
- Tokens and skins: edit `tools/gen_themes.py`, then run `python3 tools/gen_themes.py` (writes `src/app/themes.css`; `--check` runs the AA contrast table).
- QA: `python3 tools/shoot_themes.py [--quick]` takes 390px screenshots, runs the contrast audit and the 360/390/430 overflow audit, and writes `../app_screens/themes/compare.png`.
- Fonts come from next/font/google, so the build needs network access.
