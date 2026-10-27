'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Facet, ShopRow } from '@/lib/types';

type SortKey = 'score' | 'priceAsc' | 'priceDesc' | 'name';
const SORTS: { v: SortKey; label: string }[] = [
  { v: 'score', label: '食べログ評価順' },
  { v: 'priceAsc', label: '予算の安い順' },
  { v: 'priceDesc', label: '予算の高い順' },
  { v: 'name', label: '店名順' },
];
const FCOLS: { v: string; label: string }[] = [
  { v: 'wifi', label: 'Wi‑Fi' },
  { v: 'power', label: '電源' },
  { v: 'morning', label: '朝' },
  { v: 'terrace', label: 'テラス' },
];
const collator = new Intl.Collator('ja');
const priceOf = (s: ShopRow) => s.priceMin ?? s.priceMax;

function sortShops(list: ShopRow[], key: SortKey) {
  const a = [...list];
  const byScore = (x: ShopRow, y: ShopRow) => (y.score ?? -1) - (x.score ?? -1) || collator.compare(x.name, y.name);
  if (key === 'score') return a.sort(byScore);
  if (key === 'name') return a.sort((x, y) => collator.compare(x.kana ?? x.name, y.kana ?? y.name));
  const dir = key === 'priceAsc' ? 1 : -1;
  return a.sort((x, y) => {
    const px = priceOf(x), py = priceOf(y);
    if (px === undefined && py === undefined) return byScore(x, y);
    if (px === undefined) return 1; // unknown budget always last
    if (py === undefined) return -1;
    return (px - py) * dir || byScore(x, y);
  });
}

