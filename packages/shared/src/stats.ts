/** Statistics computed from real watch_history rows. Pure functions — unit tested. */
import { inRange, MONTHS, parseISODate, toISODate, type Range } from './dates';

export interface StatsInput {
  watched_on: string;
  rating: number | null;
  genres?: string[] | null;
  runtime?: number | null;
}

export interface Stats {
  total: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  averageRating: number | null;
  ratedCount: number;
  minutesWatched: number;
  genres: { genre: string; count: number }[];
  monthly: { label: string; key: string; count: number }[]; // last 12 months
  yearly: { label: string; count: number }[];
  daily: { label: string; key: string; count: number }[];   // current week / month days
  longestStreak: number;
  currentStreak: number;
}

export function filterByRange<T extends { watched_on: string }>(rows: T[], range: Range, now = new Date()): T[] {
  return rows.filter((r) => inRange(r.watched_on, range, now));
}

export function genreBreakdown(rows: StatsInput[]) {
  const counts = new Map<string, number>();
  for (const r of rows) for (const g of r.genres ?? []) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts.entries()].map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));
}

/** Longest + current run of consecutive calendar days with ≥1 watch. */
export function streaks(dates: string[], now = new Date()): { longest: number; current: number } {
  const days = [...new Set(dates.map((d) => d.slice(0, 10)))].sort();
  if (!days.length) return { longest: 0, current: 0 };
  let longest = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = parseISODate(days[i - 1]); prev.setDate(prev.getDate() + 1);
    run = toISODate(prev) === days[i] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  // current streak: ends today or yesterday
  const set = new Set(days);
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!set.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (set.has(toISODate(cursor))) { current++; cursor.setDate(cursor.getDate() - 1); }
  return { longest, current };
}

export function monthlyActivity(rows: StatsInput[], now = new Date(), months = 12) {
  const out: Stats['monthly'] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: `${MONTHS[d.getMonth()]}${d.getMonth() === 0 || i === months - 1 ? ` '${String(d.getFullYear()).slice(2)}` : ''}`, count: 0 });
  }
  const idx = new Map(out.map((o, i) => [o.key, i]));
  for (const r of rows) { const i = idx.get(r.watched_on.slice(0, 7)); if (i !== undefined) out[i].count++; }
  return out;
}

export function yearlyActivity(rows: StatsInput[]) {
  const counts = new Map<string, number>();
  for (const r of rows) { const y = r.watched_on.slice(0, 4); counts.set(y, (counts.get(y) ?? 0) + 1); }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => ({ label, count }));
}

/** Per-day counts for the current week (Mon–Sun) or month. */
export function dailyActivity(rows: StatsInput[], range: 'week' | 'month', now = new Date()) {
  const out: Stats['daily'] = [];
  if (range === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      out.push({ key: toISODate(d), label: names[i], count: 0 });
    }
  } else {
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= days; i++) {
      out.push({ key: toISODate(new Date(now.getFullYear(), now.getMonth(), i)), label: String(i), count: 0 });
    }
  }
  const idx = new Map(out.map((o, i) => [o.key, i]));
  for (const r of rows) { const i = idx.get(r.watched_on.slice(0, 10)); if (i !== undefined) out[i].count++; }
  return out;
}

export function computeStats(all: StatsInput[], range: Range = 'all', now = new Date()): Stats {
  const scoped = filterByRange(all, range, now);
  const rated = scoped.filter((r) => typeof r.rating === 'number');
  const { longest, current } = streaks(all.map((r) => r.watched_on), now);
  return {
    total: all.length,
    thisWeek: filterByRange(all, 'week', now).length,
    thisMonth: filterByRange(all, 'month', now).length,
    thisYear: filterByRange(all, 'year', now).length,
    averageRating: rated.length ? Math.round((rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) * 10) / 10 : null,
    ratedCount: rated.length,
    minutesWatched: scoped.reduce((s, r) => s + (r.runtime ?? 0), 0),
    genres: genreBreakdown(scoped),
    monthly: monthlyActivity(range === 'all' ? all : scoped, now),
    yearly: yearlyActivity(all),
    daily: dailyActivity(scoped, range === 'week' ? 'week' : 'month', now),
    longestStreak: longest,
    currentStreak: current,
  };
}

/** Group diary entries by "Month YYYY" for timeline views (input sorted desc). */
export function groupByMonth<T extends { watched_on: string }>(rows: T[]) {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const r of rows) {
    const d = parseISODate(r.watched_on);
    const key = r.watched_on.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, items: [] }; groups.push(g); }
    g.items.push(r);
  }
  return groups;
}

/** Build a month grid (weeks × 7, Monday first) with entries per day for calendar views. */
export function calendarMonth<T extends { watched_on: string }>(rows: T[], year: number, month0: number) {
  const first = new Date(year, month0, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month0 + 1, 0).getDate();
  const byDay = new Map<string, T[]>();
  for (const r of rows) {
    const k = r.watched_on.slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  const cells: ({ date: string; day: number; items: T[] } | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) {
    const date = toISODate(new Date(year, month0, d));
    cells.push({ date, day: d, items: byDay.get(date) ?? [] });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}
