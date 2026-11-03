import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { colors, validateEmail, validatePassword, validateUsername } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { useDebounced } from '@/lib/hooks';
import { Button, Field, T } from '@/components/ui';
import { AuthFrame } from '@/components/AuthFrame';

export default function Signup() {
  const [f, setF] = useState({ username: '', email: '', password: '' });
  const [touched, setTouched] = useState(false);
  const [avail, setAvail] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [sent, setSent] = useState(false);
  const name = useDebounced(f.username);
  useEffect(() => { setAvail(null); if (!validateUsername(name)) api.auth.usernameAvailable(name).then(setAvail).catch(() => {}); }, [name]);
  const e = { username: validateUsername(f.username), email: validateEmail(f.email), password: validatePassword(f.password) };

  async function submit() {
    setTouched(true); setErr(null);
    if (e.username || e.email || e.password) return;
    if (avail === false) return setErr('That username is taken.');
    setBusy(true);
    try { const r = await api.auth.signUp({ ...f, redirectTo: Linking.createURL('auth-callback') }); if (r.needsConfirmation) setSent(true); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  if (sent) return <AuthFrame><T v="h2">Check your inbox</T><T v="muted">We sent a confirmation link to {f.email}. Confirm it, then log in on any device.</T>
    <Link href="/(auth)/login"><T style={{ color: colors.amber }}>Back to log in</T></Link></AuthFrame>;
  return (
    <AuthFrame>
      <View><T v="h2">Create your account</T><T v="muted">One account for web and mobile.</T></View>
      <View style={{ gap: 4 }}>
        <Field label="Username" value={f.username} onChangeText={(s) => setF({ ...f, username: s.trim() })} autoCapitalize="none" autoCorrect={false} icon="at" maxLength={20} error={touched ? e.username : null} />
        {!e.username && avail !== null && <T v="small" style={{ color: avail ? colors.success : colors.notify }}>{avail ? `@${f.username} is available` : 'That username is taken'}</T>}
      </View>
      <Field label="Email" value={f.email} onChangeText={(s) => setF({ ...f, email: s })} autoCapitalize="none" keyboardType="email-address" icon="mail-outline" error={touched ? e.email : null} />
      <Field label="Password" value={f.password} onChangeText={(s) => setF({ ...f, password: s })} secureTextEntry icon="lock-closed-outline" placeholder="8+ chars, a letter and a number" error={touched ? e.password : null} />
      {err && <T style={{ color: colors.notify }}>{err}</T>}
      <Button title="Sign up" onPress={submit} loading={busy} />
      <Link href="/(auth)/login" style={{ alignSelf: 'center' }}><T v="muted">Already have an account? <T v="muted" style={{ color: colors.amber }}>Log in</T></T></Link>
    </AuthFrame>
  );
}
