'use client';
import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from 'recharts';
import { BarChart3, CalendarDays, Clock, Flame, Star, Trophy } from 'lucide-react';
import { colors, computeStats, type Range } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '@/components/ui';
import Link from 'next/link';

const PIE = [colors.amber, colors.lavender, colors.success, colors.notify, '#5FA8D3', '#E9C46A', '#8D99AE'];
const tip = { contentStyle: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, color: colors.text }, cursor: { fill: 'rgba(255,255,255,.04)' } };

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-4">
      <div className="flex items-center gap-2 text-xs text-ink-muted"><Icon className="h-4 w-4 text-amber" />{label}</div>
      <p className="mt-2 font-heading text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-line bg-surface/60 p-5"><h3 className="mb-4 font-heading font-semibold">{title}</h3>{children}</section>;
}

export default function StatsPage() {
  const api = getApi();
  const [range, setRange] = useState<Range>('all');
  const { data, error, loading, reload } = useAsync(() => api.diary.all(), []);
  const s = useMemo(() => computeStats((data ?? []).map((e) => ({ watched_on: e.watched_on, rating: e.rating, genres: e.movie?.genres, runtime: e.movie?.runtime })), range), [data, range]);
  const scopedCount = range === 'all' ? s.total : range === 'week' ? s.thisWeek : range === 'month' ? s.thisMonth : s.thisYear;

  return (
    <div>
      <PageHeader title="Statistics" subtitle="Calculated live from your diary." action={
        <Tabs<Range> value={range} onChange={setRange} tabs={[{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }, { id: 'all', label: 'All time' }]} />} />
      {error && <ErrorState message={error} onRetry={() => reload()} />}
      {loading ? <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
        : !data?.length ? <EmptyState icon={<BarChart3 className="h-7 w-7" />} title="No stats yet" body="Your charts appear once you've logged a few movies." action={<Link href="/watchlist"><Button>Go to watchlist</Button></Link>} />
        : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi icon={Trophy} label="Total watched" value={s.total} />
            <Kpi icon={CalendarDays} label="This week" value={s.thisWeek} />
            <Kpi icon={CalendarDays} label="This month" value={s.thisMonth} />
            <Kpi icon={CalendarDays} label="This year" value={s.thisYear} />
            <Kpi icon={Star} label="Avg rating" value={s.averageRating ?? '—'} sub={`${s.ratedCount} rated${range !== 'all' ? ' in range' : ''}`} />
            <Kpi icon={Flame} label="Longest streak" value={`${s.longestStreak}d`} sub={`current ${s.currentStreak}d`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Card title={range === 'week' ? 'This week, day by day' : range === 'month' ? 'This month, day by day' : 'Monthly activity (last 12 months)'}>
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={range === 'week' || range === 'month' ? s.daily : s.monthly}>
                      <XAxis dataKey="label" stroke={colors.textMuted} fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} stroke={colors.textMuted} fontSize={11} tickLine={false} axisLine={false} width={28} />
                      <Tooltip {...tip} formatter={(v) => [v, 'Movies']} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} fill={colors.amber} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card title="Most-watched genres">
                {s.genres.length === 0 ? <p className="py-16 text-center text-sm text-ink-muted">No genre data in this range.</p> : (
                  <div className="flex items-center gap-4">
                    <div className="h-48 w-48 shrink-0">
                      <ResponsiveContainer>
                        <PieChart><Pie data={s.genres.slice(0, 7)} dataKey="count" nameKey="genre" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">
                          {s.genres.slice(0, 7).map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                        </Pie><Tooltip {...tip} /></PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                      {s.genres.slice(0, 7).map((g, i) => (
                        <li key={g.genre} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE[i % PIE.length] }} />
                          <span className="truncate">{g.genre}</span><span className="ml-auto text-ink-muted">{g.count}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Yearly activity">
              <div className="h-56">
                <ResponsiveContainer>
                  <AreaChart data={s.yearly}>
                    <defs><linearGradient id="lav" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors.lavender} stopOpacity={0.5} /><stop offset="100%" stopColor={colors.lavender} stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="label" stroke={colors.textMuted} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke={colors.textMuted} fontSize={11} tickLine={false} axisLine={false} width={28} />
                    <Tooltip {...tip} formatter={(v) => [v, 'Movies']} />
                    <Area type="monotone" dataKey="count" stroke={colors.lavender} strokeWidth={2} fill="url(#lav)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="In this range">
              <div className="grid grid-cols-2 gap-3">
                <Kpi icon={Trophy} label="Movies" value={scopedCount} />
                <Kpi icon={Clock} label="Time watched" value={`${Math.floor(s.minutesWatched / 60)}h ${s.minutesWatched % 60}m`} />
                <Kpi icon={Star} label="Average rating" value={s.averageRating ? `${s.averageRating} / 5` : '—'} />
                <Kpi icon={BarChart3} label="Top genre" value={s.genres[0]?.genre ?? '—'} />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
