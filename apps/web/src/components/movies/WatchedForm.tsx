'use client';
import { useEffect, useState } from 'react';
import { todayISO, validateNote } from '@cinelog/shared';
import { Button, Input, Modal, StarRating, Textarea } from '../ui';

export interface WatchedValues { watched_on: string; rating: number | null; note: string }

/** Date + rating + note form shared by Mark as Watched, Log, Rewatch and Edit entry. */
export function WatchedFormModal({ open, onClose, title, initial, submitLabel = 'Save', onSubmit }: {
  open: boolean; onClose: () => void; title: string; initial?: Partial<WatchedValues>; submitLabel?: string;
  onSubmit: (v: WatchedValues) => Promise<void>;
}) {
  const [v, setV] = useState<WatchedValues>({ watched_on: todayISO(), rating: null, note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setV({ watched_on: initial?.watched_on ?? todayISO(), rating: initial?.rating ?? null, note: initial?.note ?? '' }); setErr(null); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const noteErr = validateNote(v.note); if (noteErr) return setErr(noteErr);
    if (v.watched_on > todayISO()) return setErr('The watched date can’t be in the future.');
    setBusy(true); setErr(null);
    try { await onSubmit(v); onClose(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <Input type="date" label="Watched on" value={v.watched_on} max={todayISO()} onChange={(e) => setV({ ...v, watched_on: e.target.value })} required />
        <div className="space-y-1.5"><span className="text-sm text-ink-muted">Your rating</span><div><StarRating value={v.rating} onChange={(r) => setV({ ...v, rating: r })} size={28} /></div></div>
        <Textarea label="Personal note" rows={4} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="Where did you watch it? Who with? What stayed with you?" maxLength={4000} />
        {err && <p className="text-sm text-notify">{err}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy}>{submitLabel}</Button></div>
      </form>
    </Modal>
  );
}
