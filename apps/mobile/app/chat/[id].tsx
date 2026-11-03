import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, formatTime, isRecentlyOnline, type Message } from '@cinelog/shared';
import { api, supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { RecommendSheet, RecommendationCard } from '@/components/movies';
import { useToast } from '@/components/toast';
import { Avatar, F, T } from '@/components/ui';

const EMOJI = ['😀','😂','😍','🤩','😎','🤔','😮','😢','😭','😱','👏','👍','🙏','🔥','💯','❤️','💜','✨','🎬','🍿','🎥','🎟️','⭐','🏆','👀','🤯','🎉'];

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { profile, online, refreshBadges } = useSession();
  const [msgs, setMsgs] = useState<Message[]>([]); // newest first (inverted list)
  const [other, setOther] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [older, setOlder] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [rec, setRec] = useState(false);

  const add = useCallback((m: Message) => setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [m, ...xs])), []);
  const markRead = useCallback(async () => { await api.messages.markRead(id); refreshBadges(); }, [id, refreshBadges]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [page, members] = await Promise.all([api.messages.page(id), api.messages.members(id)]);
        if (!alive) return;
        setMsgs(page.items.reverse()); setHasMore(page.hasMore);
        setOther(members.find((m: any) => m.user_id !== profile?.id) ?? null); markRead();
      } catch (e) { toast((e as Error).message, 'error'); } finally { if (alive) setLoading(false); }
    })();
    const ch = api.messages.subscribe(id, {
      onMessage: (m) => { add(m); if (m.sender_id !== profile?.id) markRead(); },
      onRead: (uid, at) => setOther((o: any) => (o && o.user_id === uid ? { ...o, last_read_at: at } : o)),
    });
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [id, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadOlder() {
    if (!hasMore || older || !msgs.length) return;
    setOlder(true);
    try { const p = await api.messages.page(id, msgs[msgs.length - 1].created_at); setMsgs((xs) => [...xs, ...p.items.reverse()]); setHasMore(p.hasMore); } finally { setOlder(false); }
  }
  async function send() {
    const body = text.trim(); if (!body || sending) return;
    setSending(true); setText(''); setEmoji(false);
    try { add(await api.messages.send(id, body)); } catch (e) { setText(body); toast((e as Error).message, 'error'); } finally { setSending(false); }
  }

  const isOnline = other ? online.has(other.user_id) || isRecentlyOnline(other.profile?.last_seen_at) : false;
  const lastMineId = msgs.find((m) => m.sender_id === profile?.id)?.id;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{
        headerTitle: () => other ? (
          <Pressable onPress={() => router.push(`/user/${other.profile.username}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar url={other.profile.avatar_url} name={other.profile.username} size={34} online={isOnline} />
            <View><T style={{ fontFamily: F.bs }}>@{other.profile.username}</T><T v="small">{isOnline ? 'Online' : 'Offline'}</T></View>
          </Pressable>) : null,
        headerRight: () => <Pressable onPress={() => setRec(true)} hitSlop={8} accessibilityLabel="Recommend a Movie" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(167,139,250,.15)' }}>
          <Ionicons name="film-outline" size={16} color={colors.lavender} /><T v="small" style={{ color: colors.lavender, fontFamily: F.bs }}>Recommend</T></Pressable>,
      }} />
      {loading ? <ActivityIndicator style={{ flex: 1 }} color={colors.amber} /> : (
        <FlatList inverted data={msgs} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: 12, gap: 6 }}
          onEndReached={loadOlder} onEndReachedThreshold={0.3}
          ListFooterComponent={older ? <ActivityIndicator color={colors.amber} /> : !hasMore ? <T v="small" style={{ textAlign: 'center', paddingVertical: 12 }}>Start of your conversation 🍿</T> : null}
          renderItem={({ item: m }) => {
            const mine = m.sender_id === profile?.id;
            const seen = mine && other && new Date(other.last_read_at) >= new Date(m.created_at);
            return (
              <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {m.kind === 'recommendation' && m.recommendation ? <RecommendationCard rec={m.recommendation} mine={mine} />
                  : <View style={{ maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: mine ? colors.amber : colors.surfaceRaised, borderBottomRightRadius: mine ? 6 : 20, borderBottomLeftRadius: mine ? 20 : 6 }}>
                      <T style={{ color: mine ? colors.bg : colors.text }}>{m.body}</T></View>}
                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 2, paddingHorizontal: 4 }}>
                  <T v="small" style={{ fontSize: 10 }}>{formatTime(m.created_at)}</T>
                  {mine && m.id === lastMineId && <T v="small" style={{ fontSize: 10, color: seen ? colors.lavender : colors.textMuted }}>{seen ? '✓✓ Seen' : '✓'}</T>}
                </View>
              </View>
            );
          }} />
      )}
      {emoji && <ScrollView horizontal keyboardShouldPersistTaps="always" style={{ maxHeight: 50, borderTopWidth: 1, borderColor: colors.border }} contentContainerStyle={{ paddingHorizontal: 8, alignItems: 'center' }}>
        {EMOJI.map((e) => <Pressable key={e} onPress={() => setText((t) => t + e)} style={{ padding: 6 }}><T style={{ fontSize: 24 }}>{e}</T></Pressable>)}
      </ScrollView>}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderColor: colors.border }}>
        <Pressable onPress={() => setEmoji(!emoji)} style={{ padding: 8 }} accessibilityLabel="Emoji"><Ionicons name="happy-outline" size={24} color={emoji ? colors.amber : colors.textMuted} /></Pressable>
        <TextInput value={text} onChangeText={setText} placeholder="Message…" placeholderTextColor={colors.textMuted} multiline maxLength={4000}
          style={{ flex: 1, maxHeight: 120, minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: F.b, fontSize: 15 }} />
        <Pressable onPress={send} disabled={!text.trim() || sending} accessibilityLabel="Send"
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() ? colors.amber : colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          {sending ? <ActivityIndicator color={colors.bg} size="small" /> : <Ionicons name="send" size={18} color={text.trim() ? colors.bg : colors.textMuted} />}
        </Pressable>
      </View>
      {other && <RecommendSheet visible={rec} onClose={() => setRec(false)} conversationId={id} toUsername={other.profile.username} onSent={async (mid) => add(await api.messages.byId(mid))} />}
    </KeyboardAvoidingView>
  );
}
