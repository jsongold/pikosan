import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import EventsBoard from '@/components/EventsBoard';
import { getEvents } from '@/lib/data';
import { pad3 } from '@/lib/format';

export const metadata: Metadata = {
  title: 'イベント — カフェラン・カフェ音楽イベント',
  description: '東京のカフェ発着ランニング（カフェラン）と、音楽喫茶・カフェでのライブ/DJイベントの一覧。開催予定・定期開催・開催済みを出典付きで掲載。',
  alternates: { canonical: '/events/' },
  openGraph: { url: '/events/', title: 'イベント | Café Index Tokyo' },
};

export default async function EventsPage() {
  const ev = await getEvents();
  const n = (t: string) => Object.values(ev.groups).flat().filter((e) => e.type === t).length;
  return (
    <>
      <Header
        c2={<p>カフェで走る、<br />カフェで聴く。</p>}
        c3={<p>{Object.entries(ev.types).filter(([t]) => n(t)).map(([t, l]) => `${l} ${n(t)}件`).join(' ・ ')}</p>}
      />
      <section className="g big">
        <h1>
          <span className="n">{pad3(ev.total)}</span>
          <span className="t">Events,<br />listed.</span>
          <span className="vh">カフェのイベント {ev.total} 件</span>
        </h1>
      </section>
      <EventsBoard groups={ev.groups} types={ev.types} />
      <Footer />
    </>
  );
}
