/**
 * Reusable TMDB service. Requests go through the `tmdb` Supabase Edge Function so the
 * TMDB credential never ships in client code. Image URLs are public CDN paths.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TmdbMovie } from './types';

export const TMDB_IMG = 'https://image.tmdb.org/t/p';
export type PosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';

export function posterUrl(path: string | null | undefined, size: PosterSize = 'w342'): string | null {
  return path ? `${TMDB_IMG}/${size}${path}` : null;
}
export function backdropUrl(path: string | null | undefined, size: 'w780' | 'w1280' | 'original' = 'w1280') {
  return path ? `${TMDB_IMG}/${size}${path}` : null;
}

/** TMDB's fixed movie genre ids (search results only return ids). */
export const TMDB_GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary',
  18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller',
  10752: 'War', 37: 'Western',
};

function normalise(r: any): TmdbMovie {
  return {
    tmdb_id: r.id,
    title: r.title ?? r.original_title ?? 'Untitled',
    release_date: r.release_date || null,
    poster_path: r.poster_path ?? null,
    backdrop_path: r.backdrop_path ?? null,
    overview: r.overview || null,
    genres: r.genres ? r.genres.map((g: any) => g.name) : (r.genre_ids ?? []).map((id: number) => TMDB_GENRES[id]).filter(Boolean),
    runtime: r.runtime ?? null,
  };
}

export class TmdbError extends Error {}

export function createTmdbService(supabase: SupabaseClient) {
  async function call<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('tmdb', { body });
    if (error) {
      let msg = 'Movie service is unavailable right now.';
      try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* ignore */ }
      throw new TmdbError(msg);
    }
    if ((data as any)?.error) throw new TmdbError((data as any).error);
    return data as T;
  }

  return {
    async search(query: string, page = 1) {
      const q = query.trim();
      if (!q) return { items: [] as TmdbMovie[], page: 1, hasMore: false };
      const data = await call<any>({ action: 'search', query: q, page });
      return {
        items: (data.results ?? []).map(normalise) as TmdbMovie[],
        page: data.page ?? page,
        hasMore: (data.page ?? 1) < (data.total_pages ?? 1),
      };
    },
    async details(tmdbId: number): Promise<TmdbMovie> {
      return normalise(await call<any>({ action: 'details', id: tmdbId }));
    },
    async trending(): Promise<TmdbMovie[]> {
      const data = await call<any>({ action: 'trending' });
      return (data.results ?? []).map(normalise);
    },
  };
}
export type TmdbService = ReturnType<typeof createTmdbService>;
