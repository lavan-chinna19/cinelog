'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCheck, Check, Clapperboard, Send, Smile } from 'lucide-react';
import { formatTime, isRecentlyOnline, formatDate, type Message } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { useSession } from '@/components/SessionProvider';
import { RecommendationCard } from '@/components/chat/RecommendationCard';
import { RecommendModal } from '@/components/chat/RecommendModal';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { Avatar, Button, Spinner, useToast } from '@/components/ui';

export default function ChatPage() {
  const api = getApi();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const { profile, online, refreshBadges } = useSession();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [other, setOther] = useState<{ user_id: string; last_read_at: string; profile: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [recommend, setRecommend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const addMsg = useCallback((m: Message) => setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m])), []);
  const markRead = useCallback(async () => { await api.messages.markRead(id); refreshBadges(); }, [api, id, refreshBadges]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setMsgs([]); setError(null); stickToBottom.current = true;
    (async () => {
      try {
        const [page, members] = await Promise.all([api.messages.page(id), api.messages.members(id)]);
        if (!alive) return;
        setMsgs(page.items); setHasMore(page.hasMore);
        setOther(members.find((m) => m.user_id !== profile?.id) ?? null);
        markRead();
      } catch (e) { if (alive) setError((e as Error).message); } finally { if (alive) setLoading(false); }
    })();
    const ch = api.messages.subscribe(id, {
      onMessage: (m) => { stickToBottom.current = true; addMsg(m); if (m.sender_id !== profile?.id) markRead(); },
      onRead: (uid, at) => setOther((o) => (o && o.user_id === uid ? { ...o, last_read_at: at } : o)),
    });
    return () => { alive = false; api.supabase.removeChannel(ch); };
  }, [api, id, profile?.id, addMsg, markRead]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function loadOlder() {
    if (!hasMore || loadingOlder || !msgs.length) return;
    const el = scroller.current!; const prevH = el.scrollHeight;
    setLoadingOlder(true); stickToBottom.current = false;
    try {
      const page = await api.messages.page(id, msgs[0].created_at);
      setMsgs((xs) => [...page.items, ...xs]); setHasMore(page.hasMore);
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevH; });
    } finally { setLoadingOlder(false); }
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setText(''); setEmoji(false);
    try { stickToBottom.current = true; addMsg(await api.messages.send(id, body)); }
    catch (err) { setText(body); toast((err as Error).message, 'error'); } finally { setSending(false); inputRef.current?.focus(); }
  }

  const otherOnline = other ? online.has(other.user_id) || isRecentlyOnline(other.profile?.last_seen_at) : false;
  const lastMine = [...msgs].reverse().find((m) => m.sender_id === profile?.id);

  if (error) return <div className="m-auto p-6 text-center text-sm text-notify">{error} <Link href="/messages" className="underline">Back</Link></div>;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link href="/messages" className="rounded-lg p-1.5 text-ink-muted hover:text-ink md:hidden" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
        {other && <Link href={`/u/${other.profile.username}`} className="flex items-center gap-3">
          <Avatar url={other.profile.avatar_url} name={other.profile.username} size={40} online={otherOnline} />
          <div><p className="font-medium">@{other.profile.username}</p><p className="text-xs text-ink-muted">{otherOnline ? 'Online' : 'Offline'}</p></div>
        </Link>}
        <Button variant="lavender" size="sm" className="ml-auto" onClick={() => setRecommend(true)} disabled={!other}><Clapperboard className="h-4 w-4" /> <span className="hidden sm:inline">Recommend a Movie</span></Button>
      </header>

      <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; if (el.scrollTop < 60) loadOlder(); }}
        className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {loading ? <div className="grid h-full place-items-center"><Spinner /></div> : <>
          {loadingOlder && <div className="flex justify-center py-2"><Spinner className="h-4 w-4" /></div>}
          {!hasMore && <p className="py-4 text-center text-xs text-ink-muted">This is the beginning of your conversation. Say hi or recommend a movie 🍿</p>}
          {msgs.map((m, i) => {
            const mine = m.sender_id === profile?.id;
            const day = m.created_at.slice(0, 10);
            const newDay = i === 0 || msgs[i - 1].created_at.slice(0, 10) !== day;
            const seen = other && mine && new Date(other.last_read_at) >= new Date(m.created_at);
            return (
              <div key={m.id}>
                {newDay && <div className="my-4 text-center text-[11px] uppercase tracking-wider text-ink-muted">{formatDate(day)}</div>}
                <div className={clsx('flex animate-fade-up', mine ? 'justify-end' : 'justify-start')}>
                  <div className={clsx('max-w-[80%]', mine && 'items-end')}>
                    {m.kind === 'recommendation' && m.recommendation
                      ? <RecommendationCard rec={m.recommendation} mine={mine} />
                      : <div className={clsx('whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-snug', mine ? 'rounded-br-md bg-amber text-bg' : 'rounded-bl-md bg-surface-raised text-ink')}>{m.body}</div>}
                    <div className={clsx('mt-0.5 flex items-center gap-1 px-1 text-[10px] text-ink-muted', mine ? 'justify-end' : 'justify-start')}>
                      {formatTime(m.created_at)}
                      {mine && m.id === lastMine?.id && (seen ? <span className="flex items-center gap-0.5 text-lavender"><CheckCheck className="h-3 w-3" /> Seen</span> : <Check className="h-3 w-3" />)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>}
      </div>

      <form onSubmit={send} className="relative border-t border-line p-3">
        {emoji && <div className="absolute bottom-full left-3 mb-2"><EmojiPicker onPick={(e) => { setText((t) => t + e); inputRef.current?.focus(); }} /></div>}
        <div className="flex items-end gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => setEmoji(!emoji)} aria-label="Emoji"><Smile className="h-5 w-5" /></Button>
          <textarea ref={inputRef} rows={1} value={text} maxLength={4000} placeholder="Message…" aria-label="Message"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-line bg-bg/60 px-4 py-2.5 text-sm focus:border-amber/60 focus:outline-none" />
          <Button size="icon" disabled={!text.trim()} loading={sending} aria-label="Send">{!sending && <Send className="h-4 w-4" />}</Button>
        </div>
      </form>

      {other && <RecommendModal open={recommend} onClose={() => setRecommend(false)} conversationId={id} toUsername={other.profile.username}
        onSent={async (mid) => { stickToBottom.current = true; addMsg(await api.messages.byId(mid)); }} />}
    </div>
  );
}
