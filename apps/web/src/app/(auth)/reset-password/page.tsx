'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { getApi } from '@/lib/api';
import { Button, Input } from '@/components/ui';

export default function ResetPasswordPage() {
  const router = useRouter();
  const api = getApi();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // The /auth/callback route exchanged the recovery code for a session.
    api.supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data } = api.supabase.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY' || ev === 'SIGNED_IN') setReady(true); });
    return () => data.subscription.unsubscribe();
  }, [api]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (pw !== pw2) return setErr('Passwords don’t match.');
    setBusy(true);
    try { await api.auth.updatePassword(pw); await api.auth.signOut(); router.replace('/login?reset=1'); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (ready === false) return <p className="text-sm text-ink-muted">This reset link is invalid or has expired. <a href="/forgot-password" className="text-amber hover:underline">Request a new one</a>.</p>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div><h1 className="font-heading text-xl font-semibold">Choose a new password</h1></div>
      <Input label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} icon={<Lock className="h-4 w-4" />} required />
      <Input label="Confirm password" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} icon={<Lock className="h-4 w-4" />} required />
      {err && <p className="text-sm text-notify">{err}</p>}
      <Button className="w-full" size="lg" loading={busy} disabled={!ready}>Update password</Button>
    </form>
  );
}
