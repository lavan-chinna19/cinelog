import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { colors, computeStats, type Range } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { useAsync } from '@/lib/hooks';
import { BarChart } from '@/components/movies';
import { Card, Chips, Empty, ErrorText, Screen, Skeleton, T } from '@/components/ui';

const PALETTE = [colors.amber, colors.lavender, colors.success, colors.notify, '#5FA8D3', '#E9C46A'];
function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <Card style={{ width: '48%', gap: 2 }}><T v="small">{label}</T><T v="h1" style={{ fontSize: 24 }}>{value}</T>{sub ? <T v="small">{sub}</T> : null}</Card>;
}

export default function Stats() {
  const [range, setRange] = useState<Range>('all');
  const { data, loading, error, refreshing, reload } = useAsync(() => api.diary.all(), []);
  const s = useMemo(() => computeStats((data ?? []).map((e) => ({ watched_on: e.watched_on, rating: e.rating, genres: e.movie?.genres, runtime: e.movie?.runtime })), range), [data, range]);
  const maxG = Math.max(1, ...s.genres.map((g) => g.count));

  return (
    <Screen refresh={<RefreshControl tintColor={colors.amber} refreshing={refreshing} onRefresh={() => reload('refresh')} />}>
      <Chips<Range> value={range} onChange={setRange} options={[{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }, { id: 'all', label: 'All time' }]} />
      {error && <ErrorText msg={error} onRetry={() => reload()} />}
      {loading ? <><Skeleton h={90} r={18} /><Skeleton h={200} r={18} /></> : !data?.length ? <Empty icon="stats-chart-outline" title="No stats yet" body="Log a few movies and your charts appear here." /> : <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
          <Kpi label="Total watched" value={s.total} />
          <Kpi label="This week" value={s.thisWeek} />
          <Kpi label="This month" value={s.thisMonth} />
          <Kpi label="This year" value={s.thisYear} />
          <Kpi label="Average rating" value={s.averageRating ?? '—'} sub={`${s.ratedCount} rated`} />
          <Kpi label="Longest streak" value={`${s.longestStreak} days`} sub={`current ${s.currentStreak}`} />
        </View>
        <Card style={{ gap: 8 }}>
          <T v="h3">{range === 'week' ? 'This week' : range === 'month' ? 'This month' : 'Monthly activity'}</T>
          <BarChart data={range === 'week' || range === 'month' ? s.daily : s.monthly} />
        </Card>
        <Card style={{ gap: 8 }}><T v="h3">Yearly activity</T><BarChart data={s.yearly} color={colors.lavender} height={120} /></Card>
        <Card style={{ gap: 10 }}>
          <T v="h3">Most-watched genres</T>
          {!s.genres.length ? <T v="muted">No genre data in this range.</T> : s.genres.slice(0, 6).map((g, i) => (
            <View key={g.genre} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontSize: 14 }}>{g.genre}</T><T v="muted">{g.count}</T></View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised }}><View style={{ height: 8, borderRadius: 4, width: `${(g.count / maxG) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }} /></View>
            </View>))}
        </Card>
        <Card><T v="muted">Time watched in range: <T style={{ color: colors.text }}>{Math.floor(s.minutesWatched / 60)}h {s.minutesWatched % 60}m</T></T></Card>
      </>}
    </Screen>
  );
}
