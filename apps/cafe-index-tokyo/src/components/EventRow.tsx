import type { CafeEvent } from '@/lib/types';
import { confJa, jstParts } from '@/lib/format';

export function eventWhen(e: Pick<CafeEvent, 'starts_at' | 'date_text' | 'recurrence' | 'status'>) {
  const p = jstParts(e.starts_at);
  if (p) return { date: `${p.md}（${p.wd}）`, time: p.hm, year: p.y, mo: p.mo, d: p.d, wd: p.wd };
  return { date: e.date_text || e.recurrence || (e.status === 'recurring' ? '定期開催' : '日程未定'), time: '', year: '', mo: 0, d: 0, wd: '' };
}

/** One event as a row of the D index grid. `full` adds description/fee/organizer/sources. */
export function EventRow({ e, full = false }: { e: CafeEvent; full?: boolean }) {
  const w = eventWhen(e);
  const link = e.booking_url || e.sources?.[0];
  const srcs = (e.sources ?? []).filter((u) => u !== e.booking_url);
  return (
    <article className={`er ${full ? 'full' : ''} t-${e.type}`}>
      <span className={`ed ${w.d ? '' : 'nodate'}`}>
        {w.d ? (
          <>
            <span className="emo">{w.mo}月</span>
            <b className="eday">{w.d}</b>
            <span className="ewd">{w.wd}</span>
            <span className="edate">{w.date}</span>
          </>
        ) : <b className="etxt">{w.date}</b>}
        {w.time ? <span className="etm">{w.time}〜</span> : null}
        {e.recurrence && e.starts_at ? <span className="rec">{e.recurrence}</span> : null}
      </span>
      <span className="ety">{e.typeLabel ?? e.type}</span>
      <span className="et">
        {link ? <a href={link} target="_blank" rel="noopener noreferrer nofollow">{e.title}</a> : e.title}
      </span>
      <span className="ev">
        {e.venue_name}
        {e.venue_ward ? <small> ／ {e.venue_ward}</small> : null}
      </span>
      {full ? (
        <div className="emore">
          {e.description ? <p>{e.description}</p> : null}
          <p className="emeta">
            {e.fee_text ? <span>参加費 {e.fee_text}</span> : null}
            {e.organizer ? <span>主催 {e.organizer}</span> : null}
            {e.extra?.distance_km ? <span>距離 {String(e.extra.distance_km)}km</span> : null}
            {e.extra?.pace ? <span>ペース {String(e.extra.pace)}</span> : null}
            {e.confidence ? <span className={`conf conf-${e.confidence}`}>確度{confJa(e.confidence)}</span> : null}
            {link ? <a className="src" href={link} target="_blank" rel="noopener noreferrer nofollow">詳細・申込</a> : null}
            {srcs.map((u, i) => (
              <a key={u} className="src" href={u} target="_blank" rel="noopener noreferrer nofollow">出典{srcs.length > 1 ? i + 1 : ''}</a>
            ))}
          </p>
        </div>
      ) : null}
    </article>
  );
}
