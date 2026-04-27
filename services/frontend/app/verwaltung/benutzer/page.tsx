'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { UserTable } from '@/components/UserTable';
import { fetchApi } from '@/lib/api';
import {
    Button,
    Input,
    Label,
    ListBox,
    Modal,
    Select,
    TextField,
    toast
} from '@heroui/react';
import { Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SystemUser {
  id: string;
  username: string;
  email: string;
  role: string;
  disabled: boolean;
  canSubmitApps?: boolean;
  disabledReason?: string;
  createdAt?: string;
  authType?: string;
  lastLoginAt?: string;
}

export default function BenutzerPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [formData, setFormData] = useState<Partial<SystemUser & { password?: string }>>({});
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const loadUsers = async () => {
    try {
      const res = await fetchApi('/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else if (res.status === 401) {
        setError('Sitzung abgelaufen. Bitte melden Sie sich erneut an.');
      } else {
        setError(`Fehler beim Laden: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      setError(`Verbindungsfehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const handleCreateUser = () => {
    setSelectedUser(null);
    setFormData({ username: '', email: '', role: 'user', password: '' });
    setIsModalOpen(true);
  };

  const handleEditUser = (u: SystemUser) => {
    setSelectedUser(u);
    setFormData({ ...u });
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    setDeleteUserId(userId);
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return;

    setIsDeletingUser(true);
    try {
      const res = await fetchApi(`/admin/users/${deleteUserId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Der Benutzer wurde gelöscht.');
        setDeleteUserId(null);
        await loadUsers();
      } else {
        toast.danger('Der Benutzer konnte nicht gelöscht werden.');
      }
    } catch (err) {
      console.error(err);
      toast.danger('Beim Löschen des Benutzers ist ein Fehler aufgetreten.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleToggleUserState = async (u: SystemUser) => {
    try {
      const res = await fetchApi(`/admin/users/${u.id}/state`, {
        method: 'PUT',
        body: JSON.stringify({ disabled: !u.disabled }),
      });
      if (res.ok) loadUsers();
    } catch (err) { console.error(err); }
  };

  const handleToggleUserSubmission = async (u: SystemUser) => {
    try {
      const res = await fetchApi(`/admin/users/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          id: u.id,
          username: u.username,
          email: u.email,
          role: u.role,
          canSubmitApps: !(u.canSubmitApps === true),
        }),
      });
      if (res.ok) loadUsers();
      else console.error('Aktualisierung des Einreichungsstatus fehlgeschlagen');
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = selectedUser ? 'PUT' : 'POST';
    const url = selectedUser ? `/admin/users/${selectedUser.id}` : '/admin/users';
    try {
      const res = await fetchApi(url, { method, body: JSON.stringify(formData) });
      if (res.ok) {
        setIsModalOpen(false);
        loadUsers();
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted">{users.length} Benutzer registriert</p>
        <Button size="sm" onPress={handleCreateUser} className="bg-accent text-white gap-2">
          <UserPlus className="w-4 h-4" /> Benutzer einladen
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm font-medium flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex-grow">{error}</div>
          <Button size="sm" variant="secondary" onPress={loadUsers} className="h-8">Wiederholen</Button>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : (
        <UserTable
          users={users}
          handleEditUser={handleEditUser}
          handleDeleteUser={handleDeleteUser}
          handleToggleUserState={handleToggleUserState}
          handleToggleUserSubmission={handleToggleUserSubmission}
        />
      )}

      <Modal>
        <Modal.Backdrop isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-md">
              <form onSubmit={handleSubmit}>
                <Modal.CloseTrigger />
                <Modal.Header className="px-8 py-6 border-b border-border">
                  <Modal.Heading className="text-xl font-semibold text-foreground">
                    {selectedUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body className="px-8 py-6 space-y-4">
                  <TextField isRequired onChange={(val) => setFormData({ ...formData, username: val })}>
                    <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Benutzername</Label>
                    <Input value={formData.username || ''} placeholder="max.mustermann" className="bg-field-background" />
                  </TextField>
                  <TextField isRequired type="email" onChange={(val) => setFormData({ ...formData, email: val })}>
                    <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">E-Mail</Label>
                    <Input value={formData.email || ''} placeholder="max@beispiel.de" className="bg-field-background" />
                  </TextField>
                  {!selectedUser && (
                    <TextField isRequired type="password" onChange={(val) => setFormData({ ...formData, password: val })}>
                      <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Passwort</Label>
                      <Input value={formData.password || ''} placeholder="******" className="bg-field-background" />
                    </TextField>
                  )}
                  <Select
                    value={formData.role || 'user'}
                    onChange={(key) => setFormData({ ...formData, role: key as string })}
                    className="w-full"
                  >
                    <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Rolle</Label>
                    <Select.Trigger className="bg-field-background border-border">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="user" textValue="Benutzer">Benutzer<ListBox.ItemIndicator /></ListBox.Item>
                        <ListBox.Item id="admin" textValue="Administrator">Administrator<ListBox.ItemIndicator /></ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </Modal.Body>
                <Modal.Footer className="px-8 py-6 border-t border-border">
                  <div className="flex justify-end gap-3 w-full">
                    <Button variant="ghost" slot="close" className="px-6 font-bold">Abbrechen</Button>
                    <Button type="submit" className="bg-accent text-white px-8 font-medium">Speichern</Button>
                  </div>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmDialog
        confirmLabel="Benutzer löschen"
        description="Der Benutzerzugang wird dauerhaft entfernt. Dieser Schritt kann nicht rückgängig gemacht werden."
        isDanger
        isLoading={isDeletingUser}
        isOpen={!!deleteUserId}
        onConfirm={confirmDeleteUser}
        onOpenChange={(open) => {
          if (!open && !isDeletingUser) setDeleteUserId(null);
        }}
        title="Benutzer wirklich löschen?"
      />
    </div>
  );
}
