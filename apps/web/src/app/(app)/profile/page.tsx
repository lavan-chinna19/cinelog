'use client';
import { useSession } from '@/components/SessionProvider';
import { ProfileView } from '@/components/ProfileView';
import { Skeleton } from '@/components/ui';

export default function MyProfilePage() {
  const { profile } = useSession();
  if (!profile) return <Skeleton className="h-64" />;
  return <ProfileView profile={profile} isMe />;
}
