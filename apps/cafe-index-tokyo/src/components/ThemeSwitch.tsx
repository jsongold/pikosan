'use client';
import { useEffect, useState } from 'react';

export const THEMES: { v: string; label: string }[] = [
  { v: 'd', label: 'D' },
  { v: 'blush', label: '1 Blush' },
  { v: 'sage', label: '2 Sage (既定)' },
  { v: 'latte', label: '3 Latte' },
  { v: 'lilac', label: '4 Lilac' },
];

export function ThemeSwitch() {
  const [cur, setCur] = useState('sage');
  useEffect(() => setCur(document.documentElement.getAttribute('data-theme') ?? 'd'), []);
  const pick = (v: string) => {
    const h = document.documentElement;
    if (v === 'd') h.removeAttribute('data-theme'); else h.setAttribute('data-theme', v);
    try { localStorage.setItem('ci-theme', v); } catch {}
    setCur(v);
  };
  return (
    <div className="thsw" role="group" aria-label="テーマ">
      <span>テーマ</span>
      {THEMES.map((t) => (
        <button key={t.v} type="button" aria-pressed={cur === t.v} className={cur === t.v ? 'on' : ''} onClick={() => pick(t.v)}>{t.label}</button>
      ))}
    </div>
  );
}
