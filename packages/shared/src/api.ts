/**
 * CineLog data layer — the single source of business logic for web and mobile.
 * Every call runs as the signed-in user; Postgres RLS + RPCs enforce authorization.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type {
  AppNotification, ConversationSummary, DiaryEntry, Friendship, Message, Profile, ProfileLite,
  ProfileSummary, Recommendation, TmdbMovie, WatchlistEntry, WatchlistStatus,
} from './types';
import type { TmdbService } from './tmdb';
import { validateEmail, validatePassword, validateUsername } from './validation';

const LITE = 'id, username, avatar_url';
const MOVIE = 'id, tmdb_id, title, release_date, poster_path, backdrop_path, overview, genres, runtime';
const REC_SELECT = `id, sender_id, recipient_id, movie_id, message, watchlist_id, accepted_at, created_at,
  movie:movies(${MOVIE}), sender:profiles!movie_recommendations_sender_id_fkey(${LITE})`;

export class ApiError extends Error {}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new ApiError(friendly(res.error.message));
  return res.data as T;
}
function friendly(msg: string): string {
  if (/duplicate key.*username/i.test(msg)) return 'That username is taken.';
  if (/JWT|not authenticated/i.test(msg)) return 'Your session expired. Please log in again.';
  if (/only message friends/i.test(msg)) return 'You can only message friends.';
  return msg;
}

export type WatchlistSort = 'recent' | 'title' | 'release';
export type AddResult = { status: 'added' | 'exists'; watchlist_id: string };

export function createCineLogApi(supabase: SupabaseClient, tmdb?: TmdbService) {
  async function uid(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new ApiError('Please log in.');
    return id;
  }

  // ───────────────────────── Auth ─────────────────────────
  const auth = {
    async usernameAvailable(username: string): Promise<boolean> {
      return unwrap(await supabase.rpc('username_available', { p_username: username })) as boolean;
    },
    async signUp(p: { username: string; email: string; password: string; redirectTo?: string }) {
      const err = validateUsername(p.username) || validateEmail(p.email) || validatePassword(p.password);
      if (err) throw new ApiError(err);
      if (!(await auth.usernameAvailable(p.username))) throw new ApiError('That username is taken.');
      const { data, error } = await supabase.auth.signUp({
        email: p.email.trim(),
        password: p.password,
        options: { data: { username: p.username.toLowerCase() }, emailRedirectTo: p.redirectTo },
      });
      if (error) throw new ApiError(error.message);
      return { needsConfirmation: !data.session };
    },
    /** Email or username + password. */
    async signIn(identifier: string, password: string) {
      const id = identifier.trim();
      if (!id || !password) throw new ApiError('Enter your email/username and password.');
      if (id.includes('@')) {
        const { error } = await supabase.auth.signInWithPassword({ email: id, password });
        if (error) throw new ApiError(error.message === 'Email not confirmed' ? 'Please confirm your email before logging in.' : 'Invalid login credentials');
        return;
      }
      const { data, error } = await supabase.functions.invoke('username-login', { body: { identifier: id, password } });
      if (error || !data?.session) {
        let msg = 'Invalid login credentials';
        try { const ctx = await (error as any)?.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* noop */ }
        throw new ApiError(msg);
      }
      const { error: e2 } = await supabase.auth.setSession(data.session);
      if (e2) throw new ApiError(e2.message);
    },
    async sendPasswordReset(email: string, redirectTo: string) {
      const err = validateEmail(email); if (err) throw new ApiError(err);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw new ApiError(error.message);
    },
    async updatePassword(password: string) {
      const err = validatePassword(password); if (err) throw new ApiError(err);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new ApiError(error.message);
    },
    async signOut() { await supabase.auth.signOut(); },
  };

  // ───────────────────────── Profiles ─────────────────────────
  const profiles = {
    async me(): Promise<Profile> {
      const id = await uid();
      return unwrap(await supabase.from('profiles').select('*').eq('id', id).single());
    },
    async byUsername(username: string): Promise<Profile | null> {
      return unwrap(await supabase.from('profiles').select('*').eq('username', username).maybeSingle());
    },
    async byId(id: string): Promise<Profile | null> {
      return unwrap(await supabase.from('profiles').select('*').eq('id', id).maybeSingle());
    },
    async update(patch: Partial<Pick<Profile, 'username' | 'display_name' | 'bio' | 'avatar_url' | 'privacy' | 'show_diary'>>) {
      if (patch.username) { const e = validateUsername(patch.username); if (e) throw new ApiError(e); }
      const id = await uid();
      return unwrap(await supabase.from('profiles').update(patch).eq('id', id).select('*').single()) as Profile;
    },
    /** Upload to avatars/<uid>/avatar-<ts>.<ext> and save the public URL on the profile. */
    async uploadAvatar(file: Blob | ArrayBuffer, contentType: string) {
      if (!/^image\/(jpeg|png|webp)$/.test(contentType)) throw new ApiError('Use a JPG, PNG or WebP image.');
      const size = file instanceof ArrayBuffer ? file.byteLength : file.size;
      if (size > 2 * 1024 * 1024) throw new ApiError('Images must be under 2 MB.');
      const id = await uid();
      const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
      const path = `${id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType, upsert: true });
      if (error) throw new ApiError(error.message);
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      return profiles.update({ avatar_url: url });
    },
    async search(q: string, limit = 20): Promise<ProfileLite[]> {
      const raw = q.trim().replace(/^@/, '').replace(/[%,()\\]/g, '');
      if (raw.length < 2) return [];
      const term = raw.replace(/_/g, '\\_'); // '_' is a LIKE wildcard: escape it so exact usernames match
      const me = await uid();
      return unwrap(await supabase.from('profiles').select(`${LITE}, bio`).ilike('username', `%${term}%`).neq('id', me).limit(limit)) as ProfileLite[];
    },
    async summary(userId: string): Promise<ProfileSummary> {
      return unwrap(await supabase.rpc('get_profile_summary', { p_user_id: userId })) as ProfileSummary;
    },
    async heartbeat() { await supabase.rpc('touch_last_seen'); },
  };

  // ───────────────────────── Movies ─────────────────────────
  const movies = {
    /** Cache a TMDB movie (enriching runtime/genres via details when available) and return its uuid. */
    async ensure(m: TmdbMovie): Promise<string> {
      let movie = m;
      if (tmdb && (m.runtime == null || !m.genres.length)) {
        try { movie = { ...m, ...(await tmdb.details(m.tmdb_id)) }; } catch { /* best effort */ }
      }
      return unwrap(await supabase.rpc('upsert_movie', {
        p_tmdb_id: movie.tmdb_id, p_title: movie.title, p_release_date: movie.release_date,
        p_poster_path: movie.poster_path, p_backdrop_path: movie.backdrop_path,
        p_overview: movie.overview, p_genres: movie.genres, p_runtime: movie.runtime,
      })) as string;
    },
  };

  // ───────────────────────── Watchlist ─────────────────────────
  const WL_SELECT = `id, user_id, movie_id, status, recommended_by, recommendation_id, created_at,
    movie:movies(${MOVIE}), recommender:profiles!watchlist_recommended_by_fkey(${LITE})`;

  const watchlist = {
    async list(opts: { userId?: string; sort?: WatchlistSort; status?: WatchlistStatus | 'all'; search?: string } = {}): Promise<WatchlistEntry[]> {
      const userId = opts.userId ?? (await uid());
      let q = supabase.from('watchlist').select(WL_SELECT).eq('user_id', userId);
      if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status);
      let rows = unwrap(await q.order('created_at', { ascending: false }).limit(500)) as unknown as WatchlistEntry[];
      if (opts.search?.trim()) {
        const s = opts.search.trim().toLowerCase();
        rows = rows.filter((r) => r.movie.title.toLowerCase().includes(s));
      }
      if (opts.sort === 'title') rows.sort((a, b) => a.movie.title.localeCompare(b.movie.title));
      if (opts.sort === 'release') rows.sort((a, b) => (b.movie.release_date ?? '').localeCompare(a.movie.release_date ?? ''));
      return rows;
    },
    async tmdbIds(): Promise<Set<number>> {
      const id = await uid();
      const rows = unwrap(await supabase.from('watchlist').select('movie:movies(tmdb_id)').eq('user_id', id)) as any[];
      return new Set(rows.map((r) => r.movie?.tmdb_id).filter(Boolean));
    },
    async add(m: TmdbMovie, status: WatchlistStatus = 'want_to_watch'): Promise<AddResult> {
      const movieId = await movies.ensure(m);
      return unwrap(await supabase.rpc('add_to_watchlist', { p_movie_id: movieId, p_status: status })) as AddResult;
    },
    async addFromRecommendation(recommendationId: string): Promise<AddResult> {
      return unwrap(await supabase.rpc('add_to_watchlist', { p_movie_id: null, p_status: 'want_to_watch', p_recommendation_id: recommendationId })) as AddResult;
    },
    async setStatus(id: string, status: WatchlistStatus) {
      unwrap(await supabase.from('watchlist').update({ status }).eq('id', id));
    },
    async remove(id: string) { unwrap(await supabase.from('watchlist').delete().eq('id', id)); },
    /** Moves the entry into the diary (atomic RPC); date defaults to today. */
    async markWatched(id: string, opts: { watched_on?: string; rating?: number | null; note?: string | null } = {}): Promise<string> {
      return unwrap(await supabase.rpc('mark_as_watched', {
        p_watchlist_id: id, p_watched_on: opts.watched_on ?? null, p_rating: opts.rating ?? null, p_note: opts.note ?? null,
      })) as string;
    },
  };

  // ───────────────────────── Diary (watch_history) ─────────────────────────
  const DIARY_SELECT = `id, user_id, movie_id, tmdb_id, title, poster_path, watched_on, rating, note, recommended_by, created_at,
    movie:movies(genres, runtime, release_date), recommender:profiles!watch_history_recommended_by_fkey(${LITE})`;

  const diary = {
    async page(opts: { userId?: string; page?: number; pageSize?: number; search?: string; from?: string; to?: string; ascending?: boolean } = {}) {
      const userId = opts.userId ?? (await uid());
      const size = opts.pageSize ?? 30; const page = opts.page ?? 0;
      let q = supabase.from('watch_history').select(DIARY_SELECT).eq('user_id', userId);
      if (opts.search?.trim()) q = q.ilike('title', `%${opts.search.trim().replace(/[%_]/g, '')}%`);
      if (opts.from) q = q.gte('watched_on', opts.from);
      if (opts.to) q = q.lte('watched_on', opts.to);
      const rows = unwrap(await q.order('watched_on', { ascending: !!opts.ascending }).order('created_at', { ascending: !!opts.ascending })
        .range(page * size, page * size + size)) as unknown as DiaryEntry[];
      return { items: rows.slice(0, size), page, hasMore: rows.length > size };
    },
    /** Every entry (paged under the hood) — used for statistics and calendar. */
    async all(userId?: string): Promise<DiaryEntry[]> {
      const id = userId ?? (await uid());
      const out: DiaryEntry[] = [];
      for (let from = 0; ; from += 1000) {
        const rows = unwrap(await supabase.from('watch_history').select(DIARY_SELECT).eq('user_id', id)
          .order('watched_on', { ascending: false }).range(from, from + 999)) as unknown as DiaryEntry[];
        out.push(...rows);
        if (rows.length < 1000) return out;
      }
    },
    async log(m: TmdbMovie, opts: { watched_on?: string; rating?: number | null; note?: string | null } = {}) {
      const movieId = await movies.ensure(m);
      return unwrap(await supabase.rpc('log_watch', {
        p_movie_id: movieId, p_watched_on: opts.watched_on ?? null, p_rating: opts.rating ?? null, p_note: opts.note ?? null,
      })) as string;
    },
    async rewatch(entry: Pick<DiaryEntry, 'movie_id'>, opts: { watched_on?: string; rating?: number | null; note?: string | null } = {}) {
      return unwrap(await supabase.rpc('log_watch', {
        p_movie_id: entry.movie_id, p_watched_on: opts.watched_on ?? null, p_rating: opts.rating ?? null, p_note: opts.note ?? null,
      })) as string;
    },
    async update(id: string, patch: { watched_on?: string; rating?: number | null; note?: string | null }) {
      unwrap(await supabase.from('watch_history').update(patch).eq('id', id));
    },
    async remove(id: string) { unwrap(await supabase.from('watch_history').delete().eq('id', id)); },
  };

  // ───────────────────────── Friends ─────────────────────────
  const FR_SELECT = `id, requester_id, addressee_id, status, created_at,
    requester:profiles!friendships_requester_id_fkey(${LITE}), addressee:profiles!friendships_addressee_id_fkey(${LITE})`;

  const friends = {
    async all() {
      const me = await uid();
      const rows = unwrap(await supabase.from('friendships').select(FR_SELECT).order('created_at', { ascending: false })) as unknown as Friendship[];
      const other = (f: Friendship) => (f.requester_id === me ? f.addressee! : f.requester!);
      return {
        friends: rows.filter((f) => f.status === 'accepted').map((f) => ({ friendship: f, profile: other(f) })),
        received: rows.filter((f) => f.status === 'pending' && f.addressee_id === me).map((f) => ({ friendship: f, profile: f.requester! })),
        sent: rows.filter((f) => f.status === 'pending' && f.requester_id === me).map((f) => ({ friendship: f, profile: f.addressee! })),
      };
    },
    async friendIds(): Promise<string[]> {
      const me = await uid();
      const rows = unwrap(await supabase.from('friendships').select('requester_id, addressee_id').eq('status', 'accepted')) as any[];
      return rows.map((r) => (r.requester_id === me ? r.addressee_id : r.requester_id));
    },
    async request(userId: string) {
      return unwrap(await supabase.rpc('send_friend_request', { p_user_id: userId })) as { status: string; id?: string };
    },
    async respond(friendshipId: string, accept: boolean) {
      unwrap(await supabase.rpc('respond_friend_request', { p_request_id: friendshipId, p_accept: accept }));
    },
    /** Cancel a sent request, or remove a friend. */
    async remove(friendshipId: string) { unwrap(await supabase.from('friendships').delete().eq('id', friendshipId)); },
    /** Friends' recent diary entries — RLS hides anyone whose privacy forbids it. */
    async activity(limit = 20) {
      const ids = await friends.friendIds();
      if (!ids.length) return [] as (DiaryEntry & { user: ProfileLite })[];
      return unwrap(await supabase.from('watch_history')
        .select(`id, user_id, movie_id, tmdb_id, title, poster_path, watched_on, rating, note, created_at, user:profiles!watch_history_user_id_fkey(${LITE})`)
        .in('user_id', ids).order('created_at', { ascending: false }).limit(limit)) as unknown as (DiaryEntry & { user: ProfileLite })[];
    },
  };

  // ───────────────────────── Recommendations ─────────────────────────
  const recommendations = {
    async received(opts: { pendingOnly?: boolean; limit?: number } = {}): Promise<Recommendation[]> {
      const me = await uid();
      let q = supabase.from('movie_recommendations').select(REC_SELECT).eq('recipient_id', me);
      if (opts.pendingOnly) q = q.is('accepted_at', null);
      return unwrap(await q.order('created_at', { ascending: false }).limit(opts.limit ?? 12)) as unknown as Recommendation[];
    },
    async send(conversationId: string, m: TmdbMovie, message?: string) {
      const movieId = await movies.ensure(m);
      return unwrap(await supabase.rpc('send_recommendation', {
        p_conversation_id: conversationId, p_movie_id: movieId, p_message: message?.trim() || null,
      })) as string;
    },
  };

  // ───────────────────────── Messenger ─────────────────────────
  const MSG_SELECT = `id, conversation_id, sender_id, kind, body, recommendation_id, created_at,
    recommendation:movie_recommendations!messages_recommendation_id_fkey(${REC_SELECT})`;

  const messages = {
    async conversations(): Promise<ConversationSummary[]> {
      const rows = unwrap(await supabase.rpc('get_conversations')) as any[];
      return rows.map((r) => ({ ...r, unread_count: Number(r.unread_count) }));
    },
    async open(otherUserId: string): Promise<string> {
      return unwrap(await supabase.rpc('get_or_create_conversation', { p_other: otherUserId })) as string;
    },
    async members(conversationId: string) {
      return unwrap(await supabase.from('conversation_members')
        .select(`user_id, last_read_at, profile:profiles(${LITE}, last_seen_at)`).eq('conversation_id', conversationId)) as any[];
    },
    /** Newest-first pagination; returns ascending for display. */
    async page(conversationId: string, before?: string, limit = 30) {
      let q = supabase.from('messages').select(MSG_SELECT).eq('conversation_id', conversationId);
      if (before) q = q.lt('created_at', before);
      const rows = unwrap(await q.order('created_at', { ascending: false }).limit(limit + 1)) as unknown as Message[];
      return { items: rows.slice(0, limit).reverse(), hasMore: rows.length > limit };
    },
    async byId(id: string): Promise<Message> {
      return unwrap(await supabase.from('messages').select(MSG_SELECT).eq('id', id).single()) as unknown as Message;
    },
    async send(conversationId: string, body: string): Promise<Message> {
      const text = body.trim();
      if (!text) throw new ApiError('Message is empty');
      if (text.length > 4000) throw new ApiError('Message is too long');
      const me = await uid();
      return unwrap(await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: me, kind: 'text', body: text })
        .select(MSG_SELECT).single()) as unknown as Message;
    },
    async markRead(conversationId: string) { await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId }); },
    async unreadTotal(): Promise<number> {
      return (await messages.conversations()).reduce((s, c) => s + c.unread_count, 0);
    },
    /** Live messages + read-receipt updates for one conversation. */
    subscribe(conversationId: string, h: { onMessage: (m: Message) => void; onRead?: (userId: string, lastReadAt: string) => void }): RealtimeChannel {
      return supabase.channel(`conv:${conversationId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          async (p) => {
            const row = p.new as Message;
            h.onMessage(row.kind === 'recommendation' ? await messages.byId(row.id) : row);
          })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${conversationId}` },
          (p) => h.onRead?.((p.new as any).user_id, (p.new as any).last_read_at))
        .subscribe();
    },
    /** Any new message in any of my conversations (RLS-filtered) — refreshes inbox badges. */
    subscribeInbox(onChange: () => void): RealtimeChannel {
      return supabase.channel(`inbox:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, onChange)
        .subscribe();
    },
  };

  // ───────────────────────── Presence (online status) ─────────────────────────
  function presence(userId: string, onSync: (online: Set<string>) => void): RealtimeChannel {
    const ch = supabase.channel('online-users', { config: { presence: { key: userId } } });
    ch.on('presence', { event: 'sync' }, () => onSync(new Set(Object.keys(ch.presenceState()))))
      .subscribe(async (status) => { if (status === 'SUBSCRIBED') await ch.track({ at: Date.now() }); });
    return ch;
  }

  // ───────────────────────── Notifications ─────────────────────────
  const notifications = {
    async list(limit = 30): Promise<AppNotification[]> {
      const me = await uid();
      return unwrap(await supabase.from('notifications').select(`*, actor:profiles!notifications_actor_id_fkey(${LITE})`)
        .eq('user_id', me).order('created_at', { ascending: false }).limit(limit)) as unknown as AppNotification[];
    },
    async unreadCount(): Promise<number> {
      const me = await uid();
      const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', me).is('read_at', null);
      if (error) throw new ApiError(error.message);
      return count ?? 0;
    },
    async markRead(id: string) { unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)); },
    async markAllRead() {
      const me = await uid();
      unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', me).is('read_at', null));
    },
    subscribe(userId: string, onChange: (n?: AppNotification) => void): RealtimeChannel {
      return supabase.channel(`notif:${userId}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (p) => onChange(p.new as AppNotification))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => onChange())
        .subscribe();
    },
  };

  return { supabase, tmdb, auth, profiles, movies, watchlist, diary, friends, recommendations, messages, notifications, presence, uid };
}

export type CineLogApi = ReturnType<typeof createCineLogApi>;

/** Human copy for a notification row (shared so both apps word it identically). */
export function notificationText(n: AppNotification): string {
  const who = n.actor ? `@${n.actor.username}` : 'Someone';
  switch (n.type) {
    case 'friend_request': return `${who} sent you a friend request`;
    case 'friend_accepted': return `${who} accepted your friend request`;
    case 'message': return `${who}: ${n.data?.preview ?? 'sent you a message'}`;
    case 'recommendation': return `${who} recommended ${n.data?.title ?? 'a movie'}`;
    case 'recommendation_added': return `${who} added ${n.data?.title ?? 'your recommendation'} to their watchlist`;
  }
}

export function statusLabel(s: WatchlistStatus | 'watched'): string {
  return s === 'want_to_watch' ? 'Want to Watch' : s === 'currently_watching' ? 'Currently Watching' : 'Watched';
}
