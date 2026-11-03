import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { colors, formatDate, type Profile } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { useAsync } from '@/lib/hooks';
import { Grid, MovieTile } from './movies';
import { useToast } from './toast';
import { Avatar, Badge, Button, Card, Empty, PosterGridSkeleton, Screen, T } from './ui';

const PRIVACY = { public: 'Public', friends: 'Friends only', private: 'Private' };

export function ProfileView({ profile, isMe }: { profile: Profile; isMe: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const summary = useAsync(() => api.profiles.summary(profile.id), [profile.id]);
  const s = summary.data;
  const recent = useAsync(async () => (s?.can_view_activity || isMe ? (await api.diary.page({ userId: profile.id, pageSize: 9 })).items : []), [profile.id, s?.can_view_activity]);
  async function act(fn: () => Promise<unknown>, msg: string) { setBusy(true); try { await fn(); toast(msg); summary.reload('silent'); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); } }
  const f = s?.friendship;

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 22 }}>
        <Avatar url={profile.avatar_url} name={profile.username} size={96} />
        <T v="h1" style={{ fontSize: 24 }}>@{profile.username}</T>
        {profile.display_name ? <T v="accent">{profile.display_name}</T> : null}
        <Badge text={PRIVACY[profile.privacy]} />
        <T v="muted" style={{ textAlign: 'center' }}>{profile.bio || (isMe ? 'Add a bio in settings.' : 'No bio yet.')}</T>
        {s?.favourite_genres?.length ? <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>{s.favourite_genres.map((g) => <Badge key={g} text={g} tone="lavender" />)}</View> : null}
        <View style={{ flexDirection: 'row', width: '100%', marginTop: 10, borderTopWidth: 1, borderColor: colors.border, paddingTop: 14 }}>
          {([['Watched', s?.watched_count], ['Watchlist', s?.watchlist_count], ['Friends', s?.friends_count]] as const).map(([l, v]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }}><T v="h2">{v ?? (s ? '—' : '…')}</T><T v="small">{l}</T></View>))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {isMe ? <Button small variant="secondary" icon="create-outline" title="Edit profile" onPress={() => router.push('/settings')} />
            : !s ? null
            : f?.status === 'accepted' ? <>
                <Button small icon="chatbubble-outline" title="Message" onPress={async () => router.push(`/chat/${await api.messages.open(profile.id)}`)} />
                <Button small variant="ghost" icon="person-remove-outline" onPress={() => Alert.alert('Remove friend?', '', [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: () => act(() => api.friends.remove(f.id), 'Friend removed') }])} />
              </>
            : f?.direction === 'incoming' ? <Button small title="Accept request" loading={busy} onPress={() => act(() => api.friends.respond(f.id, true), 'Friend added')} />
            : f?.direction === 'outgoing' ? <Button small variant="secondary" title="Requested · Cancel" loading={busy} onPress={() => act(() => api.friends.remove(f.id), 'Request cancelled')} />
            : <Button small icon="person-add-outline" title="Add friend" loading={busy} onPress={() => act(() => api.friends.request(profile.id), 'Request sent')} />}
        </View>
      </Card>
      <T v="h2" style={{ fontSize: 18 }}>{isMe ? 'Recently watched' : 'Movie diary'}</T>
      {summary.loading || recent.loading ? <PosterGridSkeleton n={3} />
        : !s?.can_view_activity && !isMe ? <Empty icon="lock-closed-outline" title="This diary is private" body={profile.privacy === 'friends' ? 'Become friends to see their movies.' : undefined} />
        : !recent.data?.length ? <Empty title="No movies logged yet" />
        : <Grid>{recent.data.map((e) => <MovieTile key={e.id} title={e.title} poster={e.poster_path} sub={formatDate(e.watched_on)} rating={e.rating} />)}</Grid>}
    </Screen>
  );
}
