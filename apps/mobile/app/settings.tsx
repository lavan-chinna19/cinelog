import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { colors, validateBio, validateUsername, type Privacy } from '@cinelog/shared';
import { api } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { Loading } from '@/components/movies';
import { useToast } from '@/components/toast';
import { Avatar, Button, Card, Field, Screen, T } from '@/components/ui';

export default function Settings() {
  const toast = useToast();
  const { profile, refreshProfile } = useSession();
  const [f, setF] = useState({ username: '', display_name: '', bio: '', privacy: 'friends' as Privacy, show_diary: true });
  const [saving, setSaving] = useState(false); const [uploading, setUploading] = useState(false);
  const [pw, setPw] = useState({ a: '', b: '' }); const [pwBusy, setPwBusy] = useState(false);
  useEffect(() => { if (profile) setF({ username: profile.username, display_name: profile.display_name ?? '', bio: profile.bio ?? '', privacy: profile.privacy, show_diary: profile.show_diary }); }, [profile]);
  if (!profile) return <Loading />;
  const errs = { username: validateUsername(f.username), bio: validateBio(f.bio) };

  async function pickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const buf = await (await fetch(asset.uri)).arrayBuffer();
      await api.profiles.uploadAvatar(buf, asset.mimeType ?? 'image/jpeg'); await refreshProfile(); toast('Profile picture updated');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setUploading(false); }
  }
  async function save() {
    if (errs.username || errs.bio) return;
    setSaving(true);
    try {
      if (f.username.toLowerCase() !== profile!.username.toLowerCase() && !(await api.auth.usernameAvailable(f.username))) throw new Error('That username is taken.');
      await api.profiles.update({ username: f.username, display_name: f.display_name.trim() || null, bio: f.bio.trim() || null, privacy: f.privacy, show_diary: f.show_diary });
      await refreshProfile(); toast('Profile saved');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); }
  }
  async function changePw() {
    if (pw.a !== pw.b) return toast('Passwords don’t match', 'error');
    setPwBusy(true); try { await api.auth.updatePassword(pw.a); setPw({ a: '', b: '' }); toast('Password changed'); } catch (e) { toast((e as Error).message, 'error'); } finally { setPwBusy(false); }
  }
  const opts: { id: Privacy; label: string; body: string }[] = [
    { id: 'public', label: 'Public', body: 'Anyone can see your diary.' },
    { id: 'friends', label: 'Friends only', body: 'Only friends see your activity.' },
    { id: 'private', label: 'Private', body: 'Only you.' },
  ];

  return (
    <Screen>
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar url={profile.avatar_url} name={profile.username} size={72} />
          <Button small variant="secondary" icon="camera-outline" title="Change photo" loading={uploading} onPress={pickAvatar} />
        </View>
        <Field label="Username" value={f.username} onChangeText={(s) => setF({ ...f, username: s.trim() })} autoCapitalize="none" maxLength={20} error={errs.username} />
        <Field label="Display name" value={f.display_name} onChangeText={(s) => setF({ ...f, display_name: s })} maxLength={50} />
        <Field label={`Bio (${f.bio.length}/280)`} value={f.bio} onChangeText={(s) => setF({ ...f, bio: s })} multiline maxLength={280} style={{ minHeight: 80, textAlignVertical: 'top' }} error={errs.bio} />
        <T v="h3">Privacy</T>
        {opts.map((o) => (
          <Pressable key={o.id} onPress={() => setF({ ...f, privacy: o.id })} style={{ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: f.privacy === o.id ? colors.amber : colors.border, backgroundColor: f.privacy === o.id ? 'rgba(240,163,94,.08)' : 'transparent' }}>
            <T style={{ fontFamily: 'Inter_600SemiBold' }}>{o.label}</T><T v="small">{o.body}</T>
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }}><T>Share my movie diary</T><T v="small">Off hides your watched movies from everyone else.</T></View>
          <Switch value={f.show_diary} onValueChange={(v) => setF({ ...f, show_diary: v })} trackColor={{ true: colors.amber, false: colors.border }} />
        </View>
        <Button title="Save changes" onPress={save} loading={saving} />
      </Card>
      <Card style={{ gap: 12 }}>
        <T v="h3">Change password</T>
        <Field label="New password" value={pw.a} onChangeText={(s) => setPw({ ...pw, a: s })} secureTextEntry />
        <Field label="Confirm" value={pw.b} onChangeText={(s) => setPw({ ...pw, b: s })} secureTextEntry />
        <Button variant="secondary" title="Update password" onPress={changePw} loading={pwBusy} disabled={!pw.a} />
      </Card>
      <Button variant="danger" icon="log-out-outline" title="Log out" onPress={() => profile?.is_guest
        ? Alert.alert('Leave guest mode?', 'Movies you logged as a guest will be lost unless you create an account first.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => api.auth.signOut() }])
        : api.auth.signOut()} />
    </Screen>
  );
}
