import Link from 'next/link';
import { Header } from '@/components/Header';

export default function NotFound() {
  return (
    <>
      <Header c2={<p>ページが<br />見つかりません。</p>} />
      <section className="g big"><h1><span className="n">404</span><span className="t">Not<br />found.</span></h1></section>
      <p className="g" style={{ padding: '40px 32px' }}><Link href="/">← カフェ索引へ戻る</Link></p>
    </>
  );
}
