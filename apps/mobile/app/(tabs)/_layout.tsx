import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@cinelog/shared';
import { useSession } from '@/lib/session';
import { Avatar, F } from '@/components/ui';

function HeaderRight() {
  const router = useRouter();
  const { unreadNotifications, profile } = useSession();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 16 }}>
      <Pressable onPress={() => router.push('/stats')} hitSlop={8} accessibilityLabel="Statistics"><Ionicons name="stats-chart-outline" size={21} color={colors.text} /></Pressable>
      <Pressable onPress={() => router.push('/notifications')} hitSlop={8} accessibilityLabel="Notifications">
        <Ionicons name="notifications-outline" size={22} color={colors.text} />
        {unreadNotifications > 0 && <View style={{ position: 'absolute', top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.notify, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
          <Text style={{ color: '#fff', fontSize: 9, fontFamily: F.bs }}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text></View>}
      </Pressable>
      <Pressable onPress={() => router.push('/profile')} accessibilityLabel="My profile"><Avatar url={profile?.avatar_url} name={profile?.username} size={30} /></Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { unreadMessages } = useSession();
  const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, focused }: { color: string; focused: boolean }) =>
    <Ionicons name={(focused ? name : `${name}-outline`) as any} size={23} color={color} />;
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, headerTintColor: colors.text,
      headerTitleStyle: { fontFamily: F.h, fontSize: 20 }, headerTitleAlign: 'left', headerRight: () => <HeaderRight />,
      tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, height: 64, paddingTop: 6 },
      tabBarActiveTintColor: colors.amber, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: { fontFamily: F.bm, fontSize: 11 },
      sceneStyle: { backgroundColor: colors.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: 'CineLog', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="watchlist" options={{ title: 'Watchlist', tabBarIcon: icon('bookmark') }} />
      <Tabs.Screen name="diary" options={{ title: 'Diary', tabBarIcon: icon('book') }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: icon('people') }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: icon('chatbubbles'), tabBarBadge: unreadMessages || undefined, tabBarBadgeStyle: { backgroundColor: colors.notify } }} />
    </Tabs>
  );
}
