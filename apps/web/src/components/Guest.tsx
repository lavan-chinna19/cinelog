'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Lock, Sparkles, UserCheck } from 'lucide-react';
import { getApi } from '@/lib/api';
import { Button, EmptyState } from './ui';

/** "Try without an account" — signs in as a Supabase anonymous (guest) user. */
export function GuestButton({ className, variant = 'secondary', label = 'Try it without an account' }: { className?: string; variant?: 'primary' | 'secondary' | 'ghost'; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true); setErr(null);
    try { await getApi().auth.continueAsGuest(); window.location.assign('/home?guest=1'); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <div className={className}>
      <Button type="button" variant={variant} className="w-full" loading={busy} onClick={go}><Sparkles className="h-4 w-4" /> {label}</Button>
      {err && <p className="mt-2 text-center text-sm text-notify" role="alert">{err}</p>}
    </div>
  );
}

/** Thin bar shown to guests on every app page. */
export function GuestBanner() {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-lavender/30 bg-lavender/10 p-4 sm:flex-row sm:items-center">
      <Sparkles className="hidden h-5 w-5 shrink-0 text-lavender sm:block" />
      <p className="flex-1 text-sm"><span className="font-semibold">You&apos;re trying CineLog as a guest.</span> <span className="text-ink-muted">Search, build a watchlist and log movies freely. Create a free account to keep them for good and unlock friends &amp; chat.</span></p>
      <Link href="/claim" className="shrink-0"><Button size="sm"><UserCheck className="h-4 w-4" /> Create free account</Button></Link>
    </div>
  );
}

/** Replaces social pages (friends, messages) for guests. */
export function GuestGate({ feature }: { feature: string }) {
  return (
    <EmptyState icon={<Lock className="h-7 w-7" />} title={`${feature} need a free account`}
      body="Guests can try the watchlist, diary and stats. Create an account in a few seconds — everything you've logged so far comes with you."
      action={<Link href="/claim"><Button><UserCheck className="h-4 w-4" /> Create free account</Button></Link>} />
  );
}
