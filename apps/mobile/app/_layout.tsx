import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@cinelog/shared';
import { SessionProvider, useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { ToastProvider } from '@/components/toast';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Handles cinelog://reset-password?code=... and cinelog://auth-callback?code=... deep links (PKCE). */
function useAuthDeepLinks() {
  const router = useRouter();
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url) return;
      const { queryParams, path } = Linking.parse(url);
      const code = queryParams?.code;
      if (typeof code === 'string') {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && path?.includes('reset-password')) router.replace('/(auth)/reset-password');
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [router]);
}

function Gate() {
  const { session, initialising } = useSession();
  const segments = useSegments();
  const router = useRouter();
  useAuthDeepLinks();
  useEffect(() => {
    if (initialising) return;
    const inAuth = segments[0] === '(auth)';
    const onReset = (segments as string[])[1] === 'reset-password';
    if (!session && !inAuth && segments[0] !== "auth-callback") router.replace('/(auth)/login');
    else if (session && inAuth && !onReset) router.replace('/(tabs)');
  }, [session, initialising, segments, router]);

  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerShadowVisible: false,
      headerTitleStyle: { fontFamily: 'SpaceGrotesk_600SemiBold' }, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right',
    }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ title: '' }} />
      <Stack.Screen name="user/[username]" options={{ title: 'Profile' }} />
      <Stack.Screen name="stats" options={{ title: 'Statistics' }} />
      <Stack.Screen name="profile" options={{ title: 'My Profile' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, PlayfairDisplay_400Regular_Italic });
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider><ToastProvider><Gate /></ToastProvider></SessionProvider>
    </SafeAreaProvider>
  );
}
