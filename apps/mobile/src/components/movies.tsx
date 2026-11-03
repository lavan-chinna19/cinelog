import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { colors, formatDate, parseISODate, releaseYear, todayISO, toISODate, validateNote, type Recommendation, type TmdbMovie } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { useDebounced } from '@/lib/hooks';
import { useToast } from './toast';
import { Badge, Button, Card, Empty, ErrorText, Field, Poster, Sheet, Skeleton, Stars, T } from './ui';

export function MovieTile({ title, poster, sub, rating, onPress, badge }: { title: string; poster: string | null; sub?: string; rating?: number | null; onPress?: () => void; badge?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: '31%', gap: 6 }, pressed && { opacity: 0.8 }]}>
      <View>
        <Poster path={poster} size="w185" />
        {badge && <View style={{ position: 'absolute', top: 6, left: 6 }}><Badge text={badge} tone="lavender" /></View>}
      </View>
      <T numberOfLines={1} style={{ fontSize: 13, fontFamily: 'Inter_500Medium' }}>{title}</T>
      {sub ? <T v="small" numberOfLines={1}>{sub}</T> : null}
      {rating ? <Stars value={rating} size={10} /> : null}
    </Pressable>
  );
}
export function Grid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-start' }}>{children}</View>;
}

/** Debounced TMDB search list with pagination. */
export function MovieSearch({ renderAction, onSelect }: { renderAction?: (m: TmdbMovie) => ReactNode; onSelect?: (m: TmdbMovie) => void }) {
  const [q, setQ] = useState('');
  const query = useDebounced(q);
  const [items, setItems] = useState<TmdbMovie[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    if (!query.trim()) { setItems([]); setHasMore(false); return; }
    setLoading(true); setError(null);
    api.tmdb!.search(query).then((r) => { if (!off) { setItems(r.items); setPage(1); setHasMore(r.hasMore); } })
      .catch((e) => !off && setError(e.message)).finally(() => !off && setLoading(false));
    return () => { off = true; };
  }, [query]);

  async function more() {
    setLoading(true);
    try { const r = await api.tmdb!.search(query, page + 1); setItems((x) => [...x, ...r.items]); setPage(page + 1); setHasMore(r.hasMore); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  return (
    <View style={{ gap: 12 }}>
      <Field value={q} onChangeText={setQ} placeholder="Search movies by title…" icon="search" autoFocus autoCorrect={false} returnKeyType="search" />
      {error && <ErrorText msg={error} />}
      {!q.trim() && <T v="muted" style={{ textAlign: 'center', paddingVertical: 16 }}>Start typing to search TMDB.</T>}
      {q.trim() && !loading && !error && q === query && !items.length && <Empty icon="search" title="No matches" body={`Nothing found for “${q}”.`} />}
      {items.map((m) => (
        <Pressable key={m.tmdb_id} onPress={() => onSelect?.(m)} style={{ flexDirection: 'row', gap: 12, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }}>
          <Poster path={m.poster_path} size="w154" width={64} radius={10} />
          <View style={{ flex: 1, gap: 3 }}>
            <T style={{ fontFamily: 'Inter_600SemiBold' }}>{m.title} <T v="muted">({releaseYear(m.release_date)})</T></T>
            <T v="small" style={{ color: colors.lavender }}>{m.genres.slice(0, 3).join(' · ')}</T>
            <T v="small" numberOfLines={2}>{m.overview ?? 'No overview.'}</T>
            {renderAction && <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>{renderAction(m)}</View>}
          </View>
        </Pressable>
      ))}
      {loading && [0, 1, 2].map((i) => <Skeleton key={i} h={96} r={16} />)}
      {hasMore && !loading && <Button title="Load more" variant="secondary" onPress={more} />}
    </View>
  );
}

export interface WatchedValues { watched_on: string; rating: number | null; note: string }

/** Date / rating / note sheet used for mark-watched, log, rewatch and edit. */
export function WatchedSheet({ visible, onClose, title, initial, submitLabel = 'Save', onSubmit }: {
  visible: boolean; onClose: () => void; title: string; initial?: Partial<WatchedValues>; submitLabel?: string; onSubmit: (v: WatchedValues) => Promise<void>;
}) {
  const [v, setV] = useState<WatchedValues>({ watched_on: todayISO(), rating: null, note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (visible) { setV({ watched_on: initial?.watched_on ?? todayISO(), rating: initial?.rating ?? null, note: initial?.note ?? '' }); setErr(null); } }, [visible]); // eslint-disable-line
  const shift = (days: number) => { const d = parseISODate(v.watched_on); d.setDate(d.getDate() + days); const iso = toISODate(d); if (iso <= todayISO()) setV({ ...v, watched_on: iso }); };
  async function submit() {
    const e = validateNote(v.note); if (e) return setErr(e);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.watched_on)) return setErr('Use the format YYYY-MM-DD');
    if (v.watched_on > todayISO()) return setErr('The date can’t be in the future');
    setBusy(true); setErr(null);
    try { await onSubmit(v); onClose(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <T v="muted">Watched on</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Button small variant="secondary" icon="chevron-back" onPress={() => shift(-1)} />
        <View style={{ flex: 1 }}><Field value={v.watched_on} onChangeText={(s) => setV({ ...v, watched_on: s })} keyboardType="numbers-and-punctuation" maxLength={10} style={{ textAlign: 'center' }} /></View>
        <Button small variant="secondary" icon="chevron-forward" onPress={() => shift(1)} disabled={v.watched_on >= todayISO()} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small variant={v.watched_on === todayISO() ? 'lavender' : 'ghost'} title="Today" onPress={() => setV({ ...v, watched_on: todayISO() })} />
        <Button small variant="ghost" title="Yesterday" onPress={() => { const d = new Date(); d.setDate(d.getDate() - 1); setV({ ...v, watched_on: toISODate(d) }); }} />
        <T v="small" style={{ alignSelf: 'center', marginLeft: 'auto' }}>{/^\d{4}-\d{2}-\d{2}$/.test(v.watched_on) ? formatDate(v.watched_on) : ''}</T>
      </View>
      <T v="muted">Your rating</T>
      <Stars value={v.rating} onChange={(r) => setV({ ...v, rating: r })} size={32} />
      <Field label="Personal note" value={v.note} onChangeText={(s) => setV({ ...v, note: s })} multiline maxLength={4000} placeholder="What stayed with you?" style={{ minHeight: 100, textAlignVertical: 'top' }} />
      {err && <T style={{ color: colors.notify }}>{err}</T>}
      <Button title={submitLabel} onPress={submit} loading={busy} />
    </Sheet>
  );
}

export function QuickAddSheet({ visible, onClose, onChanged }: { visible: boolean; onClose: () => void; onChanged?: () => void }) {
  const toast = useToast();
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const [logging, setLogging] = useState<TmdbMovie | null>(null);
  async function add(m: TmdbMovie) {
    setBusy(m.tmdb_id);
    try { const r = await api.watchlist.add(m); setAdded((s) => new Set(s).add(m.tmdb_id)); toast(r.status === 'exists' ? 'Already in your watchlist' : `Added ${m.title}`, r.status === 'exists' ? 'info' : 'success'); onChanged?.(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(null); }
  }
  return (
    <>
      <Sheet visible={visible && !logging} onClose={onClose} title="Quick Add Movie">
        <MovieSearch renderAction={(m) => <>
          <Button small icon={added.has(m.tmdb_id) ? 'checkmark' : 'bookmark-outline'} title={added.has(m.tmdb_id) ? 'Added' : 'Watchlist'} variant={added.has(m.tmdb_id) ? 'secondary' : 'primary'}
            loading={busy === m.tmdb_id} disabled={added.has(m.tmdb_id)} onPress={() => add(m)} />
          <Button small icon="eye-outline" title="Watched" variant="lavender" onPress={() => setLogging(m)} />
        </>} />
      </Sheet>
      <WatchedSheet visible={!!logging} onClose={() => setLogging(null)} title={`Log “${logging?.title ?? ''}”`} submitLabel="Add to diary"
        onSubmit={async (v) => { await api.diary.log(logging!, v); toast(`${logging!.title} added to your diary`); onChanged?.(); }} />
    </>
  );
}

export function RecommendationCard({ rec, mine }: { rec: Recommendation; mine: boolean }) {
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'exists'>(rec.accepted_at ? 'added' : 'idle');
  async function add() {
    setState('busy');
    try { const r = await api.watchlist.addFromRecommendation(rec.id); setState(r.status); toast(r.status === 'exists' ? 'Already in your watchlist' : `Added · Recommended by @${rec.sender?.username}`, r.status === 'exists' ? 'info' : 'success'); }
    catch (e) { setState('idle'); toast((e as Error).message, 'error'); }
  }
  return (
    <Card style={{ width: 270, padding: 0, overflow: 'hidden', borderColor: 'rgba(240,163,94,.35)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
        <Ionicons name="film" size={13} color={colors.amber} /><T v="small" style={{ color: colors.amber, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 }}>MOVIE RECOMMENDATION</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, padding: 12 }}>
        <Poster path={rec.movie.poster_path} size="w154" width={70} radius={8} />
        <View style={{ flex: 1, gap: 3 }}>
          <T v="h3">{rec.movie.title}</T>
          <T v="small">{releaseYear(rec.movie.release_date)}</T>
          <T v="small" style={{ color: colors.lavender }}>{rec.movie.genres.slice(0, 2).join(' · ')}</T>
          <T v="small">from <T v="small" style={{ color: colors.text }}>@{rec.sender?.username}</T></T>
        </View>
      </View>
      {rec.message ? <View style={{ marginHorizontal: 12, marginBottom: 12, padding: 10, borderRadius: 12, backgroundColor: 'rgba(16,19,31,.6)' }}><T style={{ fontStyle: 'italic', fontSize: 14 }}>“{rec.message}”</T></View> : null}
      <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        {mine ? <Badge text={rec.accepted_at ? '✓ Added to their watchlist' : 'Sent'} tone={rec.accepted_at ? 'success' : 'muted'} />
          : state === 'added' || state === 'exists' ? <Button small variant="secondary" icon="checkmark" title={state === 'added' ? 'In your watchlist' : 'Already in watchlist'} disabled />
          : <Button small icon="bookmark-outline" title="Add to Watchlist" loading={state === 'busy'} onPress={add} />}
      </View>
    </Card>
  );
}

export function RecommendSheet({ visible, onClose, conversationId, toUsername, onSent }: { visible: boolean; onClose: () => void; conversationId: string; toUsername: string; onSent: (id: string) => void }) {
  const toast = useToast();
  const [picked, setPicked] = useState<TmdbMovie | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => { setPicked(null); setNote(''); onClose(); };
  async function send() {
    setBusy(true);
    try { const id = await api.recommendations.send(conversationId, picked!, note); onSent(id); toast(`Recommended ${picked!.title}`); close(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Sheet visible={visible} onClose={close} title={picked ? 'Add a message' : `Recommend to @${toUsername}`}>
      {!picked ? <MovieSearch onSelect={setPicked} /> : <>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Poster path={picked.poster_path} size="w154" width={80} />
          <View style={{ flex: 1, gap: 4 }}><T v="h3">{picked.title}</T><T v="muted">{releaseYear(picked.release_date)} · {picked.genres.slice(0, 2).join(', ')}</T><T v="small" numberOfLines={4}>{picked.overview}</T></View>
        </View>
        <Field label="Why should they watch it? (optional)" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="Trust me on this one…" style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button variant="ghost" title="Back" icon="arrow-back" onPress={() => setPicked(null)} />
          <Button style={{ flex: 1 }} title="Send recommendation" icon="send" loading={busy} onPress={send} />
        </View>
      </>}
    </Sheet>
  );
}

/** Tap-to-inspect bar chart (no native chart dependency). */
export function BarChart({ data, color = colors.amber, height = 150 }: { data: { label: string; count: number }[]; color?: string; height?: number }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const showEvery = data.length > 14 ? Math.ceil(data.length / 7) : 1;
  return (
    <View>
      <T v="small" style={{ height: 16, color: colors.text }}>{sel !== null ? `${data[sel].label}: ${data[sel].count} movie${data[sel].count === 1 ? '' : 's'}` : 'Tap a bar'}</T>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: data.length > 14 ? 2 : 6, marginTop: 6 }}>
        {data.map((d, i) => (
          <Pressable key={i} onPress={() => setSel(i)} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
            <View style={{ height: `${Math.max(2, (d.count / max) * 100)}%`, backgroundColor: sel === i ? colors.lavender : d.count ? color : colors.border, borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: data.length > 14 ? 2 : 6, marginTop: 6 }}>
        {data.map((d, i) => <T key={i} v="small" style={{ flex: 1, textAlign: 'center', fontSize: 9 }} numberOfLines={1}>{i % showEvery === 0 ? d.label : ''}</T>)}
      </View>
    </View>
  );
}

export function Loading() { return <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={colors.amber} /></View>; }
