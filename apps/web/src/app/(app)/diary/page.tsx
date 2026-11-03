'use client';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDownUp, BookOpen, CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { calendarMonth, filterByRange, formatDate, groupByMonth, inMonth, MONTHS, type DiaryEntry, type Range } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { QuickAddModal } from '@/components/movies/QuickAddModal';
import { WatchedFormModal } from '@/components/movies/WatchedForm';
import { MovieCard, PosterGrid } from '@/components/movies/MovieCard';
import { Badge, Button, EmptyState, ErrorState, Input, Modal, PageHeader, Poster, PosterGridSkeleton, Select, StarRating, Tabs, useToast } from '@/components/ui';

type Scope = Range | 'custom';
type View = 'grid' | 'timeline' | 'calendar';
const PAGE = 36;

export default function DiaryPage() {
  const api = getApi();
  const toast = useToast();
  const now = new Date();
  const [scope, setScope] = useState<Scope>('all');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [asc, setAsc] = useState(false);
  const [view, setView] = useState<View>('grid');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<DiaryEntry | null>(null);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [rewatching, setRewatching] = useState<DiaryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [cal, setCal] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const { data, error, loading, reload, setData } = useAsync(() => api.diary.all(), []);

  const filtered = useMemo(() => {
    let r = data ?? [];
    if (scope === 'custom') r = r.filter((e) => inMonth(e.watched_on, year, month));
    else r = filterByRange(r, scope);
    if (search.trim()) r = r.filter((e) => e.title.toLowerCase().includes(search.trim().toLowerCase()));
    return asc ? [...r].reverse() : r; // data is sorted newest first
  }, [data, scope, month, year, search, asc]);

  const years = useMemo(() => {
    const ys = new Set((data ?? []).map((e) => Number(e.watched_on.slice(0, 4)))); ys.add(now.getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(e: DiaryEntry) {
    if (!confirm(`Delete this viewing of ${e.title}?`)) return;
    try { await api.diary.remove(e.id); setData((d) => d?.filter((x) => x.id !== e.id) ?? null); setOpen(null); toast('Entry deleted', 'info'); }
    catch (err) { toast((err as Error).message, 'error'); }
  }

  const shown = filtered.slice(0, limit);
  const cells = calendarMonth(data ?? [], cal.y, cal.m);

  return (
    <div>
      <PageHeader title="Watched Movies" subtitle="Your personal movie diary — every viewing, every memory."
        action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Log a movie</Button>} />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <Tabs<Scope> value={scope} onChange={(s) => { setScope(s); setLimit(PAGE); }} tabs={[
          { id: 'all', label: 'All' }, { id: 'week', label: 'This week' }, { id: 'month', label: 'This month' }, { id: 'year', label: 'This year' }, { id: 'custom', label: 'Pick month' },
        ]} />
        {scope === 'custom' && (
          <div className="flex gap-2">
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Month">{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">{years.map((y) => <option key={y}>{y}</option>)}</Select>
          </div>
        )}
      </div>
      <div className="mb-6 flex gap-2">
        <div className="flex-1"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your diary…" icon={<Search className="h-4 w-4" />} aria-label="Search diary" /></div>
        <Button variant="secondary" className="h-11" onClick={() => setAsc(!asc)} title="Sort by watched date"><ArrowDownUp className="h-4 w-4" /><span className="hidden sm:inline">{asc ? 'Oldest' : 'Newest'}</span></Button>
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {([['grid', LayoutGrid], ['timeline', List], ['calendar', CalendarDays]] as const).map(([v, Icon]) => (
            <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} className={clsx('rounded-lg p-2', view === v ? 'bg-surface-raised text-amber' : 'text-ink-muted hover:text-ink')}><Icon className="h-4 w-4" /></button>
          ))}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => reload()} />}
      {loading ? <PosterGridSkeleton /> : view === 'calendar' ? (
        <div className="rounded-3xl border border-line bg-surface/60 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCal(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))} aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></Button>
            <h3 className="font-heading text-lg font-semibold">{MONTHS[cal.m]} {cal.y}</h3>
            <Button variant="ghost" size="icon" onClick={() => setCal(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))} aria-label="Next month"><ChevronRight className="h-5 w-5" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-ink-muted">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="pb-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((c, i) => c ? (
              <button key={i} onClick={() => c.items[0] && setOpen(c.items[0])} disabled={!c.items.length}
                className={clsx('relative aspect-[3/4] overflow-hidden rounded-lg border text-left', c.items.length ? 'border-amber/40' : 'border-line/60 bg-bg/40')}>
                {c.items[0] && <Poster path={c.items[0].poster_path} title={c.items[0].title} size="w154" className="absolute inset-0 rounded-none ring-0" />}
                <span className={clsx('absolute left-1 top-1 rounded px-1 text-[10px] font-semibold', c.items.length ? 'bg-bg/80 text-amber' : 'text-ink-muted')}>{c.day}</span>
                {c.items.length > 1 && <span className="absolute bottom-1 right-1 rounded bg-lavender px-1 text-[10px] font-bold text-bg">+{c.items.length - 1}</span>}
              </button>
            ) : <div key={i} />)}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        data?.length ? <EmptyState icon={<Search className="h-7 w-7" />} title="Nothing in this period" body="Try another range or search term." />
          : <EmptyState icon={<BookOpen className="h-7 w-7" />} title="Start your movie diary" body="Mark a watchlist movie as watched, or log one you saw recently." action={<Button onClick={() => setAdding(true)}>Log a movie</Button>} />
      ) : view === 'grid' ? (
        <PosterGrid>{shown.map((e) => <MovieCard key={e.id} title={e.title} poster={e.poster_path} date={formatDate(e.watched_on)} rating={e.rating} onClick={() => setOpen(e)} />)}</PosterGrid>
      ) : (
        <div className="space-y-8">
          {groupByMonth(shown).map((g) => (
            <section key={g.key}>
              <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-widest text-lavender">{g.label} · {g.items.length}</h3>
              <ol className="relative space-y-3 border-l border-line pl-5">
                {g.items.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[26px] top-5 h-2.5 w-2.5 rounded-full bg-amber ring-4 ring-bg" />
                    <button onClick={() => setOpen(e)} className="flex w-full gap-3 rounded-2xl border border-line bg-surface/60 p-3 text-left hover:border-amber/40">
                      <Poster path={e.poster_path} title={e.title} size="w154" className="w-14 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-ink-muted">{formatDate(e.watched_on)}</p>
                        {e.rating ? <StarRating value={e.rating} size={13} /> : null}
                        {e.note && <p className="mt-1 line-clamp-2 text-xs italic text-ink-muted">“{e.note}”</p>}
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
      {view !== 'calendar' && filtered.length > limit && <div className="mt-8 flex justify-center"><Button variant="secondary" onClick={() => setLimit(limit + PAGE)}>Show more</Button></div>}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title} wide>
        {open && (() => {
          const views = (data ?? []).filter((x) => x.movie_id === open.movie_id).length;
          return (
            <div className="flex flex-col gap-5 sm:flex-row">
              <Poster path={open.poster_path} title={open.title} size="w500" className="w-40 shrink-0 self-center sm:self-start" />
              <div className="flex-1 space-y-3">
                <p className="text-sm text-ink-muted">Watched on <span className="text-ink">{formatDate(open.watched_on)}</span>{views > 1 && <> · seen {views}×</>}</p>
                <StarRating value={open.rating} size={22} />
                {open.movie?.genres?.length ? <div className="flex flex-wrap gap-1.5">{open.movie.genres.map((g) => <Badge key={g}>{g}</Badge>)}</div> : null}
                {open.recommender && <Badge tone="lavender">Recommended by @{open.recommender.username}</Badge>}
                <div className="rounded-2xl border border-line bg-bg/50 p-4 text-sm leading-relaxed">{open.note ? <span className="whitespace-pre-wrap">{open.note}</span> : <span className="text-ink-muted">No note for this viewing.</span>}</div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => { setEditing(open); setOpen(null); }}><Pencil className="h-4 w-4" /> Edit</Button>
                  <Button variant="lavender" onClick={() => { setRewatching(open); setOpen(null); }}><RotateCcw className="h-4 w-4" /> Log rewatch</Button>
                  <Button variant="danger" onClick={() => remove(open)}><Trash2 className="h-4 w-4" /> Delete</Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <WatchedFormModal open={!!editing} onClose={() => setEditing(null)} title={`Edit “${editing?.title ?? ''}”`}
        initial={editing ? { watched_on: editing.watched_on, rating: editing.rating, note: editing.note ?? '' } : undefined}
        onSubmit={async (v) => {
          await api.diary.update(editing!.id, { watched_on: v.watched_on, rating: v.rating, note: v.note.trim() || null });
          toast('Diary entry updated'); reload(true);
        }} />
      <WatchedFormModal open={!!rewatching} onClose={() => setRewatching(null)} title={`Rewatch “${rewatching?.title ?? ''}”`} submitLabel="Add viewing"
        onSubmit={async (v) => { await api.diary.rewatch(rewatching!, { watched_on: v.watched_on, rating: v.rating, note: v.note }); toast('Rewatch logged'); reload(true); }} />
      <QuickAddModal open={adding} onClose={() => setAdding(false)} onChanged={() => reload(true)} />
    </div>
  );
}