export default function IndexTable({
  shops, wards, genres, features, total,
}: { shops: ShopRow[]; wards: Facet[]; genres: Facet[]; features: Facet[]; total: number }) {
  const [ward, setWard] = useState<string>('');
  const [genre, setGenre] = useState<string>('');
  const [feats, setFeats] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>('score');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false); // mobile facet drawer

  // restore state from the URL (?ward=&genre=&f=a,b&sort=&q=) so filtered views are shareable
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setWard(p.get('ward') ?? '');
    setGenre(p.get('genre') ?? '');
    setFeats((p.get('f') ?? '').split(',').filter(Boolean));
    const s = p.get('sort') as SortKey | null;
    if (s && SORTS.some((x) => x.v === s)) setSort(s);
    setQ(p.get('q') ?? '');
  }, []);
  useEffect(() => {
    const p = new URLSearchParams();
    if (ward) p.set('ward', ward);
    if (genre) p.set('genre', genre);
    if (feats.length) p.set('f', feats.join(','));
    if (sort !== 'score') p.set('sort', sort);
    if (q) p.set('q', q);
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [ward, genre, feats, sort, q]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = shops.filter(
      (s) =>
        (!ward || s.ward === ward) &&
        (!genre || (s.genres ?? []).includes(genre)) &&
        feats.every((x) => (s.feats ?? []).includes(x)) &&
        (!needle || [s.name, s.kana, s.station, s.ward, ...(s.genres ?? [])].some((t) => t?.toLowerCase().includes(needle))),
    );
    return sortShops(f, sort);
  }, [shops, ward, genre, feats, sort, q]);

  const toggleFeat = (v: string) => setFeats((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  const clear = () => { setWard(''); setGenre(''); setFeats([]); setQ(''); };
  const nActive = (ward ? 1 : 0) + (genre ? 1 : 0) + feats.length + (q ? 1 : 0);

  // bottom sheet (mobile): lock page scroll, close on Escape
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    html.classList.add('locked');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => { html.classList.remove('locked'); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const headSort = (k: SortKey, label: string, cls = '') => (
    <button type="button" className={`thb ${cls} ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)} aria-pressed={sort === k}>
      {label}
    </button>
  );
  const chip = (on: boolean, onClick: () => void, label: string, n?: number, check = false) => (
    <button type="button" className={`fx-b ${check ? 'chk' : ''} ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      {label}{n !== undefined ? <sup>{n}</sup> : null}
    </button>
  );

  return (
    <div className="g body">
      {/* mobile: sticky filter bar */}
      <div className="fbar" role="toolbar" aria-label="絞り込みと並び順">
        <button type="button" className={`fbtn ${nActive ? 'act' : ''}`} aria-expanded={open} aria-controls="facets" onClick={() => setOpen(true)}>
          絞り込み{nActive ? <b>（{nActive}）</b> : null}
        </button>
        <label className="fsel">
          <span className="vh">並び順</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
          </select>
        </label>
        <p className="fcnt" aria-live="polite"><b>{visible.length}</b>/{total}</p>
      </div>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} aria-hidden />

      <aside id="facets" className={`facets ${open ? 'open' : ''}`} aria-label="絞り込み" role="dialog" aria-modal={open || undefined}>
        <div className="shead">
          <p>絞り込み{nActive ? `（${nActive}）` : ''}</p>
          <button type="button" className="sclose" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
        </div>
        <div className="sbody">
          <label className="search">
            <span className="vh">店名・駅名で検索</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="店名・駅名で検索" enterKeyHint="search" />
          </label>
          <h4>01 エリア</h4>
          <div className="fgroup">
            {chip(!ward, () => setWard(''), 'すべて')}
            {wards.map((w) => <span key={w.v} className="cw">{chip(ward === w.v, () => setWard(ward === w.v ? '' : w.v), w.v, w.n)}</span>)}
          </div>
          <h4>02 ジャンル</h4>
          <div className="fgroup">
            {chip(!genre, () => setGenre(''), 'すべて')}
            {genres.map((g) => <span key={g.v} className="cw">{chip(genre === g.v, () => setGenre(genre === g.v ? '' : g.v), g.v, g.n)}</span>)}
          </div>
          <h4>03 設備・特徴 <small>（すべて満たす）</small></h4>
          <div className="fgroup">
            {features.map((f) => <span key={f.v} className="cw">{chip(feats.includes(f.v), () => toggleFeat(f.v), f.label ?? f.v, f.n, true)}</span>)}
          </div>
          <div className="fsort">
            <h4>04 並び順</h4>
            <div className="fgroup">
              {SORTS.map((x) => <span key={x.v} className="cw">{chip(sort === x.v, () => setSort(x.v), x.label)}</span>)}
            </div>
          </div>
          <p className="cnt">
            <b>{visible.length}</b> / {total} 店を表示
            {nActive ? <button type="button" className="clear" onClick={clear}>条件をクリア</button> : null}
          </p>
        </div>
        <div className="sfoot">
          <button type="button" className="sclear" onClick={clear} disabled={!nActive}>クリア</button>
          <button type="button" className="sapply" onClick={() => setOpen(false)}>{visible.length}件を表示</button>
        </div>
      </aside>

      <main className="table">
        <div className="th" role="row">
          <span>No.</span>
          {headSort('name', '店名 Name')}
          <span>エリア</span>
          <span>ジャンル</span>
          {headSort('score', '食べログ', 'num')}
          {headSort(sort === 'priceAsc' ? 'priceDesc' : 'priceAsc', `予算${sort === 'priceAsc' ? ' ↑' : sort === 'priceDesc' ? ' ↓' : ''}`)}
          {FCOLS.map((c) => <span key={c.v} className="fx">{c.label}</span>)}
        </div>
        <ol className="rows">
          {visible.map((s, i) => {
            const fs = FCOLS.filter((c) => (s.feats ?? []).includes(c.v));
            return (
              <li key={s.id}>
                <Link className="tr" href={`/cafes/${s.id}/`}>
                  <span className="no">{String(i + 1).padStart(3, '0')}</span>
                  <span className="nm">{s.name}{s.station ? <small className="st">{s.station}</small> : null}</span>
                  <span className="wd">{s.ward}</span>
                  <span className="gn">{(s.genres ?? []).slice(0, 2).join('・')}</span>
                  <span className="num">{s.score ? s.score.toFixed(2) : '—'}</span>
                  <span className="pr">{s.price ?? '—'}</span>
                  {FCOLS.map((c) => (
                    <span key={c.v} className="fx" data-k={(s.feats ?? []).includes(c.v) ? c.v : undefined} aria-hidden>{(s.feats ?? []).includes(c.v) ? '●' : '–'}</span>
                  ))}
                  {fs.length ? <span className="fd">{fs.map((c) => <i key={c.v} data-k={c.v}>{c.label}</i>)}</span> : null}
                </Link>
              </li>
            );
          })}
        </ol>
        {!visible.length ? (
          <div className="empty">
            条件に合うカフェはありません。<button type="button" className="clear" onClick={clear}>条件をクリア</button>
          </div>
        ) : null}
        <p className="tnote">● = 掲載情報で確認できたもの。– は「なし」または「情報なし」。食べログ評価・予算は掲載時点。</p>
      </main>
    </div>
  );
}
