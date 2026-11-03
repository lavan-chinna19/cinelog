import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

/** Email confirmation + password-recovery links land here (PKCE code exchange). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/home';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/home';
  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
