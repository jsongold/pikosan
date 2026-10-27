import Link from 'next/link';
import type { ReactNode } from 'react';

export function Header({ c2, c3, nav }: { c2?: ReactNode; c3?: ReactNode; nav?: ReactNode }) {
  return (
    <header className="g top">
      <Link className="logo" href="/" aria-label="Café Index Tokyo トップ">
        <span>Café</span> <span>Index</span> <span>Tokyo</span>
      </Link>
      <div className="c2">{c2}</div>
      <div className="c3">{c3}</div>
      <nav className="c4" aria-label="メイン">
        {nav ?? (
          <>
            <Link href="/">Index</Link>
            <Link href="/events/">Events</Link>
          </>
        )}
      </nav>
    </header>
  );
}
