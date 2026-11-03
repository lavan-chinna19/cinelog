'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Mail } from 'lucide-react';
import { getApi, siteUrl } from '@/lib/api';
import { Button, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await getApi().auth.sendPasswordReset(email, `${siteUrl()}/auth/callback?next=/reset-password`); setSent(true); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  if (sent) return (
    <div className="space-y-3 text-center">
      <Mail className="mx-auto h-10 w-10 text-amber" />
      <h1 className="font-heading text-xl font-semibold">Reset link sent</h1>
      <p className="text-sm text-ink-muted">If an account exists for {email}, you&apos;ll get an email with a link to choose a new password.</p>
      <Link href="/login" className="inline-block pt-2 text-sm text-amber hover:underline">Back to log in</Link>
    </div>
  );
  return (
    <form onSubmit={submit} className="space-y-4">
      <div><h1 className="font-heading text-xl font-semibold">Forgot your password?</h1><p className="text-sm text-ink-muted">Enter your account email and we&apos;ll send a reset link.</p></div>
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail className="h-4 w-4" />} required />
      {err && <p className="text-sm text-notify">{err}</p>}
      <Button className="w-full" size="lg" loading={busy}>Send reset link</Button>
      <p className="text-center text-sm"><Link href="/login" className="text-ink-muted hover:text-ink">Back to log in</Link></p>
    </form>
  );
}
