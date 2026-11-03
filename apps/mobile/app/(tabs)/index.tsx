import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { colors, filterByRange, releaseYear, timeAgo } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { useAsync } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { Grid, MovieTile, QuickAddSheet } from '@/components/movies';
import { useToast } from '@/components/toast';
import { Avatar, Button, Card, Empty, ErrorText, Poster, PosterGridSkeleton, Screen, SectionHeader, Skeleton, Stars, T } from '@/components/ui';
import { GuestBanner } from '@/components/guest';

function Stat({ label, value, tint }: { label: string; value: number; tint: string }) {
  return <Card style={{ flex: 1, minWidth: '45%', gap: 4, borderColor: tint + '44' }}><T v="h1" style={{ fontSize: 26 }}>{value}</T><T v="small">{label}</T></Card>;
}

export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const { profile } = useSession();
  const [quick, setQuick] = useState(false);
  const core = useAsync(async () => { const [history, watchlist] = await Promise.all([api.diary.all(), api.watchlist.list()]); return { history, watchlist }; }, []);
  const social = useAsync(async () => { const [activity, recs] = await Promise.all([api.friends.activity(10), api.recommendations.received({ pendingOnly: true, limit: 8 })]); return { activity, recs }; }, []);
  const h = core.data?.history ?? []; const w = core.data?.watchlist ?? [];

  return (
    <Screen refresh={<RefreshControl tintColor={colors.amber} refreshing={core.refreshing} onRefresh={() => { core.reload('refresh'); social.reload('silent'); }} />}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View><T v="accent">Good to see you,</T>{profile ? <T v="h1">{profile.is_guest ? 'Guest' : `@${profile.username}`}</T> : <Skeleton h={30} w={160} />}</View>
        <Button small icon="add" title="Quick Add" onPress={() => setQuick(true)} />
      </View>
      {profile?.is_guest && <GuestBanner />}
      {core.error && <ErrorText msg={core.error} onRetry={() => core.reload()} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {core.loading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} h={80} w="47%" r={18} />) : <>
          <Stat label="Movies watched" value={h.length} tint={colors.amber} />
          <Stat label="In watchlist" value={w.length} tint={colors.lavender} />
          <Stat label="This month" value={filterByRange(h, 'month').length} tint={colors.success} />
          <Stat label="Recs waiting" value={social.data?.recs.length ?? 0} tint={colors.notify} />
        </>}
      </View>

      <SectionHeader title="Recently watched" action="See all" onAction={() => router.push('/(tabs)/diary')} />
      {core.loading ? <PosterGridSkeleton n={3} /> : !h.length ? <Empty icon="book-outline" title="Your diary is empty" body="Log a movie you've watched." action={<Button small title="Log a movie" onPress={() => setQuick(true)} />} />
        : <Grid>{h.slice(0, 6).map((e) => <MovieTile key={e.id} title={e.title} poster={e.poster_path} sub={e.watched_on} rating={e.rating} />)}</Grid>}

      <SectionHeader title="Added to watchlist" action="See all" onAction={() => router.push('/(tabs)/watchlist')} />
      {core.loading ? <PosterGridSkeleton n={3} /> : !w.length ? <Empty icon="bookmark-outline" title="Nothing queued up" body="Search and save movies for later." />
        : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {w.slice(0, 10).map((e) => <View key={e.id} style={{ width: 110 }}><Poster path={e.movie.poster_path} size="w185" /><T numberOfLines={1} style={{ fontSize: 13, marginTop: 6 }}>{e.movie.title}</T>
              {e.recommender && <T v="small" style={{ color: colors.lavender }} numberOfLines={1}>by @{e.recommender.username}</T>}</View>)}
          </ScrollView>}

      <SectionHeader title="Friends' activity" />
      {social.loading ? <Skeleton h={60} r={16} /> : !social.data?.activity.length ? <Empty icon="people-outline" title="It's quiet here" body="Add friends to see what they watch." action={<Button small variant="secondary" title="Find friends" onPress={() => router.push('/(tabs)/friends')} />} />
        : social.data.activity.map((a) => (
          <Pressable key={a.id} onPress={() => router.push(`/user/${a.user.username}`)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
              <Avatar url={a.user.avatar_url} name={a.user.username} size={36} />
              <View style={{ flex: 1 }}><T style={{ fontSize: 14 }}><T style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>@{a.user.username}</T> watched {a.title}</T>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>{a.rating ? <Stars value={a.rating} size={10} /> : null}<T v="small">{timeAgo(a.created_at)}</T></View></View>
              <Poster path={a.poster_path} size="w92" width={34} radius={6} />
            </Card>
          </Pressable>))}

      <SectionHeader title="Recommended by friends" />
      {social.loading ? <Skeleton h={60} r={16} /> : !social.data?.recs.length ? <Empty icon="gift-outline" title="No recommendations yet" body="Friends can recommend movies in chat." />
        : social.data.recs.map((r) => (
          <Card key={r.id} style={{ flexDirection: 'row', gap: 12, padding: 10, alignItems: 'center' }}>
            <Poster path={r.movie.poster_path} size="w154" width={50} radius={8} />
            <View style={{ flex: 1 }}><T style={{ fontFamily: 'Inter_600SemiBold' }}>{r.movie.title} <T v="muted">({releaseYear(r.movie.release_date)})</T></T>
              <T v="small" style={{ color: colors.lavender }}>from @{r.sender?.username}</T>{r.message ? <T v="small" numberOfLines={2}>“{r.message}”</T> : null}</View>
            <Button small icon="add" variant="secondary" onPress={async () => {
              try { const res = await api.watchlist.addFromRecommendation(r.id); toast(res.status === 'exists' ? 'Already in your watchlist' : `Added ${r.movie.title}`, res.status === 'exists' ? 'info' : 'success'); social.reload('silent'); core.reload('silent'); }
              catch (e) { toast((e as Error).message, 'error'); }
            }} />
          </Card>))}
      <QuickAddSheet visible={quick} onClose={() => setQuick(false)} onChanged={() => core.reload('silent')} />
    </Screen>
  );
}
