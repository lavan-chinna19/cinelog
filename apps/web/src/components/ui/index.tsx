'use client';
import clsx from 'clsx';
import Image from 'next/image';
import { Film, Loader2, Star, X } from 'lucide-react';
import { createContext, forwardRef, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { posterUrl, type PosterSize } from '@cinelog/shared';

// ───────────────────────── Button ─────────────────────────
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'lavender';
const variants: Record<Variant, string> = {
  primary: 'bg-amber text-bg hover:brightness-110 shadow-[0_8px_24px_-10px_rgba(240,163,94,.7)]',
  secondary: 'bg-surface-raised text-ink border border-line hover:border-ink-muted/60',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-raised',
  danger: 'bg-notify/10 text-notify border border-notify/30 hover:bg-notify/20',
  lavender: 'bg-lavender/15 text-lavender border border-lavender/30 hover:bg-lavender/25',
};
export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: 'sm' | 'md' | 'lg' | 'icon'; loading?: boolean;
}>(function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} disabled={disabled || loading}
      className={clsx('inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/60',
        size === 'sm' && 'h-8 px-3 text-sm', size === 'md' && 'h-10 px-4 text-sm', size === 'lg' && 'h-12 px-6 text-base',
        size === 'icon' && 'h-10 w-10', variants[variant], className)} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  );
});

// ───────────────────────── Inputs ─────────────────────────
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string | null; icon?: ReactNode }>(
  function Input({ label, error, icon, className, id, ...rest }, ref) {
    const inputId = id ?? rest.name;
    return (
      <label className="block space-y-1.5" htmlFor={inputId}>
        {label && <span className="text-sm text-ink-muted">{label}</span>}
        <div className="relative">
          {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">{icon}</span>}
          <input ref={ref} id={inputId}
            className={clsx('h-11 w-full rounded-xl border bg-bg/60 px-3.5 text-sm text-ink placeholder:text-ink-muted/60 transition focus:outline-none focus:ring-2 focus:ring-amber/40',
              error ? 'border-notify/60' : 'border-line focus:border-amber/60', icon && 'pl-10', className)} {...rest} />
        </div>
        {error && <span className="text-xs text-notify">{error}</span>}
      </label>
    );
  });

export function Textarea({ label, className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm text-ink-muted">{label}</span>}
      <textarea className={clsx('w-full rounded-xl border border-line bg-bg/60 p-3.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-amber/60 focus:outline-none focus:ring-2 focus:ring-amber/40', className)} {...rest} />
    </label>
  );
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx('h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-amber/60 focus:outline-none', className)} {...rest}>{children}</select>
  );
}

// ───────────────────────── Modal ─────────────────────────
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-card animate-scale-in sm:rounded-3xl sm:p-6', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-raised hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ───────────────────────── Loading / empty ─────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('relative overflow-hidden rounded-xl bg-surface-raised/70 before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent', className)} />;
}
export function PosterGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (<div key={i} className="space-y-2"><Skeleton className="aspect-[2/3]" /><Skeleton className="h-3 w-3/4" /></div>))}
    </div>
  );
}
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-3">{Array.from({ length: rows }).map((_, i) => (
    <div key={i} className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-2/3" /></div></div>))}</div>;
}
export function Spinner({ className }: { className?: string }) { return <Loader2 className={clsx('h-5 w-5 animate-spin text-amber', className)} />; }

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface/40 px-6 py-14 text-center animate-fade-up">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber/20 to-lavender/20 text-amber ring-1 ring-line">
        {icon ?? <Film className="h-7 w-7" />}
      </div>
      <h3 className="font-heading text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-notify/30 bg-notify/5 p-4 text-sm text-notify">
      {message} {onRetry && <button className="ml-2 underline" onClick={onRetry}>Retry</button>}
    </div>
  );
}

// ───────────────────────── Avatar / poster / rating ─────────────────────────
export function Avatar({ url, name, size = 40, online }: { url?: string | null; name?: string; size?: number; online?: boolean }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {url
        ? <Image src={url} alt={name ?? ''} width={size} height={size} className="h-full w-full rounded-full object-cover ring-1 ring-line" />
        : <span className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-lavender/40 to-amber/40 font-heading font-semibold text-ink ring-1 ring-line" style={{ fontSize: size * 0.4 }}>
            {(name ?? '?').slice(0, 1).toUpperCase()}
          </span>}
      {online !== undefined && <span className={clsx('absolute bottom-0 right-0 rounded-full ring-2 ring-bg', online ? 'bg-success' : 'bg-line')} style={{ width: size * 0.28, height: size * 0.28 }} />}
    </span>
  );
}

export function Poster({ path, title, size = 'w342', className, priority }: { path: string | null | undefined; title: string; size?: PosterSize; className?: string; priority?: boolean }) {
  const src = posterUrl(path, size);
  return (
    <div className={clsx('relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-raised ring-1 ring-line', className)}>
      {src
        ? <Image src={src} alt={title} fill sizes="(max-width: 640px) 33vw, (max-width: 1280px) 20vw, 16vw" className="object-cover" priority={priority} loading={priority ? undefined : 'lazy'} />
        : <div className="grid h-full w-full place-items-center p-2 text-center text-xs text-ink-muted"><div><Film className="mx-auto mb-1 h-6 w-6" />{title}</div></div>}
    </div>
  );
}

export function StarRating({ value, onChange, size = 20 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(null)} role={onChange ? 'radiogroup' : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onMouseEnter={() => onChange && setHover(n)} onClick={() => onChange?.(value === n ? null : n)}
          className={clsx('transition-transform', onChange && 'hover:scale-110')}>
          <Star style={{ width: size, height: size }} className={n <= shown ? 'fill-amber text-amber' : 'text-line'} />
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = 'muted', className }: { children: ReactNode; tone?: 'muted' | 'amber' | 'lavender' | 'success' | 'notify'; className?: string }) {
  const tones = {
    muted: 'bg-surface-raised text-ink-muted border-line',
    amber: 'bg-amber/10 text-amber border-amber/30',
    lavender: 'bg-lavender/10 text-lavender border-lavender/30',
    success: 'bg-success/10 text-success border-success/30',
    notify: 'bg-notify text-white border-notify',
  };
  return <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', tones[tone], className)}>{children}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface/60 p-1 no-scrollbar">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={clsx('flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition',
            value === t.id ? 'bg-surface-raised text-ink shadow-card' : 'text-ink-muted hover:text-ink')}>
          {t.label}{!!t.count && <span className="rounded-full bg-notify px-1.5 text-[10px] text-white">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ───────────────────────── Toasts ─────────────────────────
type Toast = { id: number; text: string; tone: 'success' | 'error' | 'info' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} className={clsx('pointer-events-auto rounded-xl border px-4 py-2.5 text-sm shadow-card animate-fade-up backdrop-blur',
            t.tone === 'success' && 'border-success/40 bg-success/15 text-ink', t.tone === 'error' && 'border-notify/40 bg-notify/15 text-ink',
            t.tone === 'info' && 'border-lavender/40 bg-lavender/15 text-ink')}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
