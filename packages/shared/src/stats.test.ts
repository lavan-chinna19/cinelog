import { describe, expect, it } from 'vitest';
import { calendarMonth, computeStats, groupByMonth, streaks } from './stats';
import { inRange, parseISODate, rangeStart } from './dates';
import { validatePassword, validateUsername } from './validation';
import { posterUrl } from './tmdb';
import { notificationText } from './api';

const NOW = new Date(2026, 10, 3, 12); // Tue 3 Nov 2026

const rows = [
  { watched_on: '2026-11-03', rating: 5, genres: ['Drama', 'Science Fiction'], runtime: 169 },
  { watched_on: '2026-11-02', rating: 4, genres: ['Drama'], runtime: 120 },
  { watched_on: '2026-11-01', rating: null, genres: ['Comedy'], runtime: 95 },  // Sunday → last week
  { watched_on: '2026-10-15', rating: 3, genres: ['Drama'], runtime: 100 },
  { watched_on: '2026-10-14', rating: 2, genres: ['Horror'], runtime: 90 },
  { watched_on: '2026-10-13', rating: 4, genres: ['Horror'], runtime: 90 },
  { watched_on: '2026-10-12', rating: 4, genres: ['Horror'], runtime: 90 },
  { watched_on: '2025-12-31', rating: 5, genres: ['Drama'], runtime: 110 },
];

describe('date ranges', () => {
  it('weeks start on Monday', () => {
    expect(rangeStart('week', NOW)!.getDate()).toBe(2);
    expect(inRange('2026-11-01', 'week', NOW)).toBe(false);
    expect(inRange('2026-11-02', 'week', NOW)).toBe(true);
  });
  it('parses dates as local calendar days', () => {
    expect(parseISODate('2026-01-01').getDate()).toBe(1);
  });
  it('excludes future dates', () => expect(inRange('2026-11-05', 'month', NOW)).toBe(false));
});

describe('computeStats', () => {
  const s = computeStats(rows, 'all', NOW);
  it('counts by period', () => {
    expect(s.total).toBe(8);
    expect(s.thisWeek).toBe(2);
    expect(s.thisMonth).toBe(3);
    expect(s.thisYear).toBe(7);
  });
  it('averages only rated entries', () => {
    expect(s.ratedCount).toBe(7);
    expect(s.averageRating).toBe(3.9);
  });
  it('ranks genres', () => {
    expect(s.genres[0]).toEqual({ genre: 'Drama', count: 4 });
    expect(s.genres[1]).toEqual({ genre: 'Horror', count: 3 });
  });
  it('builds 12 months of activity ending this month', () => {
    expect(s.monthly).toHaveLength(12);
    expect(s.monthly[11]).toMatchObject({ key: '2026-11', count: 3 });
    expect(s.monthly[10]).toMatchObject({ key: '2026-10', count: 4 });
  });
  it('builds yearly activity', () => {
    expect(s.yearly).toEqual([{ label: '2025', count: 1 }, { label: '2026', count: 7 }]);
  });
  it('scopes genre stats to the range', () => {
    const w = computeStats(rows, 'week', NOW);
    expect(w.genres.map((g) => g.genre)).toEqual(['Drama', 'Science Fiction']);
    expect(w.daily).toHaveLength(7);
    expect(w.daily[0]).toMatchObject({ label: 'Mon', count: 1 });
    expect(w.minutesWatched).toBe(289);
  });
  it('handles an empty diary', () => {
    const e = computeStats([], 'all', NOW);
    expect(e).toMatchObject({ total: 0, averageRating: null, longestStreak: 0, currentStreak: 0 });
  });
});

describe('streaks', () => {
  it('finds longest and current runs', () => {
    expect(streaks(rows.map((r) => r.watched_on), NOW)).toEqual({ longest: 4, current: 3 });
  });
  it('counts multiple watches on one day once', () => {
    expect(streaks(['2026-11-03', '2026-11-03', '2026-11-02'], NOW)).toEqual({ longest: 2, current: 2 });
  });
  it('current streak survives until the day ends', () => {
    expect(streaks(['2026-11-02', '2026-11-01'], NOW).current).toBe(2);
    expect(streaks(['2026-10-30'], NOW).current).toBe(0);
  });
  it('crosses month and year boundaries', () => {
    expect(streaks(['2025-12-31', '2026-01-01', '2026-01-02'], NOW).longest).toBe(3);
  });
});

describe('timeline + calendar', () => {
  it('groups by month in order', () => {
    const g = groupByMonth(rows);
    expect(g.map((x) => x.label)).toEqual(['Nov 2026', 'Oct 2026', 'Dec 2025']);
  });
  it('lays out a Monday-first grid', () => {
    const cells = calendarMonth(rows, 2026, 10); // Nov 2026 starts on Sunday
    expect(cells.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(cells[6]?.day).toBe(1);
    expect(cells.length % 7).toBe(0);
    expect(cells.find((c) => c?.date === '2026-11-03')?.items).toHaveLength(1);
  });
});

describe('validation + helpers', () => {
  it('validates usernames', () => {
    expect(validateUsername('ok_name1')).toBeNull();
    expect(validateUsername('no spaces')).not.toBeNull();
    expect(validateUsername('ab')).not.toBeNull();
  });
  it('validates passwords', () => {
    expect(validatePassword('short1')).not.toBeNull();
    expect(validatePassword('longenough')).not.toBeNull();
    expect(validatePassword('longenough1')).toBeNull();
  });
  it('builds poster urls', () => {
    expect(posterUrl('/x.jpg', 'w185')).toBe('https://image.tmdb.org/t/p/w185/x.jpg');
    expect(posterUrl(null)).toBeNull();
  });
  it('words notifications', () => {
    expect(notificationText({ type: 'recommendation', actor: { id: '1', username: 'ben', avatar_url: null }, data: { title: 'Heat' } } as any))
      .toBe('@ben recommended Heat');
  });
});
