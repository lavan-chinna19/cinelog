import { useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/supabase';
import { useAsync } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { Loading } from '@/components/movies';
import { ProfileView } from '@/components/ProfileView';
import { Empty, Screen } from '@/components/ui';

export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { profile: me } = useSession();
  const { data, loading } = useAsync(() => api.profiles.byUsername(username), [username]);
  if (loading) return <Loading />;
  if (!data) return <Screen><Empty icon="person-outline" title="User not found" /></Screen>;
  return <ProfileView profile={data} isMe={data.id === me?.id} />;
}
