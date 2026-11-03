import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { colors, timeAgo } from '@cinelog/shared';
import { api, supabase } from '@/lib/supabase';
import { useAsync } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { Avatar, Button, Empty, ErrorText, Skeleton, T } from '@/components/ui';

export default function Messages() {
  const router = useRouter();
  const { profile, online } = useSession();
  const { data, loading, error, refreshing, reload } = useAsync(() => api.messages.conversations(), []);
  useEffect(() => { const ch = api.messages.subscribeInbox(() => reload('silent')); return () => { supabase.removeChannel(ch); }; }, []); // eslint-disable-line

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList data={data ?? []} keyExtractor={(c) => c.conversation_id} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl tintColor={colors.amber} refreshing={refreshing} onRefresh={() => reload('refresh')} />}
        ListHeaderComponent={error ? <ErrorText msg={error} onRetry={() => reload()} /> : null}
        ListEmptyComponent={loading ? <View style={{ gap: 10 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={64} r={16} />)}</View>
          : <Empty icon="chatbubbles-outline" title="No conversations" body="Start a chat from your friends list." action={<Button variant="secondary" title="Open friends" onPress={() => router.push('/(tabs)/friends')} />} />}
        renderItem={({ item: c }) => (
          <Pressable onPress={() => router.push(`/chat/${c.conversation_id}`)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18 }, pressed && { backgroundColor: colors.surface }]}>
            <Avatar url={c.other_avatar_url} name={c.other_username} size={50} online={online.has(c.other_id)} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T style={{ fontFamily: c.unread_count ? 'Inter_600SemiBold' : 'Inter_500Medium' }}>@{c.other_username}</T>
                <T v="small">{c.last_message_kind ? timeAgo(c.last_message_at) : ''}</T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T v="muted" numberOfLines={1} style={[{ flex: 1 }, c.unread_count ? { color: colors.text } : {}, c.last_message_kind === 'recommendation' ? { color: colors.amber } : {}]}>
                  {c.last_message_sender === profile?.id ? 'You: ' : ''}{c.last_message_kind === 'recommendation' ? '🎬 Recommended a movie' : c.last_message_body ?? 'Say hi 👋'}
                </T>
                {c.unread_count > 0 && <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.notify, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><T v="small" style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>{c.unread_count}</T></View>}
              </View>
            </View>
          </Pressable>
        )} />
    </View>
  );
}
