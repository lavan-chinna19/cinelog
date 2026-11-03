/** Date helpers. Diary dates are calendar dates (YYYY-MM-DD) in the user's local time. */
export type Range = 'week' | 'month' | 'year' | 'all';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO(now = new Date()): string { return toISODate(now); }

/** Parse YYYY-MM-DD as a LOCAL date (avoids UTC off-by-one). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Start of the range containing `now` (weeks start Monday). */
export function rangeStart(range: Range, now = new Date()): Date | null {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'week') { const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d; }
  if (range === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  if (range === 'year') return new Date(d.getFullYear(), 0, 1);
  return null;
}

export function inRange(isoDate: string, range: Range, now = new Date()): boolean {
  const start = rangeStart(range, now);
  if (!start) return true;
  const d = parseISODate(isoDate);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return d >= start && d < end;
}

export function inMonth(isoDate: string, year: number, month1to12: number): boolean {
  return isoDate.startsWith(`${year}-${pad(month1to12)}`);
}

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatDate(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function timeAgo(ts: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(ts).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(ts).toLocaleDateString();
}

export function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Online = seen in the last 2 minutes (fallback when Presence is unavailable). */
export function isRecentlyOnline(lastSeen: string | null, now = Date.now()): boolean {
  return !!lastSeen && now - new Date(lastSeen).getTime() < 120_000;
}

export function releaseYear(date: string | null | undefined): string {
  return date ? date.slice(0, 4) : '—';
}
