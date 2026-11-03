// Log in with username OR email + password.
// Supabase Auth signs in by email, so for a username we resolve the email
// server-side with the service role (never exposed to clients) and return the
// session. The client then calls supabase.auth.setSession(session).
// Errors are deliberately generic so the endpoint can't be used to enumerate users.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const anon = () => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { identifier, password } = await req.json().catch(() => ({}));
  const id = String(identifier ?? '').trim();
  if (!id || typeof password !== 'string' || password.length < 1 || id.length > 254) {
    return json({ error: 'Invalid login credentials' }, 400);
  }

  let email = id;
  if (!id.includes('@')) {
    const { data: profile } = await admin.from('profiles').select('id').eq('username', id).maybeSingle();
    if (!profile) return json({ error: 'Invalid login credentials' }, 401);
    const { data: user } = await admin.auth.admin.getUserById(profile.id);
    if (!user?.user?.email) return json({ error: 'Invalid login credentials' }, 401);
    email = user.user.email;
  }

  const { data, error } = await anon().auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    const msg = error?.message?.toLowerCase().includes('confirm')
      ? 'Please confirm your email before logging in.'
      : 'Invalid login credentials';
    return json({ error: msg }, 401);
  }
  return json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
});
