import { confJa } from '@/lib/format';

/** Source links + confidence badge for a stored value. Renders nothing if there is no source/confidence. */
export function Src({ urls, conf, label = '出典' }: { urls?: string[]; conf?: string; label?: string }) {
  const list = (urls ?? []).filter(Boolean);
  if (!list.length && !conf) return null;
  return (
    <span className="srcs">
      {conf ? <span className={`conf conf-${conf}`} title="確度（データの確からしさ）">確度{confJa(conf)}</span> : null}
      {list.slice(0, 3).map((u, i) => (
        <a key={u + i} className="src" href={u} target="_blank" rel="noopener noreferrer nofollow">
          {label}{list.length > 1 ? i + 1 : ''}
        </a>
      ))}
    </span>
  );
}
