import Link from 'next/link';
import { Clapperboard } from 'lucide-react';
import { TAGLINE } from '@cinelog/shared';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_45%_at_15%_10%,rgba(240,163,94,.16),transparent),radial-gradient(40%_40%_at_85%_90%,rgba(167,139,250,.14),transparent)]" />
      <div className="relative w-full max-w-md animate-fade-up">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-amber to-lavender text-bg shadow-glow"><Clapperboard className="h-6 w-6" /></span>
          <span className="font-heading text-2xl font-bold">Cine<span className="text-amber">Log</span></span>
          <span className="font-accent text-sm italic text-ink-muted">{TAGLINE}</span>
        </Link>
        <div className="rounded-3xl border border-line bg-surface/80 p-6 shadow-card backdrop-blur-xl sm:p-8">{children}</div>
      </div>
    </main>
  );
}
