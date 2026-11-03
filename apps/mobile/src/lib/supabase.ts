import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { createCineLogApi, createTmdbService } from '@cinelog/shared';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseConfigured = Boolean(url && anon);

/** Same Supabase project as the web app → same accounts and data. Session persists in AsyncStorage. */
export const supabase = createClient(url ?? 'http://localhost:54321', anon ?? 'missing-anon-key', {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
});

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener('change', (s) => (s === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh()));

export const api = createCineLogApi(supabase, createTmdbService(supabase));
