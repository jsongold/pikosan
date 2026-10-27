import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import IndexTable from '@/components/IndexTable';
import { EventRow } from '@/components/EventRow';
import { getEvents, getIndex, getMeta } from '@/lib/data';
import { pad3 } from '@/lib/format';

export default async function Home() {
  const idx = await getIndex();
  const ev = await getEvents();
  const meta = await getMeta();
  const next = ev.groups.upcoming.slice(0, 5);
  const nWards = idx.facets.wards.length;
  return (
    <>
      <Header
        c2={<p>東京のカフェを<br />同じ項目で<br />索引する。</p>}
        c3={<p>{idx.total} cafés ・ {nWards} 区市<br />イベント {ev.total} 件<br />データ更新 {meta.exportedAt.slice(0, 10).replace(/-/g, '.')}</p>}
      />
      <section className="g big">
        <h1>
          <span className="n">{pad3(idx.total)}</span>
          <span className="t">Cafés,<br />indexed.</span>
          <span className="vh">東京のカフェ {idx.total} 店の索引</span>
        </h1>
      </section>
      <IndexTable shops={idx.shops} wards={idx.facets.wards} genres={idx.facets.genres} features={idx.facets.features} total={idx.total} />
      <section className="g evsec" id="events">
        <h2 className="sh"><span>05</span>Events イベント</h2>
        <div className="etable">
          {next.map((e) => <EventRow key={e.id} e={e} />)}
          <Link className="more" href="/events/">すべてのイベント（{ev.total}件）→</Link>
        </div>
      </section>
      <Footer />
    </>
  );
}
