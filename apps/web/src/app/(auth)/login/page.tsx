'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, User } from 'lucide-react';
import { getApi } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { SetupNotice } from '../SetupNotice';

function LoginForm() {
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(params.get('error') === 'link' ? 'That link has expired. Request a new one.' : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await getApi().auth.signIn(identifier, password);
      const next = params.get('next');
      // Hard navigation so the middleware sees the fresh session cookie
      // (a soft router.replace can reuse a cached pre-login redirect to /login).
      window.location.assign(next && next.startsWith('/') && !next.startsWith('//') ? next : '/home');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><h1 className="font-heading text-xl font-semibold">Welcome back</h1><p className="text-sm text-ink-muted">Log in with your email or username.</p></div>
      <SetupNotice />
      {params.get('confirmed') && <p className="rounded-xl bg-success/10 p-3 text-sm text-success">Email confirmed — you can log in now.</p>}
      {params.get('reset') && <p className="rounded-xl bg-success/10 p-3 text-sm text-success">Password updated. Log in with your new password.</p>}
      <Input label="Email or username" name="identifier" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} icon={<User className="h-4 w-4" />} required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock className="h-4 w-4" />} required />
      <div className="flex justify-end"><Link href="/forgot-password" className="text-sm text-lavender hover:underline">Forgot password?</Link></div>
      {err && <p className="text-sm text-notify" role="alert">{err}</p>}
      <Button className="w-full" size="lg" loading={busy}>Log in</Button>
      <p className="text-center text-sm text-ink-muted">New to CineLog? <Link href="/signup" className="text-amber hover:underline">Create an account</Link></p>
    </form>
  );
}
export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
