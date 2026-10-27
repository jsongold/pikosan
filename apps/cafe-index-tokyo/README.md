# Café Index Tokyo

東京のカフェを同じ項目で索引する静的サイト（デザインD「Swiss Typographic Index」）。
Next.js 16（App Router）+ TypeScript、`output: 'export'` による完全静的書き出し。CSSはプレーンCSS（`src/app/globals.css`）。

カタログの中身（店舗・属性・メニュー・口コミ・イベント）は **このリポジトリに含まれません**。スクレイピング元の SQLite も置きません。ビルド時にページは `src/lib/data.ts` 経由で、次のどちらか一方だけを読みます。

| ソース | いつ | 環境変数 |
|---|---|---|
| ローカル JSON | 開発、または CI のデモ | `CATALOG_DATA_DIR` |
| Supabase | 本番ビルド（読み取り専用） | `SUPABASE_URL` と `SUPABASE_ANON_KEY`（またはサーバー専用キー） |

どちらも無い、または両方あるときは、空のサイトを出さずにビルドが失敗します。

テストと CI 専用の架空データは `fixtures/demo`（店名はすべて `DEMO`、3店・2イベント）だけです。実在のカフェではありません。

> **未デプロイ**です。Supabase プロジェクトも作っていません。下記は手順のみ。

## ページ

| パス | 内容 |
|---|---|
| `/` | 設定したソースにある全店の索引。エリア / ジャンル / 設備（AND）、食べログ評価・予算・店名、キーワード。状態は `?ward=&genre=&f=&sort=&q=` |
| `/cafes/<id>/` | 詳細。基本情報、味と雰囲気、軸、口コミ要約、メニュー、店舗情報、関連イベント。番号は存在する節だけで振り直し |
| `/events/` | カフェラン・カフェ音楽イベント。開催予定 / 定期開催 / 開催済み、種類フィルタ |
| `/sitemap.xml`, `/robots.txt`, `404.html` | SEO・エラーページ |

## 環境変数

`.env.example` を `.env.local` にコピーする（`.env.local` は gitignore。鍵をコミットしない）。`NEXT_PUBLIC_` で Supabase の鍵を渡さないこと（クライアントに埋め込まれます）。

```bash
# 開発: リポジトリの外に書き出した JSON
CATALOG_DATA_DIR=$HOME/cafe-index-data

# CI / 動作確認だけ: 架空のデモ
CATALOG_DATA_DIR=fixtures/demo

# 本番ビルド: Supabase。anon key を優先（RLS の SELECT のみ）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
# サーバー専用（RLS を迂回する）。anon が無いときだけ使われる
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# SUPABASE_SECRET_KEY=your-secret-key

# canonical / OGP / sitemap。未設定時は仮の https://cafe-index-tokyo.vercel.app
NEXT_PUBLIC_SITE_URL=https://example.com
```

## データの更新（ローカル JSON）

`tools/export_site_data.py` は `CAFE_DB`（既定: アプリから `../../catalog/data/cafe.db`）を **読み取り専用**で開き、`CAFE_CONFIG_DIR` の YAML ラベルと合わせて JSON に書き出します。出力先は `CATALOG_DATA_DIR`（または `--out`）で、**git リポジトリの中は拒否**します。`data/` は gitignore です。

```bash
CAFE_DB=/path/to/cafe.db CAFE_CONFIG_DIR=/path/to/config/domains/cafe \
  CATALOG_DATA_DIR=$HOME/cafe-index-data npm run data
```

DB ファイルが無いとき `python3 tools/export_site_data.py --if-available` は何も書かずに終了 0 です（PyYAML は読みません）。ビルドはこのコマンドを走らせません。JSON はコミットしないでください。

書き出しファイル:

- `shops-index.json` — 一覧・ファセット・軸
- `shops/<id>.json` — 属性（値 / 確度 / 出典）、メニュー、口コミ、関連イベント
- `events.json` — イベント（終了済みの「開催予定」は書き出し時刻で「開催済み」へ）
- `meta.json` — 件数と書き出し日時

## Supabase

スキーマは `supabase/migrations/20261027000000_catalog_init.sql` です。テーブルはソースカタログと同じ拡張の仕方です。

- `shops` — 店の識別子、区、座標、status
- `shop_attributes` — EAV（key、value jsonb、confidence、source_urls）
- `attribute_definitions` — ラベル。`category = 'flavor'` は味・雰囲気の軸（`metadata` に scale / allowed values）、`category = 'event_type'` はイベント種別ラベル
- `reviews`, `menu_items`, `events`

