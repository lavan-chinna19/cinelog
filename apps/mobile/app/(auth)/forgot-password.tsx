import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { useState } from 'react';
import { colors } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { Button, Field, T } from '@/components/ui';
import { AuthFrame } from '@/components/AuthFrame';

export default function Forgot() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setErr(null);
    try { await api.auth.sendPasswordReset(email, Linking.createURL('reset-password')); setSent(true); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <AuthFrame>
      <T v="h2">{sent ? 'Reset link sent' : 'Forgot your password?'}</T>
      <T v="muted">{sent ? `If an account exists for ${email}, open the email on this phone to choose a new password.` : 'Enter your account email and we’ll send a reset link.'}</T>
      {!sent && <><Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" icon="mail-outline" />
        {err && <T style={{ color: colors.notify }}>{err}</T>}<Button title="Send reset link" onPress={submit} loading={busy} /></>}
      <Link href="/(auth)/login" style={{ alignSelf: 'center' }}><T v="muted">Back to log in</T></Link>
    </AuthFrame>
  );
}
