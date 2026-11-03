import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, RefreshControl, View } from 'react-native';
import { colors, type ProfileLite } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { useAsync, useDebounced } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { useToast } from '@/components/toast';
import { Avatar, Button, Card, Chips, Empty, ErrorText, Field, Screen, Skeleton, T } from '@/components/ui';
import { GuestGate } from '@/components/guest';

type Tab = 'friends' | 'received' | 'sent' | 'find';

export default function FriendsScreen() {
  const { profile } = useSession();
  if (profile?.is_guest) return <GuestGate feature="Friends" />;
  return <Friends />;
}

function Friends() {
  const router = useRouter();
  const toast = useToast();
  const { online, refreshBadges } = useSession();
  const [tab, setTab] = useState<Tab>('friends');
  const [q, setQ] = useState(''); const query = useDebounced(q);
  const [results, setResults] = useState<(ProfileLite & { bio?: string | null })[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { data, loading, error, refreshing, reload } = useAsync(() => api.friends.all(), []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return; }
    api.profiles.search(query).then(setResults).catch((e) => toast(e.message, 'error'));
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(key: string, fn: () => Promise<unknown>, msg: string) {
    setBusy(key); try { await fn(); toast(msg); await reload('silent'); refreshBadges(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(null); }
  }
  async function message(id: string) { try { router.push(`/chat/${await api.messages.open(id)}`); } catch (e) { toast((e as Error).message, 'error'); } }

  const Row = ({ p, children, isOnline }: { p: ProfileLite & { bio?: string | null }; children: ReactNode; isOnline?: boolean }) => (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
      <Pressable onPress={() => router.push(`/user/${p.username}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <Avatar url={p.avatar_url} name={p.username} size={44} online={isOnline} />
        <View style={{ flex: 1 }}><T style={{ fontFamily: 'Inter_600SemiBold' }}>@{p.username}</T>{p.bio ? <T v="small" numberOfLines={1}>{p.bio}</T> : null}</View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 6 }}>{children}</View>
    </Card>
  );

  const rel = (id: string) => {
    if (data?.friends.some((f) => f.profile.id === id)) return { kind: 'friend' as const };
    const r = data?.received.find((f) => f.profile.id === id); if (r) return { kind: 'incoming' as const, id: r.friendship.id };
    const s = data?.sent.find((f) => f.profile.id === id); if (s) return { kind: 'outgoing' as const, id: s.friendship.id };
    return { kind: 'none' as const };
  };

  return (
    <Screen refresh={<RefreshControl tintColor={colors.amber} refreshing={refreshing} onRefresh={() => reload('refresh')} />}>
      <Chips<Tab> value={tab} onChange={setTab} options={[
        { id: 'friends', label: `My Friends${data ? ` (${data.friends.length})` : ''}` },
        { id: 'received', label: `Received${data?.received.length ? ` • ${data.received.length}` : ''}` },
        { id: 'sent', label: 'Sent' }, { id: 'find', label: 'Find Friends' },
      ]} />
      {error && <ErrorText msg={error} onRetry={() => reload()} />}
      {tab === 'find' ? <>
        <Field value={q} onChangeText={setQ} placeholder="Search by username…" icon="search" autoCapitalize="none" autoCorrect={false} autoFocus />
        {results === null ? <T v="muted" style={{ textAlign: 'center' }}>Type at least 2 characters.</T> : !results.length ? <Empty icon="search" title="No users found" />
          : results.map((p) => { const r = rel(p.id); return (
            <Row key={p.id} p={p}>
              {r.kind === 'friend' ? <Button small variant="secondary" icon="chatbubble-outline" onPress={() => message(p.id)} />
                : r.kind === 'incoming' ? <Button small title="Accept" loading={busy === p.id} onPress={() => act(p.id, () => api.friends.respond(r.id, true), 'Friend added')} />
                : r.kind === 'outgoing' ? <Button small variant="ghost" title="Requested" disabled />
                : <Button small icon="person-add-outline" title="Add" loading={busy === p.id} onPress={() => act(p.id, () => api.friends.request(p.id), `Request sent to @${p.username}`)} />}
            </Row>); })}
      </> : loading ? [0, 1, 2].map((i) => <Skeleton key={i} h={64} r={18} />)
        : tab === 'friends' ? (!data?.friends.length ? <Empty icon="people-outline" title="No friends yet" body="Find people by username." action={<Button title="Find friends" icon="person-add-outline" onPress={() => setTab('find')} />} />
          : data.friends.map(({ friendship, profile: p }) => (
            <Row key={friendship.id} p={p} isOnline={online.has(p.id)}>
              <Button small variant="secondary" icon="chatbubble-outline" onPress={() => message(p.id)} />
              <Button small variant="ghost" icon="person-remove-outline" onPress={() => Alert.alert('Remove friend?', `@${p.username}`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => act(friendship.id, () => api.friends.remove(friendship.id), 'Friend removed') }])} />
            </Row>)))
        : tab === 'received' ? (!data?.received.length ? <Empty icon="mail-open-outline" title="No pending requests" />
          : data.received.map(({ friendship, profile: p }) => (
            <Row key={friendship.id} p={p}>
              <Button small icon="checkmark" loading={busy === friendship.id} onPress={() => act(friendship.id, () => api.friends.respond(friendship.id, true), `You and @${p.username} are friends`)} />
              <Button small variant="ghost" icon="close" onPress={() => act(friendship.id, () => api.friends.respond(friendship.id, false), 'Request declined')} />
            </Row>)))
        : (!data?.sent.length ? <Empty icon="paper-plane-outline" title="No sent requests" />
          : data.sent.map(({ friendship, profile: p }) => (
            <Row key={friendship.id} p={p}><Button small variant="secondary" title="Cancel" loading={busy === friendship.id} onPress={() => act(friendship.id, () => api.friends.remove(friendship.id), 'Request cancelled')} /></Row>)))}
    </Screen>
  );
}
