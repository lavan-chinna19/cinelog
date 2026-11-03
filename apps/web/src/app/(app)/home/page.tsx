'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, Bookmark, CalendarDays, Gift, Plus, Users } from 'lucide-react';
import { filterByRange, releaseYear, timeAgo } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/components/SessionProvider';
import { MovieCard, PosterGrid } from '@/components/movies/MovieCard';
import { QuickAddModal } from '@/components/movies/QuickAddModal';
import { Avatar, Badge, Button, EmptyState, ErrorState, ListSkeleton, Poster, PosterGridSkeleton, Skeleton, StarRating, useToast } from '@/components/ui';

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number | string; tone: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface/70 p-4 sm:p-5">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${tone}`} />
      <Icon className="h-5 w-5 text-ink-muted" />
      <p className="mt-3 font-heading text-3xl font-bold">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-heading text-lg font-semibold">{title}</h2>{href && <Link href={href} className="text-sm text-lavender hover:underline">See all</Link>}</div>
      {children}
    </section>
  );
}

export default function HomePage() {
  const api = getApi();
  const toast = useToast();
  const { profile } = useSession();
  const [quickAdd, setQuickAdd] = useState(false);

  const core = useAsync(async () => {
    const [history, watchlist] = await Promise.all([api.diary.all(), api.watchlist.list()]);
    return { history, watchlist };
  }, []);
  const social = useAsync(async () => {
    const [activity, recs] = await Promise.all([api.friends.activity(12), api.recommendations.received({ pendingOnly: true, limit: 8 })]);
    return { activity, recs };
  }, []);

  const h = core.data?.history ?? [];
  const w = core.data?.watchlist ?? [];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <p className="font-accent italic text-lavender">Good to see you,</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{profile ? `@${profile.username}` : <Skeleton className="h-9 w-48" />}</h1>
        </div>
        <Button onClick={() => setQuickAdd(true)}><Plus className="h-4 w-4" /> Quick Add Movie</Button>
      </div>

      {core.error && <ErrorState message={core.error} onRetry={() => core.reload()} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {core.loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />) : <>
          <Stat icon={BookOpen} label="Movies watched" value={h.length} tone="bg-amber/30" />
          <Stat icon={Bookmark} label="In your watchlist" value={w.length} tone="bg-lavender/30" />
          <Stat icon={CalendarDays} label="Watched this month" value={filterByRange(h, 'month').length} tone="bg-success/30" />
          <Stat icon={Users} label="Recommendations waiting" value={social.data?.recs.length ?? 0} tone="bg-notify/30" />
        </>}
      </div>

      <Section title="Recently watched" href="/diary">
        {core.loading ? <PosterGridSkeleton count={6} /> : h.length === 0
          ? <EmptyState icon={<BookOpen className="h-7 w-7" />} title="Your diary is empty" body="Log a movie you've watched and it lands here with the date." action={<Button onClick={() => setQuickAdd(true)}>Log a movie</Button>} />
          : <PosterGrid>{h.slice(0, 6).map((e) => <MovieCard key={e.id} title={e.title} poster={e.poster_path} date={e.watched_on} rating={e.rating} />)}</PosterGrid>}
      </Section>

      <Section title="Recently added to your watchlist" href="/watchlist">
        {core.loading ? <PosterGridSkeleton count={6} /> : w.length === 0
          ? <EmptyState icon={<Bookmark className="h-7 w-7" />} title="Nothing queued up" body="Search for a movie and save it for movie night." action={<Button variant="secondary" onClick={() => setQuickAdd(true)}>Find a movie</Button>} />
          : <PosterGrid>{w.slice(0, 6).map((e) => <MovieCard key={e.id} title={e.movie.title} poster={e.movie.poster_path} date={e.movie.release_date}
              badge={e.recommender ? <Badge tone="lavender">by @{e.recommender.username}</Badge> : undefined} />)}</PosterGrid>}
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Friends' recent activity" href="/friends">
          {social.loading ? <ListSkeleton rows={4} /> : !social.data?.activity.length
            ? <EmptyState icon={<Users className="h-7 w-7" />} title="It's quiet here" body="Add friends to see what they're watching." action={<Link href="/friends"><Button variant="secondary">Find friends</Button></Link>} />
            : <ul className="space-y-2">{social.data.activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3">
                  <Link href={`/u/${a.user.username}`}><Avatar url={a.user.avatar_url} name={a.user.username} size={38} /></Link>
                  <div className="min-w-0 flex-1 text-sm">
                    <p><Link href={`/u/${a.user.username}`} className="font-medium hover:text-amber">@{a.user.username}</Link> <span className="text-ink-muted">watched</span> <span className="font-medium">{a.title}</span></p>
                    <div className="flex items-center gap-2 text-xs text-ink-muted">{a.rating ? <StarRating value={a.rating} size={11} /> : null}<span>{timeAgo(a.created_at)}</span></div>
                  </div>
                  <Poster path={a.poster_path} title={a.title} size="w92" className="w-10 shrink-0" />
                </li>))}</ul>}
        </Section>

        <Section title="Recommended by friends">
          {social.loading ? <ListSkeleton rows={3} /> : !social.data?.recs.length
            ? <EmptyState icon={<Gift className="h-7 w-7" />} title="No recommendations yet" body="When a friend recommends a movie in chat, it shows up here." />
            : <ul className="space-y-2">{social.data.recs.map((r) => (
                <li key={r.id} className="flex gap-3 rounded-2xl border border-line bg-surface/60 p-3">
                  <Poster path={r.movie.poster_path} title={r.movie.title} size="w154" className="w-14 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.movie.title} <span className="text-ink-muted">({releaseYear(r.movie.release_date)})</span></p>
                    <p className="text-xs text-lavender">from @{r.sender?.username}</p>
                    {r.message && <p className="mt-1 line-clamp-2 text-xs italic text-ink-muted">“{r.message}”</p>}
                  </div>
                  <Button size="sm" variant="secondary" onClick={async () => {
                    try {
                      const res = await api.watchlist.addFromRecommendation(r.id);
                      toast(res.status === 'exists' ? 'Already in your watchlist' : `Added ${r.movie.title}`, res.status === 'exists' ? 'info' : 'success');
                      social.reload(true); core.reload(true);
                    } catch (e) { toast((e as Error).message, 'error'); }
                  }}><Plus className="h-4 w-4" /></Button>
                </li>))}</ul>}
        </Section>
      </div>

      <QuickAddModal open={quickAdd} onClose={() => setQuickAdd(false)} onChanged={() => core.reload(true)} />
    </div>
  );
}
