'use client';
import { useState } from 'react';
import { BookmarkPlus, Check, Clapperboard } from 'lucide-react';
import { releaseYear, type Recommendation } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { Badge, Button, Poster, useToast } from '../ui';

/** Special movie card rendered inside a conversation. */
export function RecommendationCard({ rec, mine }: { rec: Recommendation; mine: boolean }) {
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'exists'>(rec.accepted_at ? 'added' : 'idle');
  async function add() {
    setState('busy');
    try {
      const r = await getApi().watchlist.addFromRecommendation(rec.id);
      setState(r.status);
      toast(r.status === 'exists' ? `${rec.movie.title} is already in your watchlist` : `Added to your watchlist · Recommended by @${rec.sender?.username}`, r.status === 'exists' ? 'info' : 'success');
    } catch (e) { setState('idle'); toast((e as Error).message, 'error'); }
  }
  return (
    <div className="w-72 max-w-full overflow-hidden rounded-2xl border border-amber/30 bg-gradient-to-br from-surface-raised to-surface shadow-card">
      <div className="flex items-center gap-1.5 border-b border-line/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-amber">
        <Clapperboard className="h-3.5 w-3.5" /> Movie recommendation
      </div>
      <div className="flex gap-3 p-3">
        <Poster path={rec.movie.poster_path} title={rec.movie.title} size="w154" className="w-20 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-heading font-semibold leading-tight">{rec.movie.title}</p>
          <p className="text-xs text-ink-muted">{releaseYear(rec.movie.release_date)}</p>
          <p className="text-xs text-lavender">{rec.movie.genres.slice(0, 2).join(' · ')}</p>
          <p className="text-[11px] text-ink-muted">from <span className="text-ink">@{rec.sender?.username}</span></p>
        </div>
      </div>
      {rec.message && <p className="mx-3 mb-3 rounded-xl bg-bg/50 p-2.5 text-sm italic">“{rec.message}”</p>}
      <div className="px-3 pb-3">
        {mine ? <Badge tone={rec.accepted_at ? 'success' : 'muted'}>{rec.accepted_at ? '✓ Added to their watchlist' : 'Sent'}</Badge>
          : state === 'added' || state === 'exists'
            ? <Button size="sm" variant="secondary" className="w-full" disabled><Check className="h-4 w-4" /> {state === 'added' ? 'In your watchlist' : 'Already in your watchlist'}</Button>
            : <Button size="sm" className="w-full" loading={state === 'busy'} onClick={add}><BookmarkPlus className="h-4 w-4" /> Add to Watchlist</Button>}
      </div>
    </div>
  );
}
