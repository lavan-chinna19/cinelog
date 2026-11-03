'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AtSign, Check, Lock, Mail, X } from 'lucide-react';
import { validateEmail, validatePassword, validateUsername } from '@cinelog/shared';
import { getApi, siteUrl } from '@/lib/api';
import { useDebounced } from '@/lib/useAsync';
import { Button, Input } from '@/components/ui';
import { SetupNotice } from '../SetupNotice';

export default function SignupPage() {
  const router = useRouter();
  const [f, setF] = useState({ username: '', email: '', password: '' });
  const [touched, setTouched] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const debouncedName = useDebounced(f.username, 400);

  useEffect(() => {
    setAvailable(null);
    if (validateUsername(debouncedName)) return;
    getApi().auth.usernameAvailable(debouncedName).then(setAvailable).catch(() => setAvailable(null));
  }, [debouncedName]);

  const errors = { username: validateUsername(f.username), email: validateEmail(f.email), password: validatePassword(f.password) };

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setTouched(true); setErr(null);
    if (errors.username || errors.email || errors.password) return;
    if (available === false) return setErr('That username is taken.');
    setBusy(true);
    try {
      const { needsConfirmation } = await getApi().auth.signUp({ ...f, redirectTo: `${siteUrl()}/auth/callback?next=/home` });
      if (needsConfirmation) setSent(true); else { router.replace('/home'); router.refresh(); }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (sent) return (
    <div className="space-y-3 text-center">
      <Mail className="mx-auto h-10 w-10 text-amber" />
      <h1 className="font-heading text-xl font-semibold">Check your inbox</h1>
      <p className="text-sm text-ink-muted">We sent a confirmation link to <span className="text-ink">{f.email}</span>. Open it to activate your account.</p>
      <Link href="/login" className="inline-block pt-2 text-sm text-amber hover:underline">Back to log in</Link>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div><h1 className="font-heading text-xl font-semibold">Create your account</h1><p className="text-sm text-ink-muted">Your diary, on every device.</p></div>
      <SetupNotice />
      <div>
        <Input label="Username" name="username" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.trim() })}
          icon={<AtSign className="h-4 w-4" />} error={touched ? errors.username : null} maxLength={20} />
        {!errors.username && available !== null && (
          <p className={`mt-1 flex items-center gap-1 text-xs ${available ? 'text-success' : 'text-notify'}`}>
            {available ? <><Check className="h-3 w-3" /> @{f.username} is available</> : <><X className="h-3 w-3" /> That username is taken</>}
          </p>)}
      </div>
      <Input label="Email" name="email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} icon={<Mail className="h-4 w-4" />} error={touched ? errors.email : null} />
      <Input label="Password" name="password" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} icon={<Lock className="h-4 w-4" />}
        error={touched ? errors.password : null} placeholder="8+ characters, a letter and a number" />
      {err && <p className="text-sm text-notify" role="alert">{err}</p>}
      <Button className="w-full" size="lg" loading={busy}>Sign up</Button>
      <p className="text-center text-sm text-ink-muted">Already have an account? <Link href="/login" className="text-amber hover:underline">Log in</Link></p>
    </form>
  );
}
