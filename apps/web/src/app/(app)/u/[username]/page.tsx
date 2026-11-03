'use client';
import { useParams } from 'next/navigation';
import { UserX } from 'lucide-react';
import { getApi } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/components/SessionProvider';
import { ProfileView } from '@/components/ProfileView';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { profile: me } = useSession();
  const { data, loading, error } = useAsync(() => getApi().profiles.byUsername(decodeURIComponent(username)), [username]);
  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState icon={<UserX className="h-7 w-7" />} title="User not found" body={`There's no one called @${username}.`} />;
  return <ProfileView profile={data} isMe={data.id === me?.id} />;
}
