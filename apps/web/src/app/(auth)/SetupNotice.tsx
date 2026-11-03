'use client';
import { supabaseConfigured } from '@/lib/supabase/client';
export function SetupNotice() {
  if (supabaseConfigured) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber/40 bg-amber/10 p-3 text-xs text-amber">
      Supabase isn&apos;t configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to apps/web/.env.local (see README).
    </div>
  );
}
