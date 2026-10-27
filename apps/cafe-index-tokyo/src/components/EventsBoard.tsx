'use client';

import { useState } from 'react';
import type { CafeEvent } from '@/lib/types';
import { EventRow } from './EventRow';

const GROUPS: { key: 'upcoming' | 'recurring' | 'past'; label: string; en: string }[] = [
  { key: 'upcoming', label: '開催予定', en: 'Upcoming' },
  { key: 'recurring', label: '定期開催', en: 'Recurring' },
  { key: 'past', label: '開催済み', en: 'Past' },
];

export default function EventsBoard({ groups, types }: { groups: Record<string, CafeEvent[]>; types: Record<string, string> }) {
  const [type, setType] = useState('');
  const present = Object.keys(types).filter((t) => Object.values(groups).some((g) => g.some((e) => e.type === t)));
  return (
    <>
      <div className="g evfilter">
        <p className="sh sm"><span>Filter</span>種類</p>
        <div className="evtabs" role="group" aria-label="イベントの種類">
          <button type="button" className={`fx-b ${!type ? 'on' : ''}`} onClick={() => setType('')}>
            すべて<sup>{Object.values(groups).flat().length}</sup>
          </button>
          {present.map((t) => (
            <button type="button" key={t} className={`fx-b ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>
              {types[t]}<sup>{Object.values(groups).flat().filter((e) => e.type === t).length}</sup>
            </button>
          ))}
        </div>
      </div>
      {GROUPS.map((g, i) => {
        const list = (groups[g.key] ?? []).filter((e) => !type || e.type === type);
        return (
          <section key={g.key} className="g evsec" id={g.key}>
            <h2 className="sh"><span>{String(i + 1).padStart(2, '0')} {g.en}</span>{g.label}<em>{list.length}</em></h2>
            <div className="etable">
              {list.length ? list.map((e) => <EventRow key={e.id} e={e} full />) : <p className="empty">該当するイベントはありません。</p>}
            </div>
          </section>
        );
      })}
    </>
  );
}
