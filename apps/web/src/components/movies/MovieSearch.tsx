'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { releaseYear, type TmdbMovie } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { useDebounced } from '@/lib/useAsync';
import { Button, EmptyState, ErrorState, Input, Poster, Skeleton } from '../ui';

/** TMDB search with debounced input, pagination, loading/error/empty states. */
export function MovieSearch({ renderAction, onSelect, selectedId, autoFocus = true }: {
  renderAction?: (m: TmdbMovie) => ReactNode; onSelect?: (m: TmdbMovie) => void; selectedId?: number; autoFocus?: boolean;
}) {
  const api = getApi();
  const [q, setQ] = useState('');
  const query = useDebounced(q, 400);
  const [items, setItems] = useState<TmdbMovie[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!query.trim()) { setItems([]); setHasMore(false); return; }
    setLoading(true); setError(null);
    api.tmdb!.search(query, 1)
      .then((r) => { if (!cancelled) { setItems(r.items); setPage(1); setHasMore(r.hasMore); } })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [query, api]);

  async function more() {
    setLoading(true);
    try { const r = await api.tmdb!.search(query, page + 1); setItems((x) => [...x, ...r.items]); setPage(page + 1); setHasMore(r.hasMore); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search movies by title…" icon={<Search className="h-4 w-4" />} aria-label="Search movies" />
      {error && <ErrorState message={error} />}
      {!q.trim() && <p className="py-6 text-center text-sm text-ink-muted">Start typing to search millions of movies from TMDB.</p>}
      {q.trim() && !loading && !error && query === q && items.length === 0 && <EmptyState icon={<Search className="h-7 w-7" />} title="No matches" body={`Nothing found for “${q}”. Try another title.`} />}
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.tmdb_id}
            onClick={() => onSelect?.(m)}
            className={`flex gap-3 rounded-2xl border p-2.5 transition ${onSelect ? 'cursor-pointer hover:border-amber/50' : ''} ${selectedId === m.tmdb_id ? 'border-amber bg-amber/5' : 'border-line bg-bg/40'}`}>
            <Poster path={m.poster_path} title={m.title} size="w154" className="w-16 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-tight">{m.title} <span className="font-normal text-ink-muted">({releaseYear(m.release_date)})</span></p>
              <p className="mt-0.5 text-xs text-lavender">{m.genres.slice(0, 3).join(' · ')}</p>
              <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{m.overview ?? 'No overview available.'}</p>
              {renderAction && <div className="mt-2 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>{renderAction(m)}</div>}
            </div>
          </li>
        ))}
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <li key={`s${i}`} className="flex gap-3 rounded-2xl border border-line p-2.5"><Skeleton className="h-24 w-16" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div></li>
        ))}
      </ul>
      {hasMore && !loading && <Button variant="secondary" className="w-full" onClick={more}>Load more</Button>}
    </div>
  );
}
