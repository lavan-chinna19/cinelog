import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { colors, notificationText, timeAgo, type AppNotification } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { useAsync } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { Avatar, Button, Empty, Skeleton, T } from '@/components/ui';

export default function Notifications() {
  const router = useRouter();
  const { refreshBadges } = useSession();
  const { data, setData, loading, refreshing, reload } = useAsync(() => api.notifications.list(50), []);
  function open(n: AppNotification) {
    if (!n.read_at) { api.notifications.markRead(n.id).then(refreshBadges); setData((d) => d?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? null); }
    if (n.type === 'friend_request') router.push('/(tabs)/friends');
    else if (n.type === 'message') router.push(`/chat/${n.entity_id}`);
    else if (n.type === 'recommendation' && n.data?.conversation_id) router.push(`/chat/${n.data.conversation_id}`);
    else if (n.actor) router.push(`/user/${n.actor.username}`);
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList data={data ?? []} keyExtractor={(n) => n.id} contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }}
        refreshControl={<RefreshControl tintColor={colors.amber} refreshing={refreshing} onRefresh={() => reload('refresh')} />}
        ListHeaderComponent={data?.some((n) => !n.read_at) ? <Button small variant="secondary" icon="checkmark-done" title="Mark all read" style={{ alignSelf: 'flex-end', marginBottom: 6 }}
          onPress={async () => { await api.notifications.markAllRead(); reload('silent'); refreshBadges(); }} /> : null}
        ListEmptyComponent={loading ? <View style={{ gap: 8 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={60} r={16} />)}</View> : <Empty icon="notifications-outline" title="You're all caught up" />}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => open(n)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: n.read_at ? colors.border : 'rgba(167,139,250,.45)', backgroundColor: n.read_at ? colors.surface : 'rgba(167,139,250,.08)' }}>
            <Avatar url={n.actor?.avatar_url} name={n.actor?.username} size={38} />
            <T style={{ flex: 1, fontSize: 14 }}>{notificationText(n)}</T>
            <T v="small">{timeAgo(n.created_at)}</T>
            {!n.read_at && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.notify }} />}
          </Pressable>
        )} />
    </View>
  );
}
