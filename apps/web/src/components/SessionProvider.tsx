'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile } from '@cinelog/shared';
import { getApi } from '@/lib/api';

interface SessionState {
  profile: Profile | null;
  loading: boolean;
  unreadNotifications: number;
  unreadMessages: number;
  online: Set<string>;
  refreshProfile: () => Promise<void>;
  refreshBadges: () => Promise<void>;
}
const Ctx = createContext<SessionState | null>(null);
export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be inside SessionProvider');
  return v;
}

/** Holds the signed-in profile plus live badge counts and presence for the app shell. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const api = getApi();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUN] = useState(0);
  const [unreadMessages, setUM] = useState(0);
  const [online, setOnline] = useState<Set<string>>(new Set());

  const refreshProfile = useCallback(async () => {
    try { setProfile(await api.profiles.me()); } catch { setProfile(null); }
  }, [api]);
  const refreshBadges = useCallback(async () => {
    const [n, m] = await Promise.allSettled([api.notifications.unreadCount(), api.messages.unreadTotal()]);
    if (n.status === 'fulfilled') setUN(n.value);
    if (m.status === 'fulfilled') setUM(m.value);
  }, [api]);

  useEffect(() => {
    let alive = true;
    (async () => { await refreshProfile(); if (alive) setLoading(false); refreshBadges(); })();
    const { data: sub } = api.supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setProfile(null); router.replace('/login'); }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [api, refreshProfile, refreshBadges, router]);

  useEffect(() => {
    if (!profile) return;
    const n = api.notifications.subscribe(profile.id, () => refreshBadges());
    const m = api.messages.subscribeInbox(() => refreshBadges());
    const p = api.presence(profile.id, setOnline);
    api.profiles.heartbeat();
    const beat = setInterval(() => api.profiles.heartbeat(), 60_000);
    return () => { api.supabase.removeChannel(n); api.supabase.removeChannel(m); api.supabase.removeChannel(p); clearInterval(beat); };
  }, [api, profile?.id, refreshBadges]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Ctx.Provider value={{ profile, loading, unreadNotifications, unreadMessages, online, refreshProfile, refreshBadges }}>
      {children}
    </Ctx.Provider>
  );
}
