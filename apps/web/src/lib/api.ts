'use client';
import { createCineLogApi, createTmdbService, type CineLogApi } from '@cinelog/shared';
import { getSupabase } from './supabase/client';

let api: CineLogApi | null = null;
export function getApi(): CineLogApi {
  if (!api) {
    const sb = getSupabase();
    api = createCineLogApi(sb, createTmdbService(sb));
  }
  return api;
}
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
