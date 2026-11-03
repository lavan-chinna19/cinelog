import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { colors } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { Button, Field, T } from '@/components/ui';
import { AuthFrame } from '@/components/AuthFrame';

export default function Login() {
  const [id, setId] = useState(''); const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setErr(null);
    try { await api.auth.signIn(id, pw); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <AuthFrame>
      <View><T v="h2">Welcome back</T><T v="muted">Log in with your email or username.</T></View>
      <Field label="Email or username" value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} icon="person-outline" textContentType="username" />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry icon="lock-closed-outline" textContentType="password" onSubmitEditing={submit} />
      <Link href="/(auth)/forgot-password" style={{ alignSelf: 'flex-end' }}><T v="muted" style={{ color: colors.lavender }}>Forgot password?</T></Link>
      {err && <T style={{ color: colors.notify }}>{err}</T>}
      <Button title="Log in" onPress={submit} loading={busy} />
      <Link href="/(auth)/signup" style={{ alignSelf: 'center' }}><T v="muted">New to CineLog? <T v="muted" style={{ color: colors.amber }}>Create an account</T></T></Link>
    </AuthFrame>
  );
}
