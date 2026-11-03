'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Globe, Lock, MessageCircle, Pencil, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { formatDate, type Profile } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { MovieCard, PosterGrid } from './movies/MovieCard';
import { Avatar, Badge, Button, EmptyState, PosterGridSkeleton, Skeleton, useToast } from './ui';

const PRIVACY = { public: { icon: Globe, label: 'Public' }, friends: { icon: Users, label: 'Friends only' }, private: { icon: Lock, label: 'Private' } };

export function ProfileView({ profile, isMe }: { profile: Profile; isMe: boolean }) {
  const api = getApi();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const summary = useAsync(() => api.profiles.summary(profile.id), [profile.id]);
  const recent = useAsync(async () => (summary.data?.can_view_activity || isMe ? (await api.diary.page({ userId: profile.id, pageSize: 12 })).items : []), [profile.id, summary.data?.can_view_activity]);
  const s = summary.data;
  const P = PRIVACY[profile.privacy];

  async function act(fn: () => Promise<unknown>, msg: string) {
    setBusy(true); try { await fn(); toast(msg); await summary.reload(true); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  const f = s?.friendship;
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface/60 p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_0%_0%,rgba(240,163,94,.15),transparent),radial-gradient(50%_80%_at_100%_100%,rgba(167,139,250,.15),transparent)]" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar url={profile.avatar_url} name={profile.username} size={104} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold sm:text-3xl">@{profile.username}</h1>
              <Badge><P.icon className="h-3 w-3" /> {P.label}</Badge>
            </div>
            {profile.display_name && <p className="font-accent text-lg italic text-ink-muted">{profile.display_name}</p>}
            <p className="max-w-xl text-sm text-ink">{profile.bio || <span className="text-ink-muted">{isMe ? 'Add a bio in settings.' : 'No bio yet.'}</span>}</p>
            {s?.favourite_genres?.length ? <div className="flex flex-wrap gap-1.5 pt-1">{s.favourite_genres.map((g) => <Badge key={g} tone="lavender">{g}</Badge>)}</div> : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {isMe ? <Link href="/settings"><Button variant="secondary"><Pencil className="h-4 w-4" /> Edit profile</Button></Link>
              : !s ? <Skeleton className="h-10 w-32" />
              : f?.status === 'accepted' ? <>
                  <Button onClick={async () => router.push(`/messages/${await api.messages.open(profile.id)}`)}><MessageCircle className="h-4 w-4" /> Message</Button>
                  <Button variant="ghost" loading={busy} onClick={() => confirm('Remove friend?') && act(() => api.friends.remove(f.id), 'Friend removed')}><UserMinus className="h-4 w-4" /></Button>
                </>
              : f?.direction === 'incoming' ? <Button loading={busy} onClick={() => act(() => api.friends.respond(f.id, true), 'Friend request accepted')}><Check className="h-4 w-4" /> Accept request</Button>
              : f?.direction === 'outgoing' ? <Button variant="secondary" loading={busy} onClick={() => act(() => api.friends.remove(f.id), 'Request cancelled')}><UserCheck className="h-4 w-4" /> Requested · Cancel</Button>
              : <Button loading={busy} onClick={() => act(() => api.friends.request(profile.id), 'Friend request sent')}><UserPlus className="h-4 w-4" /> Add friend</Button>}
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-line/70 pt-5 text-center">
          {[['Watched', s?.watched_count], ['Watchlist', s?.watchlist_count], ['Friends', s?.friends_count]].map(([label, v]) => (
            <div key={label as string}><p className="font-heading text-2xl font-bold">{v ?? (s ? '—' : '…')}</p><p className="text-xs text-ink-muted">{label}</p></div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-heading text-lg font-semibold">{isMe ? 'Recently watched' : 'Movie diary'}</h2>
        {summary.loading || recent.loading ? <PosterGridSkeleton count={6} />
          : !s?.can_view_activity && !isMe ? <EmptyState icon={<Lock className="h-7 w-7" />} title="This diary is private" body={profile.privacy === 'friends' ? 'Become friends to see what they watch.' : 'Only they can see their movies.'} />
          : !recent.data?.length ? <EmptyState title="No movies logged yet" />
          : <PosterGrid>{recent.data.map((e) => <MovieCard key={e.id} title={e.title} poster={e.poster_path} date={formatDate(e.watched_on)} rating={e.rating} />)}</PosterGrid>}
      </section>
    </div>
  );
}
