import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** loading/error/data + reload; optionally reloads whenever the screen regains focus. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = [], { refetchOnFocus = true } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);
  const first = useRef(true);
  const run = useCallback(async (mode: 'load' | 'silent' | 'refresh' = 'load') => {
    const id = ++seq.current;
    if (mode === 'load') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try { const r = await fn(); if (id === seq.current) setData(r); }
    catch (e) { if (id === seq.current) setError((e as Error).message); }
    finally { if (id === seq.current) { setLoading(false); setRefreshing(false); } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  useFocusEffect(useCallback(() => { if (first.current) { first.current = false; return; } if (refetchOnFocus) run('silent'); }, [run, refetchOnFocus]));
  return { data, setData, error, loading, refreshing, reload: run };
}

export function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
