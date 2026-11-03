'use client';
import { useState } from 'react';
import { BookmarkPlus, Check, Eye } from 'lucide-react';
import type { TmdbMovie } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { Button, Modal, useToast } from '../ui';
import { WatchedFormModal } from './WatchedForm';
import { MovieSearch } from './MovieSearch';

export function QuickAddModal({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged?: () => void }) {
  const api = getApi();
  const toast = useToast();
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const [logging, setLogging] = useState<TmdbMovie | null>(null);

  async function add(m: TmdbMovie) {
    setBusy(m.tmdb_id);
    try {
      const r = await api.watchlist.add(m);
      setAdded((s) => new Set(s).add(m.tmdb_id));
      toast(r.status === 'exists' ? `${m.title} is already in your watchlist` : `Added ${m.title} to your watchlist`, r.status === 'exists' ? 'info' : 'success');
      onChanged?.();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(null); }
  }

  return (
    <>
      <Modal open={open && !logging} onClose={onClose} title="Quick Add Movie" wide>
        <MovieSearch renderAction={(m) => (
          <>
            <Button size="sm" variant={added.has(m.tmdb_id) ? 'secondary' : 'primary'} loading={busy === m.tmdb_id} onClick={() => add(m)} disabled={added.has(m.tmdb_id)}>
              {added.has(m.tmdb_id) ? <><Check className="h-4 w-4" /> In watchlist</> : <><BookmarkPlus className="h-4 w-4" /> Watchlist</>}
            </Button>
            <Button size="sm" variant="lavender" onClick={() => setLogging(m)}><Eye className="h-4 w-4" /> Log as watched</Button>
          </>
        )} />
      </Modal>
      <WatchedFormModal open={!!logging} onClose={() => setLogging(null)} title={`Log “${logging?.title ?? ''}”`} submitLabel="Add to diary"
        onSubmit={async (v) => {
          await api.diary.log(logging!, { watched_on: v.watched_on, rating: v.rating, note: v.note });
          toast(`${logging!.title} added to your diary`); onChanged?.();
        }} />
    </>
  );
}
