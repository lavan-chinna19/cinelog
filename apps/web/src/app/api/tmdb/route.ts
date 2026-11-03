// TMDB proxy on Vercel. Keeps the TMDB credential server-side and reads it from
// the Vercel environment variables:
//   API_Read_Access_Token  (TMDB v4 "API Read Access Token", sent as Bearer)  – preferred
//   API_Key                (TMDB v3 "API Key", sent as ?api_key=)              – fallback
// Only signed-in CineLog users may call it (cookie session on web, Bearer JWT from mobile).
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BASE = 'https://api.themoviedb.org/3';

function creds() {
  return {
    readToken: process.env.API_Read_Access_Token?.trim() || process.env.TMDB_READ_TOKEN?.trim(),
    apiKey: process.env.API_Key?.trim() || process.env.TMDB_API_KEY?.trim(),
  };
}

async function tmdb(path: string, params: Record<string, string | number> = {}) {
  const { readToken, apiKey } = creds();
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('language', 'en-US');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (readToken) headers.Authorization = `Bearer ${readToken}`;
  else if (apiKey) url.searchParams.set('api_key', apiKey);
  let res = await fetch(url, { headers, next: { revalidate: path.startsWith('/search') ? 0 : 3600 } });
  // If the read token is rejected but a v3 key exists, retry with the key.
  if (res.status === 401 && readToken && apiKey) {
    url.searchParams.set('api_key', apiKey);
    res = await fetch(url, { headers: { accept: 'application/json' } });
  }
  if (!res.ok) throw new Error(res.status === 401 ? 'TMDB rejected the API credentials.' : `TMDB error ${res.status}`);
  return res.json();
}

async function signedIn(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data } = await sb.auth.getUser(bearer);
    if (data.user) return true;
  }
  const { data } = await (await getServerSupabase()).auth.getUser();
  return Boolean(data.user);
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: cors });

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors }); }

export async function POST(req: NextRequest) {
  const { readToken, apiKey } = creds();
  if (!readToken && !apiKey) return json({ error: 'TMDB is not configured. Set API_Read_Access_Token (or API_Key) in Vercel.' }, 503);
  if (!(await signedIn(req))) return json({ error: 'Please log in.' }, 401);
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
      case 'trending': return json(await tmdb('/trending/movie/week'));
      case 'genres': return json(await tmdb('/genre/movie/list'));
      default: return json({ error: 'Unknown action' }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
