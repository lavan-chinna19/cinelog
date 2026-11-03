import { useSession } from '@/lib/session';
import { Loading } from '@/components/movies';
import { ProfileView } from '@/components/ProfileView';
export default function MyProfile() {
  const { profile } = useSession();
  return profile ? <ProfileView profile={profile} isMe /> : <Loading />;
}
