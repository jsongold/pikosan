import Link from 'next/link';
import { ThemeSwitch } from './ThemeSwitch';
import { getMeta, SITE_NAME } from '@/lib/data';

export function Footer() {
  const m = getMeta();
  const d = m.exportedAt.slice(0, 10).replace(/-/g, '.');
  return (
    <footer className="g ft">
      <span className="logo s">{SITE_NAME}</span>
      <div className="credit">
        <p>
          データ出典：食べログ・各店公式サイト・イベント主催者ページほか（各項目の「出典」リンク参照）。
          「確度」は収集時に付けたデータの確からしさ（高・中・低）です。口コミ要約・味や雰囲気の軸は、公開情報をもとにした独自の要約・推定です。
        </p>
        <p>メニュー名は食べログ英語版の表記をそのまま掲載しているものがあり、機械翻訳の可能性があります。価格・営業時間は掲載時点の情報です。来店前に公式情報をご確認ください。</p>
        <p className="ftmeta">
          データ更新 {d} JST ・ {m.shops}店 ・ メニュー{m.menuItems}品 ・ 口コミ要約{m.reviews}件 ・ イベント{m.events}件
        </p>
        <ThemeSwitch />
      </div>
      <nav className="ftnav">
        <Link href="/">Index</Link>
        <Link href="/events/">Events</Link>
      </nav>
    </footer>
  );
}
