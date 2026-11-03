import { useRouter } from 'expo-router';
import { useState } from 'react';
import { colors } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { Button, Field, T } from '@/components/ui';
import { AuthFrame } from '@/components/AuthFrame';

export default function ResetPassword() {
  const router = useRouter();
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit() {
    if (a !== b) return setErr('Passwords don’t match');
    setBusy(true); setErr(null);
    try { await api.auth.updatePassword(a); router.replace('/(tabs)'); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <AuthFrame>
      <T v="h2">Choose a new password</T>
      <Field label="New password" value={a} onChangeText={setA} secureTextEntry icon="lock-closed-outline" />
      <Field label="Confirm password" value={b} onChangeText={setB} secureTextEntry icon="lock-closed-outline" />
      {err && <T style={{ color: colors.notify }}>{err}</T>}
      <Button title="Update password" onPress={submit} loading={busy} />
    </AuthFrame>
  );
}
