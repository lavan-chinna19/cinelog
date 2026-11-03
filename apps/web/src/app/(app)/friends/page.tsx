'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check, Inbox, MessageCircle, Search, Send, UserMinus, UserPlus, Users, X } from 'lucide-react';
import type { ProfileLite } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { useAsync, useDebounced } from '@/lib/useAsync';
import { useSession } from '@/components/SessionProvider';
import { Avatar, Button, EmptyState, ErrorState, Input, ListSkeleton, PageHeader, Tabs, useToast } from '@/components/ui';

type Tab = 'friends' | 'received' | 'sent' | 'find';

function Row({ p, children, online }: { p: ProfileLite & { bio?: string | null }; children?: React.ReactNode; online?: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3 animate-fade-up">
      <Link href={`/u/${p.username}`}><Avatar url={p.avatar_url} name={p.username} size={44} online={online} /></Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${p.username}`} className="font-medium hover:text-amber">@{p.username}</Link>
        {p.bio && <p className="truncate text-xs text-ink-muted">{p.bio}</p>}
      </div>
      <div className="flex shrink-0 gap-1.5">{children}</div>
    </li>
  );
}

export default function FriendsPage() {
  const api = getApi();
  const router = useRouter();
  const toast = useToast();
  const { online, refreshBadges } = useSession();
  const [tab, setTab] = useState<Tab>('friends');
  const [q, setQ] = useState('');
  const query = useDebounced(q);
  const [results, setResults] = useState<(ProfileLite & { bio?: string | null })[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => api.friends.all(), []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return; }
    setSearching(true);
    api.profiles.search(query).then(setResults).catch((e) => toast(e.message, 'error')).finally(() => setSearching(false));
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(id: string, fn: () => Promise<unknown>, msg: string) {
    setBusy(id);
    try { await fn(); toast(msg); await reload(true); refreshBadges(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(null); }
  }
  async function message(userId: string) {
    try { const id = await api.messages.open(userId); router.push(`/messages/${id}`); } catch (e) { toast((e as Error).message, 'error'); }
  }

  type Rel = { kind: 'friend' } | { kind: 'incoming'; id: string } | { kind: 'outgoing'; id: string } | { kind: 'none' };
  const relation = (userId: string): Rel => {
    if (!data) return { kind: 'none' };
    if (data.friends.some((f) => f.profile.id === userId)) return { kind: 'friend' };
    const r = data.received.find((f) => f.profile.id === userId); if (r) return { kind: 'incoming', id: r.friendship.id };
    const s = data.sent.find((f) => f.profile.id === userId); if (s) return { kind: 'outgoing', id: s.friendship.id };
    return { kind: 'none' };
  };

  return (
    <div>
      <PageHeader title="Friends" subtitle="Your people — and what they're watching." />
      <div className="mb-6"><Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'friends', label: `My Friends${data ? ` (${data.friends.length})` : ''}` },
        { id: 'received', label: 'Received', count: data?.received.length },
        { id: 'sent', label: `Sent${data?.sent.length ? ` (${data.sent.length})` : ''}` },
        { id: 'find', label: 'Find Friends' },
      ]} /></div>
      {error && <ErrorState message={error} onRetry={() => reload()} />}

      {tab === 'find' ? (
        <div className="space-y-4">
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username…" icon={<Search className="h-4 w-4" />} aria-label="Search users" />
          {searching ? <ListSkeleton rows={3} /> : results === null ? <p className="py-8 text-center text-sm text-ink-muted">Type at least 2 characters to search.</p>
            : results.length === 0 ? <EmptyState icon={<Search className="h-7 w-7" />} title="No users found" body={`No one matches “${q}”.`} />
            : <ul className="space-y-2">{results.map((p) => {
                const rel = relation(p.id);
                return (
                  <Row key={p.id} p={p}>
                    {rel.kind === 'friend' ? <Button size="sm" variant="secondary" onClick={() => message(p.id)}><MessageCircle className="h-4 w-4" /> Message</Button>
                      : rel.kind === 'incoming' ? <Button size="sm" loading={busy === p.id} onClick={() => act(p.id, () => api.friends.respond(rel.id, true), `You and @${p.username} are now friends`)}><Check className="h-4 w-4" /> Accept</Button>
                      : rel.kind === 'outgoing' ? <Button size="sm" variant="ghost" disabled>Requested</Button>
                      : <Button size="sm" loading={busy === p.id} onClick={() => act(p.id, () => api.friends.request(p.id), `Request sent to @${p.username}`)}><UserPlus className="h-4 w-4" /> Add</Button>}
                  </Row>
                );
              })}</ul>}
        </div>
      ) : loading ? <ListSkeleton /> : tab === 'friends' ? (
        !data?.friends.length ? <EmptyState icon={<Users className="h-7 w-7" />} title="No friends yet" body="Find people by username and send a request." action={<Button onClick={() => setTab('find')}><UserPlus className="h-4 w-4" /> Find friends</Button>} />
          : <ul className="space-y-2">{data.friends.map(({ friendship, profile: p }) => (
              <Row key={friendship.id} p={p} online={online.has(p.id)}>
                <Button size="sm" variant="secondary" onClick={() => message(p.id)}><MessageCircle className="h-4 w-4" /><span className="hidden sm:inline">Message</span></Button>
                <Button size="sm" variant="ghost" loading={busy === friendship.id} title="Remove friend"
                  onClick={() => confirm(`Remove @${p.username} from your friends?`) && act(friendship.id, () => api.friends.remove(friendship.id), 'Friend removed')}><UserMinus className="h-4 w-4" /></Button>
              </Row>))}</ul>
      ) : tab === 'received' ? (
        !data?.received.length ? <EmptyState icon={<Inbox className="h-7 w-7" />} title="No pending requests" body="Friend requests you receive appear here." />
          : <ul className="space-y-2">{data.received.map(({ friendship, profile: p }) => (
              <Row key={friendship.id} p={p}>
                <Button size="sm" loading={busy === friendship.id} onClick={() => act(friendship.id, () => api.friends.respond(friendship.id, true), `You and @${p.username} are now friends`)}><Check className="h-4 w-4" /> Accept</Button>
                <Button size="sm" variant="ghost" onClick={() => act(friendship.id, () => api.friends.respond(friendship.id, false), 'Request declined')}><X className="h-4 w-4" /></Button>
              </Row>))}</ul>
      ) : (
        !data?.sent.length ? <EmptyState icon={<Send className="h-7 w-7" />} title="No sent requests" body="Requests you send stay here until they're answered." />
          : <ul className="space-y-2">{data.sent.map(({ friendship, profile: p }) => (
              <Row key={friendship.id} p={p}>
                <Button size="sm" variant="secondary" loading={busy === friendship.id} onClick={() => act(friendship.id, () => api.friends.remove(friendship.id), 'Request cancelled')}>Cancel</Button>
              </Row>))}</ul>
      )}
    </div>
  );
}
