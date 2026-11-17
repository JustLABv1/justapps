'use client';

import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Dialog } from '@/components/panelui/dialog';
import { Field } from '@/components/panelui/field';
import { Input } from '@/components/panelui/input';
import { UserAvatar, displayNameOf } from '@/components/profile/UserAvatar';
import { useAuth, type User } from '@/context/AuthContext';
import { fetchApi, uploadFile } from '@/lib/api';
import { toast } from '@/lib/toast';
import { ImageUp, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

const ACCEPTED_IMAGES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function memberSince(date?: string) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function EditProfileDialog({ user }: { user: User }) {
  const { patchUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setDisplayName(user.displayName ?? '');
    setAvatarUrl(user.avatarUrl ?? '');
  };

  const choose = async (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_IMAGES.includes(file.type)) {
      toast.danger('Bitte wähle ein PNG-, JPEG- oder WebP-Bild.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.danger('Das Bild darf höchstens 2 MB groß sein.');
      return;
    }
    setUploading(true);
    try {
      setAvatarUrl(await uploadFile('/upload/logo', file));
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Bild konnte nicht hochgeladen werden.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetchApi('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ displayName, avatarUrl }),
      });
      const body = await response.json().catch(() => ({})) as { displayName?: string; avatarUrl?: string; message?: string };
      if (!response.ok) throw new Error(body.message || 'Profil konnte nicht gespeichert werden.');
      patchUser({ displayName: body.displayName ?? '', avatarUrl: body.avatarUrl ?? '' });
      toast.success('Profil gespeichert.');
      setOpen(false);
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Profil konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const preview = { username: user.username, displayName, avatarUrl };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <Dialog.Trigger render={<Button variant="secondary" />}>
        <Pencil />
        Profil bearbeiten
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header title="Profil bearbeiten" description="Name und Bild sehen alle, denen du im Katalog begegnest." />
        <Dialog.Body className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <UserAvatar user={preview} size="xl" />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileInput.current?.click()}>
                  <ImageUp />
                  {avatarUrl ? 'Bild ändern' : 'Bild hochladen'}
                </Button>
                {avatarUrl && (
                  <Button size="sm" variant="ghost" onClick={() => setAvatarUrl('')}>
                    <Trash2 />
                    Entfernen
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPEG oder WebP, höchstens 2 MB. Quadratisch sieht am besten aus.</p>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_IMAGES.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => void choose(event.target.files?.[0])}
            />
          </div>
          <Field>
            <Field.Label optional>Anzeigename</Field.Label>
            <Input
              value={displayName}
              maxLength={80}
              placeholder={user.username}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <Field.Description>Leer lassen, um deinen Benutzernamen „{user.username}“ zu zeigen.</Field.Description>
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" />}>Abbrechen</Dialog.Close>
          <Button loading={saving} disabled={uploading} onClick={() => void save()}>Speichern</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

/** Who the profile belongs to: picture, name, handle and standing, with editing. */
export function ProfileHeader({ user }: { user: User }) {
  const name = displayNameOf(user);
  const since = memberSince(user.created_at);
  const sso = user.authType === 'oidc';

  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <UserAvatar user={user} size="xl" className="size-20 text-2xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {name !== user.username && <span>@{user.username}</span>}
          {name !== user.username && <span aria-hidden="true">·</span>}
          <span className="truncate">{user.email}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {user.role === 'admin' && <Badge variant="info" size="sm">Administration</Badge>}
          {sso && (
            <Badge variant="outline" size="sm">
              <ShieldCheck />
              Single Sign-on
            </Badge>
          )}
          {since && <span className="text-xs text-muted-foreground">Dabei seit {since}</span>}
        </div>
      </div>
      <div className="sm:self-start">
        <EditProfileDialog user={user} />
      </div>
    </header>
  );
}
