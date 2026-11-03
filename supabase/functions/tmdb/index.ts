// TMDB proxy — keeps the TMDB credential server-side. Both apps call this with
// the signed-in user's JWT:  supabase.functions.invoke('tmdb', { body: {...} })
//
//   { action: 'search',  query: string, page?: number }
//   { action: 'details', id: number }
//   { action: 'trending' }
//   { action: 'genres' }
import { corsHeaders, json } from '../_shared/cors.ts';

const BASE = 'https://api.themoviedb.org/3';
const READ_TOKEN = Deno.env.get('API_Read_Access_Token') ?? Deno.env.get('TMDB_READ_TOKEN');
const API_KEY = Deno.env.get('API_Key') ?? Deno.env.get('TMDB_API_KEY');

async function tmdb(path: string, params: Record<string, string | number> = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('language', 'en-US');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (READ_TOKEN) headers.Authorization = `Bearer ${READ_TOKEN}`;
  else if (API_KEY) url.searchParams.set('api_key', API_KEY);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!READ_TOKEN && !API_KEY) {
    return json({ error: 'TMDB is not configured. Run: supabase secrets set API_Read_Access_Token=...' }, 503);
  }
  try {
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case 'search': {
        const query = String(body.query ?? '').trim().slice(0, 100);
        if (!query) return json({ results: [], page: 1, total_pages: 0 });
        const page = Math.min(Math.max(Number(body.page) || 1, 1), 500);
        return json(await tmdb('/search/movie', { query, page, include_adult: 'false' }));
      }
      case 'details': {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id <= 0) return json({ error: 'Invalid id' }, 400);
        return json(await tmdb(`/movie/${id}`));
      }
      case 'trending':
        return json(await tmdb('/trending/movie/week'));
      case 'genres':
        return json(await tmdb('/genre/movie/list'));
      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
