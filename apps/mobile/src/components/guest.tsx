import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { colors } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { Button, Empty, T } from './ui';

/** "Try without an account" — Supabase anonymous (guest) sign-in. The root Gate then routes to the tabs. */
export function GuestButton({ title = 'Try it without an account', variant = 'secondary' as const }: { title?: string; variant?: 'secondary' | 'ghost' }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  return (
    <View style={{ gap: 6 }}>
      <Button variant={variant} icon="sparkles-outline" title={title} loading={busy}
        onPress={async () => { setBusy(true); setErr(null); try { await api.auth.continueAsGuest(); } catch (e) { setErr((e as Error).message); setBusy(false); } }} />
      {err && <T style={{ color: colors.notify, textAlign: 'center' }}>{err}</T>}
    </View>
  );
}

export function GuestBanner() {
  const router = useRouter();
  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(167,139,250,.35)', backgroundColor: 'rgba(167,139,250,.12)', padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Ionicons name="sparkles" size={16} color={colors.lavender} />
        <T style={{ fontFamily: 'Inter_600SemiBold' }}>You're trying CineLog as a guest</T>
      </View>
      <T v="muted">Search, build a watchlist and log movies freely. Create a free account to keep them for good and unlock friends & chat.</T>
      <Button small icon="person-add-outline" title="Create free account" onPress={() => router.push('/claim')} />
    </View>
  );
}

export function GuestGate({ feature }: { feature: string }) {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, justifyContent: 'center' }}>
      <Empty icon="lock-closed-outline" title={`${feature} need a free account`}
        body="Guests can try the watchlist, diary and stats. Create an account in seconds — everything you've logged comes with you."
        action={<Button icon="person-add-outline" title="Create free account" onPress={() => router.push('/claim')} />} />
    </View>
  );
}
