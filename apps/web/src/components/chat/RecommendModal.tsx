'use client';
import { useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { releaseYear, type TmdbMovie } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { MovieSearch } from '../movies/MovieSearch';
import { Button, Modal, Poster, Textarea, useToast } from '../ui';

export function RecommendModal({ open, onClose, conversationId, toUsername, onSent }: {
  open: boolean; onClose: () => void; conversationId: string; toUsername: string; onSent: (messageId: string) => void;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState<TmdbMovie | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => { setPicked(null); setNote(''); onClose(); };
  async function send() {
    if (!picked) return;
    setBusy(true);
    try { const id = await getApi().recommendations.send(conversationId, picked, note); onSent(id); toast(`Recommended ${picked.title} to @${toUsername}`); close(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={close} title={picked ? 'Add a personal message' : `Recommend a movie to @${toUsername}`} wide>
      {!picked ? <MovieSearch onSelect={setPicked} /> : (
        <div className="space-y-4">
          <div className="flex gap-4 rounded-2xl border border-line bg-bg/40 p-3">
            <Poster path={picked.poster_path} title={picked.title} size="w154" className="w-20 shrink-0" />
            <div><p className="font-heading font-semibold">{picked.title}</p><p className="text-sm text-ink-muted">{releaseYear(picked.release_date)} · {picked.genres.slice(0, 3).join(', ')}</p>
              <p className="mt-1 line-clamp-3 text-xs text-ink-muted">{picked.overview}</p></div>
          </div>
          <Textarea label="Why should they watch it? (optional)" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Trust me on this one…" autoFocus />
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setPicked(null)}><ArrowLeft className="h-4 w-4" /> Pick another</Button>
            <Button onClick={send} loading={busy}><Send className="h-4 w-4" /> Send recommendation</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
