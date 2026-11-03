import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback'];
const AUTH_ONLY = ['/login', '/signup'];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return res;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options?: CookieOptions }[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  // Refreshes the session cookie (persistent login) and validates the JWT server-side.
  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;

  if (!user && !PUBLIC.includes(path)) {
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  if (user && (AUTH_ONLY.includes(path) || path === '/')) {
    const url = req.nextUrl.clone(); url.pathname = '/home'; url.search = '';
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)'] };
