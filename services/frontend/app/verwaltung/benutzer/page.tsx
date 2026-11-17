'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { UserTable, type AdminUser } from '@/components/UserTable';
import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
import { Dialog } from '@/components/panelui/dialog';
import { Field } from '@/components/panelui/field';
import { Input } from '@/components/panelui/input';
import { Select } from '@/components/panelui/select';
import { Switch } from '@/components/panelui/switch';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { UserPlus } from 'lucide-react';
import NextLink from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface RoleOption {
  key: string;
  name: string;
}

const FALLBACK_ROLES: RoleOption[] = [
  { key: 'user', name: 'Mitglied' },
  { key: 'moderator', name: 'Moderation' },
  { key: 'admin', name: 'Administration' },
];

type UserForm = Partial<AdminUser> & { password?: string };

async function messageOf(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { message?: string };
  return body.message || fallback;
}

function UserDialog({
  user,
  open,
  roles,
  onOpenChange,
  onSaved,
}: {
  user: AdminUser | null;
  open: boolean;
  roles: RoleOption[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UserForm>({});
  const [saving, setSaving] = useState(false);
  const editing = !!user;
  const sso = user?.authType === 'oidc';
  const admin = form.role === 'admin';
  const roleItems = roles.map((role) => ({ value: role.key, label: role.name }));

  useEffect(() => {
    // Filled again each time it opens, so a cancelled edit leaves nothing behind.
    if (!open) return;
    const id = window.setTimeout(() => setForm(user ? { ...user } : { username: '', email: '', role: 'user', password: '', canCreateSpaces: false }), 0);
    return () => window.clearTimeout(id);
  }, [open, user]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetchApi(editing ? `/admin/users/${user.id}` : '/admin/users', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await messageOf(response, 'Der Benutzer konnte nicht gespeichert werden.'));
      toast.success(editing ? 'Änderungen gespeichert.' : 'Benutzer angelegt.');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Der Benutzer konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <Dialog.Content>
        <Dialog.Header
          title={editing ? 'Benutzer bearbeiten' : 'Benutzer anlegen'}
          description={editing
            ? sso ? 'Name und E-Mail kommen aus der Anmeldung über Single Sign-on.' : undefined
            : 'Das Konto meldet sich mit Benutzername und Passwort an.'}
        />
        <Dialog.Body>
          <form id="user-form" onSubmit={submit} className="flex flex-col gap-4">
            <Field>
              <Field.Label required>Benutzername</Field.Label>
              <Input required disabled={sso} value={form.username ?? ''} placeholder="max.mustermann" onChange={(event) => setForm({ ...form, username: event.target.value })} />
            </Field>
            <Field>
              <Field.Label required>E-Mail</Field.Label>
              <Input required type="email" disabled={sso} value={form.email ?? ''} placeholder="max@beispiel.de" onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            {!editing && (
              <Field>
                <Field.Label required>Passwort</Field.Label>
                <Input required type="password" minLength={8} autoComplete="new-password" value={form.password ?? ''} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <Field.Description>Mindestens 8 Zeichen. Teilen Sie es auf sicherem Weg mit.</Field.Description>
              </Field>
            )}
            <Field>
              <Field.Label>Rolle</Field.Label>
              <Select items={roleItems} value={form.role ?? 'user'} onValueChange={(value) => setForm({ ...form, role: String(value) })}>
                <Select.Trigger className="w-full"><Select.Value /></Select.Trigger>
                <Select.Content>{roleItems.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
              </Select>
            </Field>
            <div className="flex flex-col gap-4 rounded-xl bg-muted/40 p-4">
              {editing && (
                <div className="flex items-start justify-between gap-4">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Apps erstellen</span>
                    <span className="text-xs text-muted-foreground">Darf eigene Apps anlegen und einreichen.</span>
                  </span>
                  <Switch label="Apps erstellen" checked={form.canSubmitApps !== false} onCheckedChange={(value) => setForm({ ...form, canSubmitApps: value })} />
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Spaces erstellen</span>
                  <span className="text-xs text-muted-foreground">
                    {admin ? 'Administration darf immer Spaces erstellen.' : 'Gilt, wenn die globale Regel „Nur für erlaubte Nutzer“ lautet.'}
                  </span>
                </span>
                <Switch label="Spaces erstellen" checked={admin || !!form.canCreateSpaces} disabled={admin} onCheckedChange={(value) => setForm({ ...form, canCreateSpaces: value })} />
              </div>
            </div>
          </form>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" disabled={saving} />}>Abbrechen</Dialog.Close>
          <Button type="submit" form="user-form" loading={saving}>{editing ? 'Speichern' : 'Anlegen'}</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

export default function BenutzerPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>(FALLBACK_ROLES);

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetchApi('/admin/users');
      if (!response.ok) {
        throw new Error(response.status === 401 ? 'Die Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.' : await messageOf(response, 'Benutzer konnten nicht geladen werden.'));
      }
      const data = await response.json() as { users?: AdminUser[] };
      setUsers(data.users || []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Verbindungsfehler.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(id);
  }, [loadUsers]);

  useEffect(() => {
    void fetchApi('/admin/roles')
      .then((response) => (response.ok ? response.json() : { roles: [] }))
      .then((data: { roles?: RoleOption[] }) => { if (data.roles?.length) setRoles(data.roles); })
      .catch(() => {});
  }, []);

  /** Changes one setting of a user, keeping everything else as it is. */
  const update = async (user: AdminUser, patch: Partial<AdminUser>, done: string) => {
    try {
      const response = await fetchApi(`/admin/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ id: user.id, username: user.username, email: user.email, role: user.role, ...patch }),
      });
      if (!response.ok) throw new Error(await messageOf(response, 'Die Änderung konnte nicht gespeichert werden.'));
      toast.success(done);
      await loadUsers();
    } catch (updateError) {
      toast.danger(updateError instanceof Error ? updateError.message : 'Die Änderung konnte nicht gespeichert werden.');
    }
  };

  const toggleState = async (user: AdminUser) => {
    try {
      const response = await fetchApi(`/admin/users/${user.id}/state`, { method: 'PUT', body: JSON.stringify({ disabled: !user.disabled }) });
      if (!response.ok) throw new Error(await messageOf(response, 'Der Status konnte nicht geändert werden.'));
      toast.success(user.disabled ? 'Konto aktiviert.' : 'Konto deaktiviert.');
      await loadUsers();
    } catch (stateError) {
      toast.danger(stateError instanceof Error ? stateError.message : 'Der Status konnte nicht geändert werden.');
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return;
    setIsDeletingUser(true);
    try {
      const response = await fetchApi(`/admin/users/${deleteUserId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await messageOf(response, 'Der Benutzer konnte nicht gelöscht werden.'));
      toast.success('Benutzer gelöscht.');
      setDeleteUserId(null);
      await loadUsers();
    } catch (deleteError) {
      toast.danger(deleteError instanceof Error ? deleteError.message : 'Der Benutzer konnte nicht gelöscht werden.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const disabledCount = users.filter((user) => user.disabled).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Benutzer &amp; Freigaben</h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            {loading ? 'Benutzer werden geladen …' : `${users.length} Konten${disabledCount > 0 ? `, ${disabledCount} deaktiviert` : ''}.`}{' '}
            Freigaben gelten pro Konto; die Regeln für alle stehen unter{' '}
            <NextLink href="/verwaltung/sicherheit/zugriff" className="font-medium text-foreground underline underline-offset-4">Zugriff &amp; Berechtigungen</NextLink>.
          </p>
        </div>
        <Button onClick={() => { setSelectedUser(null); setDialogOpen(true); }}>
          <UserPlus />
          Benutzer anlegen
        </Button>
      </header>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
          <Alert.Actions>
            <Button size="sm" variant="secondary" onClick={() => void loadUsers()}>Erneut versuchen</Button>
          </Alert.Actions>
        </Alert>
      )}

      <UserTable
        users={users}
        currentUserId={me?.id}
        isLoading={loading}
        handleEditUser={(user) => { setSelectedUser(user); setDialogOpen(true); }}
        handleDeleteUser={setDeleteUserId}
        handleToggleUserState={toggleState}
        handleToggleUserSubmission={(user) => update(user, { canSubmitApps: user.canSubmitApps === false }, user.canSubmitApps === false ? 'App-Erstellung erlaubt.' : 'App-Erstellung gesperrt.')}
        handleToggleUserSpaces={(user) => update(user, { canCreateSpaces: !user.canCreateSpaces }, user.canCreateSpaces ? 'Space-Erstellung gesperrt.' : 'Space-Erstellung erlaubt.')}
        roleLabels={Object.fromEntries(roles.map((role) => [role.key, role.name]))}
      />

      <UserDialog user={selectedUser} open={dialogOpen} roles={roles} onOpenChange={setDialogOpen} onSaved={() => void loadUsers()} />

      <ConfirmDialog
        confirmLabel="Benutzer löschen"
        description="Das Konto wird dauerhaft entfernt. Das lässt sich nicht rückgängig machen."
        isDanger
        isLoading={isDeletingUser}
        isOpen={!!deleteUserId}
        onConfirm={confirmDeleteUser}
        onOpenChange={(open) => { if (!open && !isDeletingUser) setDeleteUserId(null); }}
        title="Benutzer wirklich löschen?"
      />
    </div>
  );
}
