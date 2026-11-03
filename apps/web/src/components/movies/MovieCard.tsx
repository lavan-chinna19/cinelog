'use client';
import { releaseYear } from '@cinelog/shared';
import type { ReactNode } from 'react';
import { Poster, StarRating } from '../ui';

export function MovieCard({ title, poster, date, rating, footer, onClick, badge }: {
  title: string; poster: string | null; date?: string | null; rating?: number | null; footer?: ReactNode; onClick?: () => void; badge?: ReactNode;
}) {
  return (
    <div className="group animate-fade-up">
      <button type="button" onClick={onClick} className="relative block w-full text-left transition-transform duration-300 group-hover:-translate-y-1">
        <Poster path={poster} title={title} className="shadow-card transition-shadow group-hover:shadow-glow" />
        {badge && <div className="absolute left-2 top-2">{badge}</div>}
      </button>
      <div className="mt-2 space-y-0.5">
        <p className="line-clamp-1 text-sm font-medium" title={title}>{title}</p>
        <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
          <span>{date ? (date.length > 4 ? date : releaseYear(date)) : ''}</span>
          {rating ? <StarRating value={rating} size={11} /> : null}
        </div>
        {footer}
      </div>
    </div>
  );
}

export function PosterGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 xl:grid-cols-6">{children}</div>;
}
