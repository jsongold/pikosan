import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Src } from '@/components/Src';
import { eventWhen } from '@/components/EventRow';
import { getIndex, getShop, SITE_NAME, SITE_URL } from '@/lib/data';
import { asList, confJa, fmt, hostOf, isUrl, pad3, SENT_JA, yen } from '@/lib/format';
import type { Attr, MenuItem, ShopDetail } from '@/lib/types';

export const dynamicParams = false;
export function generateStaticParams() {
  return getIndex().shops.map((s) => ({ id: String(s.id) }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = getShop(id);
  if (!s) return {};
  const a = (k: string) => s.attrs[k]?.v;
  const genres = asList(a('basic.genres')).join('・');
  const lead = fmt(a('taste.description')) || fmt(a('review.praise_summary'));
  const desc = `${s.name}（${[s.ward, fmt(a('basic.nearest_station'))].filter(Boolean).join('・')}${genres ? '／' + genres : ''}）。${lead}`.slice(0, 150);
  return {
    title: `${s.name} — ${s.ward ?? '東京'}のカフェ`,
    description: desc,
    alternates: { canonical: `/cafes/${s.id}/` },
    openGraph: { type: 'article', url: `/cafes/${s.id}/`, title: `${s.name} | ${SITE_NAME}`, description: desc },
  };
}

// keys rendered in dedicated sections -> excluded from 08 店舗情報
const SHOWN = new Set([
  'basic.genres', 'basic.genres_raw', 'basic.tabelog_url', 'basic.access', 'basic.phone', 'basic.website', 'basic.features', 'menu.signature_items', 'basic.nearest_station', 'basic.hours',
  'basic.closed_days', 'basic.price_range_text', 'basic.price_min', 'basic.price_max', 'award.tabelog_score',
  'award.tabelog_review_count', 'taste.description', 'taste.atmosphere_description', 'review.praise_summary',
  'review.criticism_summary', 'review.recommended_for', 'flavor.evidence', 'flavor.confidence',
]);
const CAT_ORDER = ['basic', 'visit', 'facility', 'work', 'menu', 'dietary', 'award'];

function Val({ a }: { a: Attr }) {
  const s = fmt(a.v);
  if (isUrl(s) && !s.includes(' ')) return <a href={s} target="_blank" rel="noopener noreferrer nofollow">{hostOf(s)}</a>;
  return <>{s.split('\n').map((line, i) => <span key={i} className="ln">{line}</span>)}</>;
}
function Row({ a, k }: { a?: Attr; k: string }) {
  if (!a) return null;
  return (
    <div className="ir" data-key={k}>
      <dt>{a.label}</dt>
      <dd><Val a={a} /> <Src urls={a.src} conf={a.conf} /></dd>
    </div>
  );
}
function Section({ n, title, en, children }: { n: number; title: string; en?: string; children: ReactNode }) {
  return (
    <section className="g sec" aria-labelledby={`s${n}`}>
      <h2 className="sh" id={`s${n}`}><span>{String(n).padStart(2, '0')}{en ? ` ${en}` : ''}</span>{title}</h2>
      <div className="sc">{children}</div>
    </section>
  );
}

function axesOf(s: ShopDetail) {
  const idx = getIndex();
  const ev = asArray(s.attrs['flavor.evidence']?.v);
  const evSrc = (key: string) => (ev.find((e) => e.axis === key)?.sources as string[] | undefined) ?? [];
  const scored: { key: string; label: string; atmos: boolean; score: number; max: number; text: string; conf?: string; src: string[] }[] = [];
  const text: { key: string; label: string; text: string; conf?: string; src: string[] }[] = [];
  for (const ax of idx.axes) {
    const lab = s.attrs[`flavor.${ax.key}`];
    if (!lab || ax.key === 'atmos_mood') continue;
    const src = lab.src?.length ? lab.src : evSrc(ax.key);
    const sc = s.attrs[`flavor.${ax.key}_score`];
    if (ax.scale && sc && !Number.isNaN(Number(sc.v))) {
      scored.push({ key: ax.key, label: ax.label, atmos: !!ax.atmos, score: Number(sc.v), max: ax.scale[1], text: fmt(lab.v), conf: lab.conf, src });
    } else {
      text.push({ key: ax.key, label: ax.label, text: fmt(lab.v), conf: lab.conf, src });
    }
  }
  return { scored, text };
}
function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [];
}
function groupMenu(menu: MenuItem[]) {
  const out: { section?: string; items: MenuItem[] }[] = [];
  for (const m of menu) {
    const last = out[out.length - 1];
    if (last && last.section === m.section) last.items.push(m);
    else out.push({ section: m.section, items: [m] });
  }
  return out;
}

export default async function CafePage({ params }: Props) {
  const { id } = await params;
  const s = getShop(id);
  if (!s) notFound();
  const idx = getIndex();
  const rank = idx.shops.findIndex((x) => x.id === s.id) + 1;
  const A = (k: string) => s.attrs[k];
  const v = (k: string) => (A(k) ? fmt(A(k).v) : '');
  const genres = asList(A('basic.genres')?.v);
  const score = A('award.tabelog_score')?.v as number | undefined;
  const price = v('basic.price_range_text').split('（')[0];
  const { scored, text } = axesOf(s);
  const menu = s.menu ?? [];
  const reviews = s.reviews ?? [];
  const menuSrc = [...new Set(menu.map((m) => m.src).filter(Boolean) as string[])];
  const hasMt = menu.some((m) => m.mt);
  const tabelog = v('basic.tabelog_url');
  const info = Object.entries(s.attrs)
    .filter(([k]) => !SHOWN.has(k) && !k.startsWith('flavor.'))
    .sort(([a], [b]) => {
      const ca = CAT_ORDER.indexOf(a.split('.')[0]), cb = CAT_ORDER.indexOf(b.split('.')[0]);
      return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
    });
  const flavorConf = v('flavor.confidence');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: s.name,
    url: `${SITE_URL}/cafes/${s.id}/`,
    ...(s.address ? { address: { '@type': 'PostalAddress', streetAddress: s.address, addressRegion: s.prefecture ?? '東京都', addressCountry: 'JP' } } : {}),
    ...(s.lat && s.lng ? { geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng } } : {}),
    ...(v('basic.phone') ? { telephone: v('basic.phone') } : {}),
    ...(genres.length ? { servesCuisine: genres } : {}),
    ...(price ? { priceRange: price } : {}),
    ...(isUrl(v('basic.website')) ? { sameAs: [v('basic.website')] } : {}),
  };

  const phone = v('basic.phone');
  const telOk = /^[0-9０-９+()\-－ ]{6,20}$/.test(phone);
  const tel = telOk ? phone.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[^0-9+]/g, '') : '';
  const mapUrl = s.lat && s.lng
    ? `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
    : s.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}` : '';
  const site = isUrl(v('basic.website')) ? v('basic.website') : '';
  const access = [v('basic.nearest_station'), v('basic.access')].filter(Boolean);
  const ext = { target: '_blank', rel: 'noopener noreferrer nofollow' } as const;
  const actions = [
    mapUrl ? <a key="map" href={mapUrl} {...ext}><b>地図</b><span>Google マップ</span></a> : null,
    tel ? <a key="tel" href={`tel:${tel}`}><b>電話</b><span>{phone}</span></a> : null,
    site ? <a key="web" href={site} {...ext}><b>公式サイト</b><span>{hostOf(site)}</span></a> : null,
    !site && tabelog ? <a key="tb" href={tabelog} {...ext}><b>食べログ</b><span>店舗ページ</span></a> : null,
  ].filter(Boolean);

  let n = 0;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Header
        c2={<p>{s.ward}<br />{v('basic.nearest_station')}</p>}
        c3={<p>{genres.map((g) => <span key={g} className="ln">{g}</span>)}</p>}
        nav={<><Link href="/">← Index</Link><Link href="/events/">Events</Link></>}
      />
      <div className={actions.length ? 'has-act' : ''}>
      <section className="g dhead">
        <p className="idn">No. {pad3(rank)}<span>{[s.ward, genres.slice(0, 2).join('・')].filter(Boolean).join(' ／ ')}</span></p>
        <h1>{s.name}</h1>
        {s.kana && s.kana !== s.name ? <p className="kana">{s.kana}</p> : null}
        <div className="stats">
          {score ? <div><b>{score.toFixed(2)}</b><span>食べログ{A('award.tabelog_review_count') ? `・口コミ${v('award.tabelog_review_count')}件` : ''} <Src urls={A('award.tabelog_score').src} /></span></div> : null}
          {price ? <div><b>{price.replace('～', '～\u200b')}</b><span>予算 <Src urls={A('basic.price_range_text').src} /></span></div> : null}
          {A('facility.total_seats') ? <div className="xs"><b>{v('facility.total_seats')}</b><span>席</span></div> : null}
          {menu.length ? <div className="xs"><b>{menu.length}</b><span>メニュー掲載品数</span></div> : null}
        </div>
        {actions.length ? <nav className="actbar" aria-label="この店へのアクション">{actions}</nav> : null}
      </section>

      <Section n={++n} title="基本情報" en="Key facts">
        <dl className="info one kf">
          {A('basic.hours') ? <Row k="basic.hours" a={A('basic.hours')} /> : null}
          {A('basic.closed_days') ? <Row k="basic.closed_days" a={A('basic.closed_days')} /> : null}
          {access.length ? (
            <div className="ir"><dt>アクセス</dt><dd>{access.map((x, i) => <span key={i} className="ln">{x}</span>)} <Src urls={(A('basic.access') ?? A('basic.nearest_station')).src} conf={(A('basic.access') ?? A('basic.nearest_station')).conf} /></dd></div>
          ) : null}
          {s.address ? <div className="ir"><dt>住所</dt><dd>{s.address} {mapUrl ? <a className="lnk" href={mapUrl} {...ext}>地図を開く</a> : null} <Src urls={s.sources} /></dd></div> : null}
          {phone ? <div className="ir"><dt>電話</dt><dd>{tel ? <a className="lnk" href={`tel:${tel}`}>{phone}</a> : phone} <Src urls={A('basic.phone').src} conf={A('basic.phone').conf} /></dd></div> : null}
          {(['basic.price_range_text', 'basic.genres', 'menu.signature_items', 'basic.features', 'flavor.atmos_mood'] as const).map((k) => <Row key={k} k={k} a={A(k)} />)}
          {site ? <div className="ir"><dt>公式サイト</dt><dd><a className="lnk" href={site} {...ext}>{hostOf(site)}</a> <Src urls={A('basic.website').src} conf={A('basic.website').conf} /></dd></div> : null}
          {tabelog ? <div className="ir"><dt>食べログ</dt><dd><a className="lnk" href={tabelog} {...ext}>店舗ページ</a></dd></div> : null}
        </dl>
        {s.feats?.length ? (
          <ul className="flags" aria-label="設備・特徴">
            {idx.facets.features.filter((f) => s.feats!.includes(f.v)).map((f) => <li key={f.v}>● {f.label}</li>)}
          </ul>
        ) : null}
      </Section>

      {A('taste.description') || A('taste.atmosphere_description') || A('flavor.signature_note') || scored.length || text.length ? (
        <Section n={++n} title="味・雰囲気" en="Taste & Mood">
          {A('taste.description') ? <p className="lead">{v('taste.description')} <Src urls={A('taste.description').src} conf={A('taste.description').conf} /></p> : null}
          {(['taste', 'atmos'] as const).map((grp) => {
            const list = scored.filter((x) => (grp === 'atmos') === x.atmos);
            if (!list.length) return null;
            return (
              <div key={grp} className="axes">
                <h3 className="axh">{grp === 'atmos' ? '雰囲気の軸' : '味の軸'}</h3>
                {list.map((a) => (
                  <div className="ax" key={a.key}>
                    <span className="axn">{a.score}<small>/{a.max}</small></span>
                    <span className="axl">{a.label}</span>
                    <span className="rule" style={{ ['--v' as string]: (a.score / a.max).toFixed(2) }} aria-hidden />
                    <span className="axv">{a.text} <Src urls={a.src} conf={a.conf} /></span>
                  </div>
                ))}
              </div>
            );
          })}
          {text.length ? (
            <dl className="info one axt">
              {text.map((t) => <div className="ir" key={t.key}><dt>{t.label}</dt><dd>{t.text} <Src urls={t.src} conf={t.conf} /></dd></div>)}
            </dl>
          ) : null}
          {A('flavor.signature_note') ? <p className="note">看板 — {v('flavor.signature_note')} <Src urls={A('flavor.signature_note').src} conf={A('flavor.signature_note').conf} /></p> : null}
          {A('taste.atmosphere_description') ? <p className="note">{v('taste.atmosphere_description')} <Src urls={A('taste.atmosphere_description').src} conf={A('taste.atmosphere_description').conf} /></p> : null}
          {scored.length ? <p className="fine">軸は口コミ・店舗情報からの推定値です（5段階）。{flavorConf ? `この店の軸全体の確度：${confJa(flavorConf)}。` : ''}</p> : null}
        </Section>
      ) : null}

      {A('review.praise_summary') || A('review.criticism_summary') || reviews.length ? (
        <Section n={++n} title="評判・口コミ要約" en="Reviews">
          <div className="two">
            {A('review.praise_summary') ? <div><h5>+</h5><p>{v('review.praise_summary')}</p><Src urls={A('review.praise_summary').src} conf={A('review.praise_summary').conf} /></div> : null}
            {A('review.criticism_summary') ? <div><h5>−</h5><p>{v('review.criticism_summary')}</p><Src urls={A('review.criticism_summary').src} conf={A('review.criticism_summary').conf} /></div> : null}
          </div>
          {A('review.recommended_for') ? <p className="rec">こんな時に — {asList(A('review.recommended_for').v).join('、')} <Src urls={A('review.recommended_for').src} conf={A('review.recommended_for').conf} /></p> : null}
          {reviews.length ? (
            <ul className="rvl">
              {reviews.map((r, i) => (
                <li key={i} className={r.sentiment}>
                  {r.sentiment ? <span className="rvs">{SENT_JA[r.sentiment] ?? r.sentiment}</span> : null}
                  <p>{r.summary}</p>
                  <div className="rvm">
                    {[r.rating ? `★${r.rating.toFixed(1)}` : '', r.date ?? ''].filter(Boolean).join(' · ')}
                    {r.url ? <> · <a href={r.url} {...ext}>{r.source ?? hostOf(r.url)}の口コミ</a></> : r.source ? ` · ${r.source}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="fine">口コミ要約は元の口コミをもとにした独自の要約です。</p>
        </Section>
      ) : null}

      {menu.length ? (
        <Section n={++n} title="メニュー" en="Menu">
          <details className="fold">
            <summary><span>メニューを見る</span><em>{menu.length}品</em></summary>
            <div className="mcols">
              {groupMenu(menu).map((g, gi) => (
                <div key={gi} className="mgroup">
                  {g.section ? <h3 className="mh">{g.section}</h3> : null}
                  <ul className="menu">
                    {g.items.map((m, i) => (
                      <li key={i}>
                        <span className="mn">{m.name}{m.note ? <small> {m.note}</small> : null}</span>
                        <span className="dots" />
                        {m.price ? <span className="mp">{yen(m.price)}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
          <p className="fine">
            {hasMt ? 'メニュー名は食べログ英語版の表記で、機械翻訳の可能性があります。' : ''}価格は掲載時点。
            {menuSrc.slice(0, 3).map((u, i) => <a key={u} className="src" href={u} {...ext}>出典{menuSrc.length > 1 ? i + 1 : ''}</a>)}
          </p>
        </Section>
      ) : null}

      {info.length ? (
        <Section n={++n} title="店舗情報" en="Details">
          <details className="fold">
            <summary><span>店舗情報を見る</span><em>{info.length}項目</em></summary>
            <dl className="info">{info.map(([k, a]) => <Row key={k} k={k} a={a} />)}</dl>
          </details>
        </Section>
      ) : null}

      {s.events?.length ? (
        <Section n={++n} title="関連イベント" en="Events">
          <div className="etable">
            {s.events.map((e) => {
              const w = eventWhen(e);
              const link = e.booking_url || e.sources?.[0];
              return (
                <article className="er" key={e.id}>
                  <span className="ed"><b className="etxt">{w.date}</b>{w.time ? <span className="etm">{w.time}〜</span> : null}</span>
                  <span className="ety">{e.typeLabel ?? e.type}</span>
                  <span className="et">{link ? <a href={link} {...ext}>{e.title}</a> : e.title}</span>
                  <span className="ev">{e.status === 'past' ? '開催済み' : e.status === 'recurring' ? '定期開催' : '開催予定'}</span>
                </article>
              );
            })}
          </div>
        </Section>
      ) : null}
      <script dangerouslySetInnerHTML={{ __html: "if(matchMedia('(min-width:900px)').matches)document.querySelectorAll('details.fold').forEach(function(d){d.open=true})" }} />

      <nav className="g pager" aria-label="前後のカフェ">
        {rank > 1 ? <Link href={`/cafes/${idx.shops[rank - 2].id}/`}>← {pad3(rank - 1)} {idx.shops[rank - 2].name}</Link> : <span />}
        {rank < idx.shops.length ? <Link className="nx" href={`/cafes/${idx.shops[rank].id}/`}>{pad3(rank + 1)} {idx.shops[rank].name} →</Link> : <span />}
      </nav>
      <Footer />
      </div>
    </>
  );
}
