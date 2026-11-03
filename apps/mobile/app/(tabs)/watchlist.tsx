import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { colors, releaseYear, statusLabel, type WatchlistEntry, type WatchlistSort, type WatchlistStatus } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { useAsync } from '@/lib/hooks';
import { QuickAddSheet, WatchedSheet } from '@/components/movies';
import { useToast } from '@/components/toast';
import { Badge, Button, Chips, Empty, ErrorText, Field, Poster, PosterGridSkeleton, Sheet, T } from '@/components/ui';

type Filter = WatchlistStatus | 'all';

export default function Watchlist() {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<WatchlistSort>('recent');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<WatchlistEntry | null>(null);
  const [watching, setWatching] = useState<WatchlistEntry | null>(null);
  const { data, setData, loading, error, refreshing, reload } = useAsync(() => api.watchlist.list(), []);

  const items = useMemo(() => {
    let r = (data ?? []).filter((e) => filter === 'all' || e.status === filter);
    if (search.trim()) r = r.filter((e) => e.movie.title.toLowerCase().includes(search.trim().toLowerCase()));
    if (sort === 'title') r = [...r].sort((a, b) => a.movie.title.localeCompare(b.movie.title));
    if (sort === 'release') r = [...r].sort((a, b) => (b.movie.release_date ?? '').localeCompare(a.movie.release_date ?? ''));
    return r;
  }, [data, filter, search, sort]);

  async function setStatus(e: WatchlistEntry, status: WatchlistStatus) {
    const prev = data; setData((d) => d?.map((x) => (x.id === e.id ? { ...x, status } : x)) ?? null); setDetail(null);
    try { await api.watchlist.setStatus(e.id, status); } catch (err) { setData(prev ?? null); toast((err as Error).message, 'error'); }
  }
  function remove(e: WatchlistEntry) {
    Alert.alert('Remove from watchlist?', e.movie.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => {
      const prev = data; setData((d) => d?.filter((x) => x.id !== e.id) ?? null); setDetail(null);
      try { await api.watchlist.remove(e.id); } catch (err) { setData(prev ?? null); toast((err as Error).message, 'error'); }
    } }]);
  }

  const header = (
    <View style={{ gap: 12, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Field value={search} onChangeText={setSearch} placeholder="Filter your watchlist…" icon="search" /></View>
        <Button icon="add" onPress={() => setAdding(true)} style={{ width: 50, paddingHorizontal: 0 }} />
      </View>
      <Chips<Filter> value={filter} onChange={setFilter} options={[{ id: 'all', label: 'All' }, { id: 'want_to_watch', label: 'Want to Watch' }, { id: 'currently_watching', label: 'Watching' }]} />
      <Chips<WatchlistSort> value={sort} onChange={setSort} options={[{ id: 'recent', label: 'Recently added' }, { id: 'title', label: 'Title' }, { id: 'release', label: 'Release year' }]} />
      {error && <ErrorText msg={error} onRetry={() => reload()} />}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList data={loading ? [] : items} keyExtractor={(e) => e.id} numColumns={3} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        columnWrapperStyle={{ gap: 12 }} ItemSeparatorComponent={() => <View style={{ height: 16 }} />} ListHeaderComponent={header}
        refreshControl={<RefreshControl tintColor={colors.amber} refreshing={refreshing} onRefresh={() => reload('refresh')} />}
        initialNumToRender={12} windowSize={7} removeClippedSubviews
        ListEmptyComponent={loading ? <PosterGridSkeleton /> : data?.length ? <Empty icon="search" title="No matches" /> :
          <Empty icon="bookmark-outline" title="Your watchlist is empty" body="Search TMDB and save movies you want to see." action={<Button title="Add a movie" icon="add" onPress={() => setAdding(true)} />} />}
        renderItem={({ item: e }) => (
          <Pressable onPress={() => setDetail(e)} style={{ width: '31%', gap: 4 }}>
            <Poster path={e.movie.poster_path} size="w185" />
            {e.status === 'currently_watching' && <View style={{ position: 'absolute', top: 6, left: 6 }}><Badge text="Watching" tone="amber" /></View>}
            <T numberOfLines={1} style={{ fontSize: 13 }}>{e.movie.title}</T>
            <T v="small">{releaseYear(e.movie.release_date)}</T>
            {e.recommender && <T v="small" numberOfLines={1} style={{ color: colors.lavender }}>by @{e.recommender.username}</T>}
          </Pressable>
        )} />

      <Sheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.movie.title}>
        {detail && <>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Poster path={detail.movie.poster_path} size="w342" width={110} />
            <View style={{ flex: 1, gap: 6 }}>
              <T v="muted">{releaseYear(detail.movie.release_date)}{detail.movie.runtime ? ` · ${detail.movie.runtime} min` : ''}</T>
              <T v="small" style={{ color: colors.lavender }}>{detail.movie.genres.join(' · ')}</T>
              <Badge text={statusLabel(detail.status)} tone="amber" />
              {detail.recommender && <Badge text={`Recommended by @${detail.recommender.username}`} tone="lavender" />}
            </View>
          </View>
          <T style={{ lineHeight: 21 }}>{detail.movie.overview ?? 'No overview available.'}</T>
          <Button icon="eye-outline" title="Mark as Watched" onPress={() => { setWatching(detail); setDetail(null); }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button style={{ flex: 1 }} variant="secondary" small title={detail.status === 'want_to_watch' ? 'Start watching' : 'Back to Want to Watch'}
              onPress={() => setStatus(detail, detail.status === 'want_to_watch' ? 'currently_watching' : 'want_to_watch')} />
            <Button variant="danger" small icon="trash-outline" title="Remove" onPress={() => remove(detail)} />
          </View>
        </>}
      </Sheet>
      <WatchedSheet visible={!!watching} onClose={() => setWatching(null)} title={`Watched “${watching?.movie.title ?? ''}”`} submitLabel="Save to diary"
        onSubmit={async (v) => { await api.watchlist.markWatched(watching!.id, v); setData((d) => d?.filter((x) => x.id !== watching!.id) ?? null); toast(`${watching!.movie.title} moved to your diary`); }} />
      <QuickAddSheet visible={adding} onClose={() => setAdding(false)} onChanged={() => reload('silent')} />
    </View>
  );
}
