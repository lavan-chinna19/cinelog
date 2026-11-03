import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { calendarMonth, colors, filterByRange, formatDate, groupByMonth, inMonth, MONTHS, type DiaryEntry, type Range } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { useAsync } from '@/lib/hooks';
import { QuickAddSheet, WatchedSheet } from '@/components/movies';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Chips, Empty, ErrorText, Field, Poster, PosterGridSkeleton, Sheet, Stars, T } from '@/components/ui';

type Scope = Range | 'custom';
type View_ = 'timeline' | 'calendar';

export default function Diary() {
  const toast = useToast();
  const now = new Date();
  const [scope, setScope] = useState<Scope>('all');
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [search, setSearch] = useState('');
  const [asc, setAsc] = useState(false);
  const [view, setView] = useState<View_>('timeline');
  const [open, setOpen] = useState<DiaryEntry | null>(null);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [rewatch, setRewatch] = useState<DiaryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const { data, setData, loading, error, refreshing, reload } = useAsync(() => api.diary.all(), []);

  const filtered = useMemo(() => {
    let r = data ?? [];
    r = scope === 'custom' ? r.filter((e) => inMonth(e.watched_on, ym.y, ym.m + 1)) : filterByRange(r, scope);
    if (search.trim()) r = r.filter((e) => e.title.toLowerCase().includes(search.trim().toLowerCase()));
    return asc ? [...r].reverse() : r;
  }, [data, scope, ym, search, asc]);

  const shiftMonth = (d: number) => setYm(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });
  const groups = groupByMonth(filtered);
  const cells = calendarMonth(data ?? [], ym.y, ym.m);

  function remove(e: DiaryEntry) {
    Alert.alert('Delete this viewing?', e.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api.diary.remove(e.id); setData((d) => d?.filter((x) => x.id !== e.id) ?? null); setOpen(null); } catch (err) { toast((err as Error).message, 'error'); }
    } }]);
  }

  const header = (
    <View style={{ gap: 12, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field value={search} onChangeText={setSearch} placeholder="Search your diary…" icon="search" /></View>
        <Button variant="secondary" icon={asc ? 'arrow-up' : 'arrow-down'} onPress={() => setAsc(!asc)} style={{ width: 50, paddingHorizontal: 0 }} />
        <Button variant="secondary" icon={view === 'timeline' ? 'calendar-outline' : 'list-outline'} onPress={() => setView(view === 'timeline' ? 'calendar' : 'timeline')} style={{ width: 50, paddingHorizontal: 0 }} />
        <Button icon="add" onPress={() => setAdding(true)} style={{ width: 50, paddingHorizontal: 0 }} />
      </View>
      {view === 'timeline' && <Chips<Scope> value={scope} onChange={setScope} options={[{ id: 'all', label: 'All' }, { id: 'week', label: 'This week' }, { id: 'month', label: 'This month' }, { id: 'year', label: 'This year' }, { id: 'custom', label: 'Pick month' }]} />}
      {(scope === 'custom' || view === 'calendar') && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button small variant="ghost" icon="chevron-back" onPress={() => shiftMonth(-1)} />
          <T v="h3">{MONTHS[ym.m]} {ym.y}</T>
          <Button small variant="ghost" icon="chevron-forward" onPress={() => shiftMonth(1)} />
        </View>
      )}
      {error && <ErrorText msg={error} onRetry={() => reload()} />}
      {view === 'calendar' && !loading && (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row' }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <T key={i} v="small" style={{ flex: 1, textAlign: 'center' }}>{d}</T>)}</View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((c, i) => (
              <Pressable key={i} disabled={!c?.items.length} onPress={() => c?.items[0] && setOpen(c.items[0])} style={{ width: `${100 / 7}%`, padding: 2 }}>
                {c ? <View style={{ aspectRatio: 2 / 3, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: c.items.length ? colors.amber : colors.border }}>
                  {c.items[0] && <Poster path={c.items[0].poster_path} size="w92" radius={0} />}
                  <T v="small" style={{ position: 'absolute', top: 2, left: 3, fontSize: 9, color: c.items.length ? colors.amber : colors.textMuted }}>{c.day}</T>
                </View> : null}
              </Pressable>
            ))}
          </View>
        </Card>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList data={loading || view === 'calendar' ? [] : groups} keyExtractor={(g) => g.key} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={header} refreshControl={<RefreshControl tintColor={colors.amber} refreshing={refreshing} onRefresh={() => reload('refresh')} />}
        ListEmptyComponent={view === 'calendar' ? null : loading ? <PosterGridSkeleton /> : data?.length ? <Empty icon="search" title="Nothing in this period" />
          : <Empty icon="book-outline" title="Start your movie diary" body="Mark a watchlist movie as watched, or log one." action={<Button title="Log a movie" onPress={() => setAdding(true)} />} />}
        renderItem={({ item: g }) => (
          <View style={{ marginBottom: 18, gap: 10 }}>
            <T v="small" style={{ color: colors.lavender, letterSpacing: 1.2, fontFamily: 'Inter_600SemiBold' }}>{g.label.toUpperCase()} · {g.items.length}</T>
            {g.items.map((e) => (
              <Pressable key={e.id} onPress={() => setOpen(e)}>
                <Card style={{ flexDirection: 'row', gap: 12, padding: 10 }}>
                  <Poster path={e.poster_path} size="w154" width={54} radius={8} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <T style={{ fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>{e.title}</T>
                    <T v="small">{formatDate(e.watched_on)}</T>
                    {e.rating ? <Stars value={e.rating} size={12} /> : null}
                    {e.note ? <T v="small" numberOfLines={2} style={{ fontStyle: 'italic' }}>“{e.note}”</T> : null}
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )} />

      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open?.title}>
        {open && <>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Poster path={open.poster_path} size="w342" width={100} />
            <View style={{ flex: 1, gap: 6 }}>
              <T v="muted">Watched {formatDate(open.watched_on)}</T>
              <Stars value={open.rating} size={20} />
              {(data ?? []).filter((x) => x.movie_id === open.movie_id).length > 1 && <Badge text={`Seen ${(data ?? []).filter((x) => x.movie_id === open.movie_id).length}×`} tone="amber" />}
              {open.recommender && <Badge text={`Recommended by @${open.recommender.username}`} tone="lavender" />}
            </View>
          </View>
          <Card style={{ backgroundColor: colors.bg }}><T style={{ lineHeight: 21 }}>{open.note || 'No note for this viewing.'}</T></Card>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button style={{ flex: 1 }} small variant="secondary" icon="create-outline" title="Edit" onPress={() => { setEditing(open); setOpen(null); }} />
            <Button style={{ flex: 1 }} small variant="lavender" icon="refresh" title="Rewatch" onPress={() => { setRewatch(open); setOpen(null); }} />
            <Button small variant="danger" icon="trash-outline" onPress={() => remove(open)} />
          </View>
        </>}
      </Sheet>
      <WatchedSheet visible={!!editing} onClose={() => setEditing(null)} title={`Edit “${editing?.title ?? ''}”`}
        initial={editing ? { watched_on: editing.watched_on, rating: editing.rating, note: editing.note ?? '' } : undefined}
        onSubmit={async (v) => { await api.diary.update(editing!.id, { watched_on: v.watched_on, rating: v.rating, note: v.note.trim() || null }); toast('Entry updated'); reload('silent'); }} />
      <WatchedSheet visible={!!rewatch} onClose={() => setRewatch(null)} title={`Rewatch “${rewatch?.title ?? ''}”`} submitLabel="Add viewing"
        onSubmit={async (v) => { await api.diary.rewatch(rewatch!, v); toast('Rewatch logged'); reload('silent'); }} />
      <QuickAddSheet visible={adding} onClose={() => setAdding(false)} onChanged={() => reload('silent')} />
    </View>
  );
}
