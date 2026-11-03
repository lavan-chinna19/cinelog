'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Tiny data hook: loading / error / data + reload, cancels stale responses. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    setError(null);
    try { const r = await fn(); if (id === seq.current) setData(r); }
    catch (e) { if (id === seq.current) setError((e as Error).message || 'Something went wrong'); }
    finally { if (id === seq.current) setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, setData, error, loading, reload: run };
}

export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
