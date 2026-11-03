'use client';
import { useMemo, useState } from 'react';
import { Bookmark, Check, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { releaseYear, statusLabel, type WatchlistEntry, type WatchlistSort, type WatchlistStatus } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { QuickAddModal } from '@/components/movies/QuickAddModal';
import { WatchedFormModal } from '@/components/movies/WatchedForm';
import { Badge, Button, EmptyState, ErrorState, Input, Modal, PageHeader, Poster, PosterGridSkeleton, Select, Tabs, useToast } from '@/components/ui';

type Filter = WatchlistStatus | 'all';

export default function WatchlistPage() {
  const api = getApi();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<WatchlistSort>('recent');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [watching, setWatching] = useState<WatchlistEntry | null>(null);
  const [detail, setDetail] = useState<WatchlistEntry | null>(null);
  const { data, error, loading, reload, setData } = useAsync(() => api.watchlist.list({ sort: 'recent' }), []);

  const items = useMemo(() => {
    let r = (data ?? []).filter((e) => filter === 'all' || e.status === filter);
    if (search.trim()) r = r.filter((e) => e.movie.title.toLowerCase().includes(search.trim().toLowerCase()));
    if (sort === 'title') r = [...r].sort((a, b) => a.movie.title.localeCompare(b.movie.title));
    if (sort === 'release') r = [...r].sort((a, b) => (b.movie.release_date ?? '').localeCompare(a.movie.release_date ?? ''));
    return r;
  }, [data, filter, search, sort]);

  const counts = { want: data?.filter((e) => e.status === 'want_to_watch').length ?? 0, cur: data?.filter((e) => e.status === 'currently_watching').length ?? 0 };

  async function setStatus(e: WatchlistEntry, status: WatchlistStatus | 'watched') {
    if (status === 'watched') return setWatching(e);
    const prev = data;
    setData((d) => d?.map((x) => (x.id === e.id ? { ...x, status } : x)) ?? null); // optimistic
    try { await api.watchlist.setStatus(e.id, status); } catch (err) { setData(prev ?? null); toast((err as Error).message, 'error'); }
  }
  async function remove(e: WatchlistEntry) {
    const prev = data;
    setData((d) => d?.filter((x) => x.id !== e.id) ?? null); setDetail(null);
    try { await api.watchlist.remove(e.id); toast(`Removed ${e.movie.title}`, 'info'); } catch (err) { setData(prev ?? null); toast((err as Error).message, 'error'); }
  }

  return (
    <div>
      <PageHeader title="My Watchlist" subtitle={data ? `${data.length} movie${data.length === 1 ? '' : 's'} waiting for movie night` : undefined}
        action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add movie</Button>} />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs<Filter> value={filter} onChange={setFilter} tabs={[
          { id: 'all', label: 'All' }, { id: 'want_to_watch', label: `Want to Watch (${counts.want})` }, { id: 'currently_watching', label: `Watching (${counts.cur})` },
        ]} />
        <div className="flex flex-1 gap-2">
          <div className="flex-1"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter your watchlist…" icon={<Search className="h-4 w-4" />} aria-label="Filter watchlist" /></div>
          <Select value={sort} onChange={(e) => setSort(e.target.value as WatchlistSort)} aria-label="Sort" className="h-11">
            <option value="recent">Recently added</option><option value="title">Title A–Z</option><option value="release">Release year</option>
          </Select>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => reload()} />}
      {loading ? <PosterGridSkeleton /> : items.length === 0 ? (
        data?.length
          ? <EmptyState icon={<Search className="h-7 w-7" />} title="No matches" body="Try a different filter or search." />
          : <EmptyState icon={<Bookmark className="h-7 w-7" />} title="Your watchlist is empty" body="Search TMDB and save the movies you want to see." action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add your first movie</Button>} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((e) => (
            <article key={e.id} className="group flex flex-col rounded-2xl border border-line bg-surface/60 p-2.5 transition hover:border-amber/40 animate-fade-up">
              <button onClick={() => setDetail(e)} className="relative text-left">
                <Poster path={e.movie.poster_path} title={e.movie.title} />
                {e.status === 'currently_watching' && <Badge tone="amber" className="absolute left-2 top-2 backdrop-blur">Watching</Badge>}
              </button>
              <div className="mt-2.5 flex flex-1 flex-col gap-1.5 px-0.5">
                <p className="line-clamp-1 font-medium" title={e.movie.title}>{e.movie.title}</p>
                <p className="text-xs text-ink-muted">{releaseYear(e.movie.release_date)} · {e.movie.genres.slice(0, 2).join(', ') || '—'}</p>
                {e.recommender && <Badge tone="lavender" className="self-start">Recommended by @{e.recommender.username}</Badge>}
                <div className="mt-auto flex gap-1.5 pt-2">
                  <Select value={e.status} onChange={(ev) => setStatus(e, ev.target.value as WatchlistStatus | 'watched')} className="h-8 min-w-0 flex-1 px-2 text-xs" aria-label="Status">
                    <option value="want_to_watch">Want to Watch</option><option value="currently_watching">Currently Watching</option><option value="watched">Watched ✓</option>
                  </Select>
                  <Button size="sm" variant="lavender" onClick={() => setWatching(e)} aria-label="Mark as watched" title="Mark as watched"><Check className="h-4 w-4" /></Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.movie.title} wide>
        {detail && (
          <div className="flex flex-col gap-5 sm:flex-row">
            <Poster path={detail.movie.poster_path} title={detail.movie.title} size="w500" className="w-40 shrink-0 self-center sm:self-start" />
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">{releaseYear(detail.movie.release_date)}{detail.movie.runtime ? ` · ${detail.movie.runtime} min` : ''} · {statusLabel(detail.status)}</p>
              <div className="flex flex-wrap gap-1.5">{detail.movie.genres.map((g) => <Badge key={g}>{g}</Badge>)}</div>
              <p className="text-sm leading-relaxed">{detail.movie.overview ?? 'No overview available.'}</p>
              {detail.recommender && <Badge tone="lavender">Recommended by @{detail.recommender.username}</Badge>}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => { setWatching(detail); setDetail(null); }}><Eye className="h-4 w-4" /> Mark as Watched</Button>
                <Button variant="danger" onClick={() => remove(detail)}><Trash2 className="h-4 w-4" /> Remove</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <WatchedFormModal open={!!watching} onClose={() => setWatching(null)} title={`Mark “${watching?.movie.title ?? ''}” as watched`} submitLabel="Save to diary"
        onSubmit={async (v) => {
          await api.watchlist.markWatched(watching!.id, { watched_on: v.watched_on, rating: v.rating, note: v.note });
          setData((d) => d?.filter((x) => x.id !== watching!.id) ?? null);
          toast(`${watching!.movie.title} moved to your diary`);
        }} />
      <QuickAddModal open={adding} onClose={() => setAdding(false)} onChanged={() => reload(true)} />
    </div>
  );
}
