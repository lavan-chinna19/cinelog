'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationText, timeAgo, type AppNotification } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/components/SessionProvider';
import { Avatar, Button, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui';

function href(n: AppNotification) {
  switch (n.type) {
    case 'friend_request': return '/friends';
    case 'friend_accepted': return n.actor ? `/u/${n.actor.username}` : '/friends';
    case 'message': return `/messages/${n.entity_id}`;
    case 'recommendation': return n.data?.conversation_id ? `/messages/${n.data.conversation_id}` : '/home';
    case 'recommendation_added': return n.actor ? `/u/${n.actor.username}` : '/home';
  }
}

export default function NotificationsPage() {
  const api = getApi();
  const { refreshBadges, unreadNotifications, profile } = useSession();
  const { data, loading, error, reload } = useAsync(() => api.notifications.list(50), []);
  useEffect(() => { reload(true); }, [unreadNotifications]); // eslint-disable-line react-hooks/exhaustive-deps

  async function readAll() { await api.notifications.markAllRead(); await reload(true); refreshBadges(); }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Notifications" action={data?.some((n) => !n.read_at) ? <Button variant="secondary" size="sm" onClick={readAll}><CheckCheck className="h-4 w-4" /> Mark all read</Button> : undefined} />
      {error && <ErrorState message={error} onRetry={() => reload()} />}
      {loading ? <ListSkeleton /> : !data?.length ? <EmptyState icon={<Bell className="h-7 w-7" />} title="You're all caught up" body="Friend requests, messages and recommendations will show up here." />
        : <ul className="space-y-2">{data.map((n) => (
            <li key={n.id}>
              <Link href={href(n)} onClick={() => { if (!n.read_at) api.notifications.markRead(n.id).then(refreshBadges); }}
                className={clsx('flex items-center gap-3 rounded-2xl border p-3 transition hover:border-amber/40', n.read_at ? 'border-line bg-surface/40' : 'border-lavender/40 bg-lavender/5')}>
                <Avatar url={n.actor?.avatar_url} name={n.actor?.username} size={40} />
                <p className="flex-1 text-sm">{notificationText(n)}</p>
                <span className="shrink-0 text-xs text-ink-muted">{timeAgo(n.created_at)}</span>
                {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-notify" />}
              </Link>
            </li>))}</ul>}
      {profile && null}
    </div>
  );
}
