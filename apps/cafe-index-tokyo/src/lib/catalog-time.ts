/** Format a timestamptz instant in Asia/Tokyo. Does not use the database TimeZone. */

const TOKYO = 'Asia/Tokyo';

function tokyoParts(value: string): { y: string; mo: string; d: string; h: string; mi: string; s: string } | null {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TOKYO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(dt);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return { y: get('year'), mo: get('month'), d: get('day'), h: hour, mi: get('minute'), s: get('second') };
}

/**
 * Wall time the static page can print as-is (it does not convert zones).
 * allDay → `YYYY-MM-DD` so the row has no `00:00〜`. Otherwise `YYYY-MM-DDTHH:mm:ss+09:00`.
 */
export function formatCatalogInstant(value: string | null | undefined, allDay: boolean): string | undefined {
  if (value == null || value === '') return undefined;
  if (allDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const p = tokyoParts(value);
  if (!p) return value;
  if (allDay) return `${p.y}-${p.mo}-${p.d}`;
  return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}:${p.s}+09:00`;
}

/** Tokyo calendar date for collected_at badges stored as timestamptz. */
export function formatCatalogDate(value: string | null | undefined): string | undefined {
  return formatCatalogInstant(value, true);
}
