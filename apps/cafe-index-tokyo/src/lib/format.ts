import type { Conf, Value } from './types';

export const CONF_JA: Record<string, string> = { high: '高', medium: '中', low: '低' };
export const confJa = (c?: Conf) => (c ? CONF_JA[c] ?? c : '');
export const SENT_JA: Record<string, string> = { positive: '好評', mixed: '賛否', negative: '不満', neutral: '中立' };

export function fmt(v: Value | undefined): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? 'あり' : 'なし';
  if (Array.isArray(v)) return v.map((x) => fmt(x)).filter(Boolean).join('、');
  if (typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k}: ${fmt(x)}`).join('、');
  return String(v);
}
export const asList = (v: Value | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v.map((x) => fmt(x)).filter(Boolean) : String(v).split(/[、，,]/).map((s) => s.trim()).filter(Boolean);

export const isUrl = (s: string) => /^https?:\/\//.test(s);
export const pad3 = (n: number) => String(n).padStart(3, '0');
export const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

const WD = ['日', '月', '火', '水', '木', '金', '土'];
/** "2026-10-31T09:00:00+09:00" -> {md:"10/31", wd:"土", hm:"09:00"} without timezone drift (data is JST). */
export function jstParts(iso?: string) {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const wd = WD[new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay()];
  return { y, mo: +mo, d: +d, md: `${+mo}/${+d}`, wd, hm: h ? `${h}:${mi}` : '' };
}
export function hostOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}
