'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Browser client: anon key + user session cookie. Never the service-role key. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'missing-anon-key',
    );
  }
  return client;
}
