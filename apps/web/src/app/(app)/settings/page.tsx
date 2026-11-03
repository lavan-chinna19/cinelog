'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Globe, Lock, LogOut, Users } from 'lucide-react';
import clsx from 'clsx';
import { validateBio, validateUsername, type Privacy } from '@cinelog/shared';
import { getApi } from '@/lib/api';
import { useSession } from '@/components/SessionProvider';
import { Avatar, Button, Input, PageHeader, Skeleton, Textarea, useToast } from '@/components/ui';

export default function SettingsPage() {
  const api = getApi();
  const toast = useToast();
  const { profile, refreshProfile } = useSession();
  const [f, setF] = useState({ username: '', display_name: '', bio: '', privacy: 'friends' as Privacy, show_diary: true });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pw, setPw] = useState({ a: '', b: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) setF({ username: profile.username, display_name: profile.display_name ?? '', bio: profile.bio ?? '', privacy: profile.privacy, show_diary: profile.show_diary });
  }, [profile]);
  if (!profile) return <Skeleton className="h-96" />;

  const errs = { username: validateUsername(f.username), bio: validateBio(f.bio) };
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (errs.username || errs.bio) return;
    setSaving(true);
    try {
      if (f.username.toLowerCase() !== profile!.username.toLowerCase() && !(await api.auth.usernameAvailable(f.username))) throw new Error('That username is taken.');
      await api.profiles.update({ username: f.username, display_name: f.display_name.trim() || null, bio: f.bio.trim() || null, privacy: f.privacy, show_diary: f.show_diary });
      await refreshProfile(); toast('Profile saved');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = e.target.files?.[0]; if (!fl) return;
    setUploading(true);
    try { await api.profiles.uploadAvatar(fl, fl.type); await refreshProfile(); toast('Profile picture updated'); }
    catch (err) { toast((err as Error).message, 'error'); } finally { setUploading(false); e.target.value = ''; }
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.a !== pw.b) return toast('Passwords don’t match', 'error');
    setPwBusy(true);
    try { await api.auth.updatePassword(pw.a); setPw({ a: '', b: '' }); toast('Password changed'); } catch (err) { toast((err as Error).message, 'error'); } finally { setPwBusy(false); }
  }

  const options: { id: Privacy; icon: any; label: string; body: string }[] = [
    { id: 'public', icon: Globe, label: 'Public', body: 'Anyone on CineLog can see your diary and watchlist.' },
    { id: 'friends', icon: Users, label: 'Friends only', body: 'Only accepted friends see your activity.' },
    { id: 'private', icon: Lock, label: 'Private', body: 'Your movies are visible to you alone.' },
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" />
      <form onSubmit={save} className="space-y-6 rounded-3xl border border-line bg-surface/60 p-6">
        <h2 className="font-heading font-semibold">Profile</h2>
        <div className="flex items-center gap-4">
          <Avatar url={profile.avatar_url} name={profile.username} size={80} />
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
          <Button type="button" variant="secondary" loading={uploading} onClick={() => file.current?.click()}><Camera className="h-4 w-4" /> Change photo</Button>
          <span className="text-xs text-ink-muted">JPG, PNG or WebP · max 2 MB</span>
        </div>
        <Input label="Username" value={f.username} maxLength={20} onChange={(e) => setF({ ...f, username: e.target.value.trim() })} error={errs.username} />
        <Input label="Display name (optional)" value={f.display_name} maxLength={50} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
        <div><Textarea label="Bio" rows={3} maxLength={280} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="What do you love to watch?" />
          <p className="mt-1 text-right text-xs text-ink-muted">{f.bio.length}/280</p></div>

        <div className="space-y-3">
          <h2 className="font-heading font-semibold">Privacy</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {options.map((o) => (
              <button type="button" key={o.id} onClick={() => setF({ ...f, privacy: o.id })}
                className={clsx('rounded-2xl border p-4 text-left transition', f.privacy === o.id ? 'border-amber bg-amber/5' : 'border-line hover:border-ink-muted/50')}>
                <o.icon className={clsx('h-5 w-5', f.privacy === o.id ? 'text-amber' : 'text-ink-muted')} />
                <p className="mt-2 text-sm font-medium">{o.label}</p><p className="text-xs text-ink-muted">{o.body}</p>
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-line p-4">
            <span><span className="block text-sm font-medium">Share my movie diary</span><span className="text-xs text-ink-muted">When off, nobody else sees your watched movies, whatever your privacy level.</span></span>
            <input type="checkbox" className="h-5 w-5 accent-[#F0A35E]" checked={f.show_diary} onChange={(e) => setF({ ...f, show_diary: e.target.checked })} />
          </label>
        </div>
        <div className="flex justify-end"><Button loading={saving}>Save changes</Button></div>
      </form>

      <form onSubmit={changePw} className="mt-6 space-y-4 rounded-3xl border border-line bg-surface/60 p-6">
        <h2 className="font-heading font-semibold">Change password</h2>
        <Input type="password" label="New password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
        <Input type="password" label="Confirm new password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
        <div className="flex justify-end"><Button variant="secondary" loading={pwBusy} disabled={!pw.a}>Update password</Button></div>
      </form>

      <div className="mt-6 flex justify-end"><Button variant="danger" onClick={() => api.auth.signOut()}><LogOut className="h-4 w-4" /> Log out</Button></div>
    </div>
  );
}