anon / authenticated は SELECT のみ（RLS。書き込みポリシーは無く、INSERT/UPDATE/DELETE は revoke）。アプリのプロバイダ（`src/lib/catalog-supabase.ts`）は `.select()` しかしません。このリポジトリからは Supabase プロジェクトを作成しません。

## 開発・ビルド

アプリディレクトリ `apps/cafe-index-tokyo` で実行します。

```bash
npm ci
npm run dev:fixture     # CATALOG_DATA_DIR=fixtures/demo → http://localhost:3000
npm run build:fixture   # 同じデモで静的書き出し → out/
CATALOG_DATA_DIR=$HOME/cafe-index-data npm run dev
npm run build           # ソース未設定なら失敗する
npm run serve           # out/ を http://localhost:4173
npm run lint            # tsc --noEmit
```

フォントは `next/font/google`（Inter Tight / Noto Sans JP ほか）をビルド時に取得するため、ビルド環境にネットワークが必要です。

スクリーンショット（`tools/shoot*.py`）も `CATALOG_DATA_DIR` の索引を見ます。`data/shops-index.json` は読みません。

## デプロイ（Vercel）

1. Project の Root Directory を `apps/cafe-index-tokyo` にする（リポジトリルートではない）。
2. Environment Variables（ビルド時）:
   - `NEXT_PUBLIC_SITE_URL` — 公開 URL。canonical・OGP・sitemap に使う。
   - `SUPABASE_URL` と `SUPABASE_ANON_KEY`（推奨）。鍵はコミットしない。`NEXT_PUBLIC_SUPABASE_*` は禁止。
   - サーバー専用キー（`SUPABASE_SERVICE_ROLE_KEY` または `SUPABASE_SECRET_KEY`）は anon が無い場合だけ。RLS を迂回するのでクライアントに出さない。
   - `CATALOG_DATA_DIR` は Vercel 上に JSON が無いので通常は設定しない（リポジトリにカタログ JSON は無い）。
3. ソースが一つも無いビルドは失敗する。空サイトにはならない。
4. ビルドは Google Fonts を取得する。ネットワークが必要。
5. `vercel.json` は framework=nextjs / `npm ci` / `npm run build`。

```bash
vercel deploy --prod --token $VERCEL_TOKEN \
  --build-env NEXT_PUBLIC_SITE_URL=https://example.com \
  --build-env SUPABASE_URL=https://your-project.supabase.co \
  --build-env SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
```

静的ファイルとして他のホスティングに置く場合は、同じ環境変数で `npm run build` した `out/` をアップロードする（`trailingSlash: true`）。

## 既知の制約

- ソースカタログ側では、イベントが店舗 ID に紐付かないことが多い（名称・区・80m 以内でも一致しない場合、詳細の「関連イベント」は出ません）。Supabase プロバイダも同じ規則で紐付けます。
- メニュー名は食べログ英語版の表記で、機械翻訳の可能性があります。
- 味・雰囲気の軸と口コミ要約は公開情報からの推定・要約です。

## Mobile-first layout (v2)
- Base CSS targets ~390px phones; `@media (min-width:900px)` restores the desktop 12-col table/sidebar.
- Index: list rows + filter bottom sheet (`絞り込み（n）`) + native sort select; desktop keeps the full table.
- Detail: key facts first, collapsible menu/store info (auto-open on desktop), sticky bottom action bar (地図/電話/公式サイト).
- QA: `CATALOG_DATA_DIR=... python3 tools/shoot_v2.py` (screens to ../app_screens/v2/, overflow audit at 360/390/430, 44px tap audit).

## Themes (variants of design D)
**Default: 2 Sage & Cream.** `data-theme="sage"` is in the static HTML, so it needs no query and no JS; meta theme-color is `#f7f5ec`.
The other skins share the same layout and markup and stay available for comparison:
- Switch: `?theme=d|blush|sage|latte|lilac`, where `d` is the original design D. The choice is saved in localStorage `ci-theme`; `?theme=` resets to the default.
- The footer theme switcher is hidden from normal visitors and only appears when a `?theme=` override is present or saved (`html[data-thsw]`).
- QA for the default: `CATALOG_DATA_DIR=... python3 tools/shoot_sage_default.py` writes `../app_screens/sage_default/`.
- Tokens and skins: edit `tools/gen_themes.py`, then run `python3 tools/gen_themes.py` (writes `src/app/themes.css`; `--check` runs the AA contrast table).
- QA: `CATALOG_DATA_DIR=... python3 tools/shoot_themes.py [--quick]` takes 390px screenshots, runs the contrast audit and the 360/390/430 overflow audit, and writes `../app_screens/themes/compare.png`.
- Fonts come from next/font/google, so the build needs network access.
