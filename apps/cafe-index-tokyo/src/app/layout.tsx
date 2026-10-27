import type { Metadata, Viewport } from 'next';
import { Inter_Tight, Noto_Sans_JP, Cormorant_Garamond, Shippori_Mincho, Zen_Kaku_Gothic_New, Zen_Maru_Gothic, Noto_Serif_JP, Marcellus, Fraunces } from 'next/font/google';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';
import './themes.css';

const inter = Inter_Tight({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--f-latin', display: 'swap' });
const noto = Noto_Sans_JP({ weight: ['400', '500', '700', '900'], variable: '--f-ja', display: 'swap', preload: false });

// Theme fonts (only downloaded by the browser when a theme that uses them is active)
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--f-cormorant', display: 'swap', preload: false });
const shippori = Shippori_Mincho({ weight: ['500', '700'], variable: '--f-shippori', display: 'swap', preload: false });
const zenkaku = Zen_Kaku_Gothic_New({ weight: ['400', '500', '700'], variable: '--f-zenkaku', display: 'swap', preload: false });
const zenmaru = Zen_Maru_Gothic({ weight: ['400', '500', '700'], variable: '--f-zenmaru', display: 'swap', preload: false });
const notoserif = Noto_Serif_JP({ weight: ['400', '500', '600'], variable: '--f-notoserif', display: 'swap', preload: false });
const marcellus = Marcellus({ subsets: ['latin'], weight: '400', variable: '--f-marcellus', display: 'swap', preload: false });
const fraunces = Fraunces({ subsets: ['latin'], axes: ['SOFT', 'opsz'], variable: '--f-fraunces', display: 'swap', preload: false });
const FONT_VARS = [inter, noto, cormorant, shippori, zenkaku, zenmaru, notoserif, marcellus, fraunces].map((f) => f.variable).join(' ');
// Default theme: Sage & Cream (data-theme="sage" is baked into the static HTML, so no JS/query is needed).
// Comparison only: ?theme=d|blush|sage|latte|lilac (d = original design D; persisted in localStorage); ?theme= resets to the default.
// The footer theme switcher is hidden unless a ?theme= override is present/persisted (html[data-thsw]).
const THEME_JS = `try{var q=new URLSearchParams(location.search).get('theme'),k='ci-theme',h=document.documentElement,t;if(q!==null){if(q)localStorage.setItem(k,q);else localStorage.removeItem(k);t=q}else t=localStorage.getItem(k);if(t==='d')h.removeAttribute('data-theme');else if(/^(blush|sage|latte|lilac)$/.test(t||''))h.setAttribute('data-theme',t);if(q!==null||t)h.setAttribute('data-thsw','')}catch(e){}`;

const DESC = '東京のカフェ・喫茶店を、同じ項目で索引する。エリア・ジャンル・設備で絞り込み、味や雰囲気の軸、口コミ要約、メニュー、カフェランや音楽イベントまで。すべての情報に出典付き。';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — 東京のカフェ索引`, template: `%s | ${SITE_NAME}` },
  description: DESC,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'ja_JP', title: `${SITE_NAME} — 東京のカフェ索引`, description: DESC, url: '/' },
  twitter: { card: 'summary', title: SITE_NAME, description: DESC },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: '#f7f5ec', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={FONT_VARS} data-theme="sage" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_JS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
