'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AtSign, Lock, Mail, UserCheck } from 'lucide-react';
import { getApi } from '@/lib/api';
import { useSession } from '@/components/SessionProvider';
import { Button, Input, PageHeader } from '@/components/ui';

/** Guest → real account. Keeps the same user id, so watchlist/diary/stats carry over. */
export default function ClaimAccountPage() {
  const { profile } = useSession();
  const [f, setF] = useState({ username: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (profile && !profile.is_guest) {
    return (
      <div className="mx-auto max-w-md"><PageHeader title="You already have an account" subtitle={`Signed in as @${profile.username}.`} />
        <Link href="/home"><Button>Go home</Button></Link></div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const { needsConfirmation } = await getApi().auth.upgradeGuest(f);
      if (needsConfirmation) { setPending(true); setBusy(false); return; }
      window.location.assign('/home?welcome=1');
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  if (pending) return (
    <div className="mx-auto max-w-md"><PageHeader title="Check your email" subtitle={`Confirm ${f.email} to finish creating your account. Your movies stay saved meanwhile.`} /></div>
  );

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Create your free account" subtitle="Keep everything you logged as a guest, and unlock friends, chat and recommendations." />
      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-line bg-surface/70 p-6 shadow-card">
        <Input label="Username" name="username" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} icon={<AtSign className="h-4 w-4" />} required />
        <Input label="Email" name="email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} icon={<Mail className="h-4 w-4" />} required />
        <Input label="Password" name="password" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} icon={<Lock className="h-4 w-4" />} required />
        <p className="text-xs text-ink-muted">3–20 letters, numbers or _ for the username; at least 8 characters for the password.</p>
        {err && <p className="text-sm text-notify" role="alert">{err}</p>}
        <Button className="w-full" size="lg" loading={busy}><UserCheck className="h-4 w-4" /> Create account &amp; keep my movies</Button>
      </form>
    </div>
  );
}
