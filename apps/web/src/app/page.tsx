import Link from 'next/link';
import { BookOpen, Clapperboard, MessageCircle, Sparkles } from 'lucide-react';

export default function Landing() {
  const features = [
    { icon: BookOpen, title: 'A diary that remembers', body: 'Every viewing, its date, your rating and the note only you will read.' },
    { icon: Sparkles, title: 'Stats from real nights in', body: 'Genres, streaks and months — calculated from what you actually watched.' },
    { icon: MessageCircle, title: 'Recommend in the chat', body: 'Drop a movie card into a conversation. One tap adds it to their watchlist.' },
  ];
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_20%_10%,rgba(240,163,94,.18),transparent),radial-gradient(40%_40%_at_90%_30%,rgba(167,139,250,.16),transparent)]" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber to-lavender text-bg"><Clapperboard className="h-5 w-5" /></span>
          <span className="font-heading text-xl font-bold">Cine<span className="text-amber">Log</span></span>
        </span>
        <nav className="flex gap-2">
          <Link href="/login" className="rounded-xl px-4 py-2 text-sm text-ink-muted hover:text-ink">Log in</Link>
          <Link href="/signup" className="rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-bg hover:brightness-110">Sign up</Link>
        </nav>
      </header>
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <p className="font-accent text-lg italic text-lavender">a social movie diary</p>
        <h1 className="mx-auto mt-4 max-w-3xl font-heading text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
          Your movies. <span className="text-amber">Your memories.</span> Your people.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-ink-muted">Track what you want to watch, log what you&apos;ve seen, and trade recommendations with friends — on the web and on your phone, always in sync.</p>
        <div className="mt-10 flex justify-center gap-3">
          <Link href="/signup" className="rounded-xl bg-amber px-6 py-3 font-semibold text-bg shadow-[0_12px_40px_-12px_rgba(240,163,94,.8)] hover:brightness-110">Start your diary</Link>
          <Link href="/login" className="rounded-xl border border-line bg-surface px-6 py-3 font-medium hover:border-ink-muted/60">I have an account</Link>
        </div>
        <div className="mx-auto mt-20 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl border border-line bg-surface/60 p-6 backdrop-blur">
              <Icon className="h-6 w-6 text-amber" />
              <h3 className="mt-4 font-heading font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
