'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { Clapperboard, MessageCircle } from 'lucide-react';
import { timeAgo } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/components/SessionProvider';
import { Avatar, Button, EmptyState, ListSkeleton } from '@/components/ui';

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const api = getApi();
  const params = useParams<{ id?: string }>();
  const { profile, online, unreadMessages } = useSession();
  const { data, loading, reload } = useAsync(() => api.messages.conversations(), []);

  // refresh previews/unread counts whenever any message arrives or badges change
  useEffect(() => { reload(true); }, [unreadMessages, params.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ch = api.messages.subscribeInbox(() => reload(true));
    return () => { api.supabase.removeChannel(ch); };
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="-mx-4 -mt-6 flex h-[calc(100dvh-4rem-4.5rem)] md:mx-0 md:mt-0 md:h-[calc(100dvh-4rem-3rem)] md:gap-4">
      <aside className={clsx('w-full flex-col border-line md:flex md:w-80 md:shrink-0 md:rounded-3xl md:border md:bg-surface/50', params.id ? 'hidden' : 'flex')}>
        <div className="flex items-center justify-between p-4"><h1 className="font-heading text-xl font-bold">Messages</h1></div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loading ? <div className="p-2"><ListSkeleton rows={6} /></div> : !data?.length ? (
            <div className="p-2"><EmptyState icon={<MessageCircle className="h-7 w-7" />} title="No conversations" body="Start a chat from your friends list." action={<Link href="/friends"><Button variant="secondary">Open friends</Button></Link>} /></div>
          ) : data.map((c) => (
            <Link key={c.conversation_id} href={`/messages/${c.conversation_id}`}
              className={clsx('flex items-center gap-3 rounded-2xl p-3 transition', params.id === c.conversation_id ? 'bg-surface-raised' : 'hover:bg-surface/80')}>
              <Avatar url={c.other_avatar_url} name={c.other_username} size={44} online={online.has(c.other_id)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={clsx('truncate', c.unread_count ? 'font-semibold' : 'font-medium')}>@{c.other_username}</p>
                  <span className="shrink-0 text-[11px] text-ink-muted">{c.last_message_body !== null || c.last_message_kind ? timeAgo(c.last_message_at) : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className={clsx('flex-1 truncate text-sm', c.unread_count ? 'text-ink' : 'text-ink-muted')}>
                    {c.last_message_sender === profile?.id && 'You: '}
                    {c.last_message_kind === 'recommendation' ? <span className="inline-flex items-center gap-1 text-amber"><Clapperboard className="h-3 w-3" /> Recommended a movie</span> : c.last_message_body ?? 'Say hi 👋'}
                  </p>
                  {c.unread_count > 0 && <span className="min-w-5 rounded-full bg-notify px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{c.unread_count}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </aside>
      <section className={clsx('min-w-0 flex-1 md:flex md:rounded-3xl md:border md:border-line md:bg-surface/40', params.id ? 'flex' : 'hidden')}>{children}</section>
    </div>
  );
}
