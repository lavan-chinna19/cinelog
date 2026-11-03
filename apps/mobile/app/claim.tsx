import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { colors } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useToast } from '@/components/toast';
import { Button, Card, Field, Screen, T } from '@/components/ui';

/** Guest → real account. Same user id, so the watchlist, diary and stats carry over. */
export default function Claim() {
  const router = useRouter(); const toast = useToast();
  const { profile, refreshProfile } = useSession();
  const [f, setF] = useState({ username: '', email: '', password: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (profile && !profile.is_guest) return <Screen><T v="h2">You already have an account</T><T v="muted">Signed in as @{profile.username}.</T></Screen>;
  if (pending) return <Screen><T v="h2">Check your email</T><T v="muted">Confirm {f.email} to finish. Your movies stay saved meanwhile.</T></Screen>;

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const { needsConfirmation } = await api.auth.upgradeGuest(f);
      if (needsConfirmation) { setPending(true); return; }
      await refreshProfile(); toast('Account created — your movies are saved'); router.replace('/(tabs)');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <View style={{ gap: 4, marginBottom: 12 }}><T v="h2">Create your free account</T><T v="muted">Keep everything you logged as a guest and unlock friends, chat and recommendations.</T></View>
      <Card style={{ gap: 14 }}>
        <Field label="Username" value={f.username} onChangeText={(v) => setF({ ...f, username: v })} autoCapitalize="none" autoCorrect={false} icon="at-outline" />
        <Field label="Email" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} autoCapitalize="none" keyboardType="email-address" icon="mail-outline" textContentType="emailAddress" />
        <Field label="Password" value={f.password} onChangeText={(v) => setF({ ...f, password: v })} secureTextEntry icon="lock-closed-outline" textContentType="newPassword" />
        <T v="small">3–20 letters, numbers or _ for the username; at least 8 characters for the password.</T>
        {err && <T style={{ color: colors.notify }}>{err}</T>}
        <Button title="Create account & keep my movies" icon="person-add-outline" onPress={submit} loading={busy} />
      </Card>
    </Screen>
  );
}
