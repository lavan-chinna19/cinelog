import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Profile } from '@cinelog/shared';
import { api, supabase } from './supabase';

interface Ctx {
  session: Session | null; profile: Profile | null; initialising: boolean;
  unreadNotifications: number; unreadMessages: number; online: Set<string>;
  refreshProfile: () => Promise<void>; refreshBadges: () => Promise<void>;
}
const SessionCtx = createContext<Ctx | null>(null);
export const useSession = () => useContext(SessionCtx)!;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialising, setInit] = useState(true);
  const [unreadNotifications, setUN] = useState(0);
  const [unreadMessages, setUM] = useState(0);
  const [online, setOnline] = useState<Set<string>>(new Set());

  const refreshProfile = useCallback(async () => { try { setProfile(await api.profiles.me()); } catch { setProfile(null); } }, []);
  const refreshBadges = useCallback(async () => {
    const [n, m] = await Promise.allSettled([api.notifications.unreadCount(), api.messages.unreadTotal()]);
    if (n.status === 'fulfilled') setUN(n.value); if (m.status === 'fulfilled') setUM(m.value);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setInit(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    refreshProfile(); refreshBadges();
    const uid = session.user.id;
    const n = api.notifications.subscribe(uid, () => refreshBadges());
    const m = api.messages.subscribeInbox(() => refreshBadges());
    const p = api.presence(uid, setOnline);
    api.profiles.heartbeat();
    const beat = setInterval(() => api.profiles.heartbeat(), 60_000);
    return () => { supabase.removeChannel(n); supabase.removeChannel(m); supabase.removeChannel(p); clearInterval(beat); };
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return <SessionCtx.Provider value={{ session, profile, initialising, unreadNotifications, unreadMessages, online, refreshProfile, refreshBadges }}>{children}</SessionCtx.Provider>;
}
