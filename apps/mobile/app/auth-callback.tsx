import { Redirect } from 'expo-router';
import { useSession } from '@/lib/session';
import { Loading } from '@/components/movies';
/** Email-confirmation deep link target; the root layout exchanges the code. */
export default function AuthCallback() {
  const { session } = useSession();
  return session ? <Redirect href="/(tabs)" /> : <Loading />;
}
