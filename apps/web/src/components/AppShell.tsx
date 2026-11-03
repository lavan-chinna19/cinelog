'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { BarChart3, Bell, BookOpen, Bookmark, Clapperboard, Home, LogOut, MessageCircle, Plus, Settings, User, Users } from 'lucide-react';
import { getApi } from '@/lib/api';
import { useSession } from './SessionProvider';
import { Avatar, Button, Modal } from './ui';
import { QuickAddModal } from './movies/QuickAddModal';
import { GuestBanner } from './Guest';

const NAV = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/watchlist', label: 'My Watchlist', short: 'Watchlist', icon: Bookmark },
  { href: '/diary', label: 'Watched Movies', short: 'Diary', icon: BookOpen },
  { href: '/stats', label: 'Statistics', icon: BarChart3 },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/profile', label: 'My Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
];
const MOBILE = ['/home', '/watchlist', '/diary', '/friends', '/messages'];

function Count({ n }: { n: number }) {
  if (!n) return null;
  return <span className="ml-auto min-w-5 rounded-full bg-notify px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{n > 99 ? '99+' : n}</span>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { profile, unreadMessages, unreadNotifications } = useSession();
  const [quickAdd, setQuickAdd] = useState(false);
  const [leaveGuest, setLeaveGuest] = useState(false);
  const active = (href: string) => path === href || path.startsWith(href + '/');

  return (
    <div className="min-h-screen">
      {/* ambient light */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60%_40%_at_10%_0%,rgba(240,163,94,.10),transparent),radial-gradient(50%_40%_at_100%_10%,rgba(167,139,250,.10),transparent)]" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg/80 px-4 py-6 backdrop-blur-xl md:flex">
        <Link href="/home" className="mb-8 flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber to-lavender text-bg"><Clapperboard className="h-5 w-5" /></span>
          <span className="font-heading text-xl font-bold tracking-tight">Cine<span className="text-amber">Log</span></span>
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={clsx('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                active(href) ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-ink-muted hover:bg-surface/60 hover:text-ink')}>
              <Icon className={clsx('h-[18px] w-[18px]', active(href) ? 'text-amber' : 'group-hover:text-ink')} />
              {label}
              {href === '/messages' && <Count n={unreadMessages} />}
            </Link>
          ))}
        </nav>
        <button onClick={() => setQuickAdd(true)} className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-amber py-2.5 text-sm font-semibold text-bg transition hover:brightness-110">
          <Plus className="h-4 w-4" /> Quick Add Movie
        </button>
        {profile && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-2.5">
            <Avatar url={profile.avatar_url} name={profile.username} size={36} />
            <div className="min-w-0 flex-1">{profile.is_guest
              ? <><p className="truncate text-sm font-medium">Guest</p><Link href="/claim" className="text-xs text-amber hover:underline">Create account</Link></>
              : <p className="truncate text-sm font-medium">@{profile.username}</p>}</div>
            <button onClick={() => profile.is_guest ? setLeaveGuest(true) : getApi().auth.signOut()} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-raised hover:text-notify" aria-label="Log out"><LogOut className="h-4 w-4" /></button>
          </div>
        )}
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line/60 bg-bg/70 px-4 backdrop-blur-xl md:ml-64 md:px-8">
        <Link href="/home" className="flex items-center gap-2 md:hidden">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber to-lavender text-bg"><Clapperboard className="h-4 w-4" /></span>
          <span className="font-heading text-lg font-bold">Cine<span className="text-amber">Log</span></span>
        </Link>
        <div className="hidden md:block" />
        <div className="flex items-center gap-1">
          <button onClick={() => setQuickAdd(true)} className="rounded-xl p-2.5 text-ink-muted hover:bg-surface hover:text-ink md:hidden" aria-label="Quick add"><Plus className="h-5 w-5" /></button>
          <Link href="/notifications" className="relative rounded-xl p-2.5 text-ink-muted hover:bg-surface hover:text-ink" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-notify px-1 text-center text-[10px] font-bold leading-4 text-white">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
          </Link>
          <Link href="/stats" className="rounded-xl p-2.5 text-ink-muted hover:bg-surface hover:text-ink md:hidden" aria-label="Statistics"><BarChart3 className="h-5 w-5" /></Link>
          <Link href="/profile" className="ml-1 md:hidden" aria-label="Profile"><Avatar url={profile?.avatar_url} name={profile?.username} size={32} /></Link>
        </div>
      </header>

      <main className="px-4 pb-28 pt-6 md:ml-64 md:px-8 md:pb-12">
        <div className="mx-auto max-w-6xl">{profile?.is_guest && path !== '/claim' && <GuestBanner />}{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {NAV.filter((n) => MOBILE.includes(n.href)).map(({ href, label, short, icon: Icon }) => (
          <Link key={href} href={href} className={clsx('relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', active(href) ? 'text-amber' : 'text-ink-muted')}>
            <Icon className="h-5 w-5" />{short ?? label}
            {href === '/messages' && unreadMessages > 0 && <span className="absolute right-[28%] top-1.5 h-2 w-2 rounded-full bg-notify" />}
          </Link>
        ))}
      </nav>

      <QuickAddModal open={quickAdd} onClose={() => setQuickAdd(false)} />
      <Modal open={leaveGuest} onClose={() => setLeaveGuest(false)} title="Leave guest mode?">
        <p className="text-sm text-ink-muted">Movies you logged as a guest will be lost unless you create a free account first.</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setLeaveGuest(false)}>Cancel</Button>
          <Link href="/claim" onClick={() => setLeaveGuest(false)}><Button variant="secondary">Create account</Button></Link>
          <Button variant="danger" onClick={() => getApi().auth.signOut()}>Leave &amp; discard</Button>
        </div>
      </Modal>
    </div>
  );
}
