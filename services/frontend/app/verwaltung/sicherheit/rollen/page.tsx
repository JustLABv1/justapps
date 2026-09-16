'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { fetchApi } from '@/lib/api';
import { Button, Card, Checkbox, Chip, Input, Label, Modal, TextField, toast } from '@heroui/react';
import { LockKeyhole, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface PermissionDefinition {
  key: string;
  name: string;
  description: string;
  group: string;
}

interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

const emptyForm = { key: '', name: '', description: '', permissions: [] as string[] };

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [permissionDefinitions, setPermissionDefinitions] = useState<PermissionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<RoleDefinition | null>(null);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi('/admin/roles');
      if (!response.ok) throw new Error('Rollen konnten nicht geladen werden.');
      const data = await response.json() as { roles: RoleDefinition[]; permissions: PermissionDefinition[] };
      setRoles((data.roles || []).map((role) => ({
        ...role,
        permissions: role.permissions || [],
      })));
      setPermissionDefinitions(data.permissions || []);
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Rollen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadRoles(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadRoles]);

  const openCreate = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setIsOpen(true);
  };

  const openEdit = (role: RoleDefinition) => {
    setEditingRole(role);
    setForm({ key: role.key, name: role.name, description: role.description, permissions: [...(role.permissions || [])] });
    setIsOpen(true);
  };

  const togglePermission = (key: string, selected: boolean) => {
    setForm((current) => ({
      ...current,
      permissions: selected
        ? Array.from(new Set([...current.permissions, key]))
        : current.permissions.filter((permission) => permission !== key),
    }));
  };

  const saveRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetchApi(editingRole ? `/admin/roles/${editingRole.key}` : '/admin/roles', {
        method: editingRole ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message || 'Rolle konnte nicht gespeichert werden.');
      }
      toast.success(editingRole ? 'Rolle wurde aktualisiert.' : 'Rolle wurde angelegt.');
      setIsOpen(false);
      await loadRoles();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Rolle konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRole) return;
    setSaving(true);
    try {
      const response = await fetchApi(`/admin/roles/${deleteRole.key}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message || 'Rolle konnte nicht gelöscht werden.');
      }
      toast.success('Rolle wurde gelöscht.');
      setDeleteRole(null);
      await loadRoles();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Rolle konnte nicht gelöscht werden.');
    } finally {
      setSaving(false);
    }
  };

  const permissionGroups = permissionDefinitions.reduce<Record<string, PermissionDefinition[]>>((groups, permission) => {
    const group = permission.group || 'Weitere';
    groups[group] = [...(groups[group] || []), permission];
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Zugriffssteuerung</p>
          <h2 className="mt-1 text-2xl font-bold text-foreground">Rollen & Rechte</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">Erstellen Sie Rollen, kombinieren Sie einzelne Rechte und weisen Sie die Rollen anschließend Benutzern zu.</p>
        </div>
        <Button onPress={openCreate}><Plus className="h-4 w-4" />Neue Rolle</Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted">Rollen werden geladen …</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {roles.map((role) => {
            const protectedRole = role.key === 'admin' || role.key === 'user';
            return (
              <Card key={role.key} className="border border-border bg-surface">
                <Card.Header className="flex-row items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><ShieldCheck className="h-5 w-5" /></div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><Card.Title>{role.name}</Card.Title>{role.isSystem && <Chip size="sm" variant="soft"><LockKeyhole className="h-3 w-3" />Systemrolle</Chip>}</div>
                      <Card.Description>{role.description || 'Keine Beschreibung hinterlegt.'}</Card.Description>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!protectedRole && <Button isIconOnly size="sm" variant="tertiary" aria-label={`${role.name} bearbeiten`} onPress={() => openEdit(role)}><Pencil className="h-4 w-4" /></Button>}
                    {!role.isSystem && <Button isIconOnly size="sm" variant="tertiary" aria-label={`${role.name} löschen`} onPress={() => setDeleteRole(role)}><Trash2 className="h-4 w-4 text-danger" /></Button>}
                  </div>
                </Card.Header>
                <Card.Content className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted"><Users className="h-4 w-4" />{role.userCount} {role.userCount === 1 ? 'Benutzer' : 'Benutzer'}</div>
                  <div className="flex flex-wrap gap-2">
                    {role.key === 'admin' ? <Chip color="accent" variant="soft">Alle Rechte</Chip> : (role.permissions || []).length > 0 ? (role.permissions || []).map((permission) => {
                      const definition = permissionDefinitions.find((item) => item.key === permission);
                      return <Chip key={permission} variant="soft">{definition?.name || permission}</Chip>;
                    }) : <span className="text-sm text-muted">Keine zusätzlichen Rechte</span>}
                  </div>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}

      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
          <Modal.Container><Modal.Dialog className="sm:max-w-xl">
            <form onSubmit={saveRole}>
              <Modal.CloseTrigger />
              <Modal.Header><Modal.Heading>{editingRole ? 'Rolle bearbeiten' : 'Neue Rolle'}</Modal.Heading></Modal.Header>
              <Modal.Body className="space-y-5">
                <TextField isRequired onChange={(name) => setForm((current) => ({ ...current, name, key: editingRole ? current.key : slugify(name) }))}>
                  <Label>Name</Label><Input value={form.name} variant="secondary" placeholder="Zum Beispiel App-Redaktion" />
                </TextField>
                {!editingRole && <TextField isRequired onChange={(key) => setForm((current) => ({ ...current, key: slugify(key) }))}><Label>Technischer Schlüssel</Label><Input value={form.key} variant="secondary" placeholder="app-redaktion" /></TextField>}
                <TextField onChange={(description) => setForm((current) => ({ ...current, description }))}><Label>Beschreibung</Label><Input value={form.description} variant="secondary" placeholder="Wofür wird diese Rolle eingesetzt?" /></TextField>
                <div>
                  <Label className="mb-2 block">Berechtigungen</Label>
                  <div className="space-y-5">
                    {Object.entries(permissionGroups).map(([group, groupPermissions]) => (
                      <section key={group} className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{group}</h3>
                        <div className="space-y-3">
                          {groupPermissions.map((permission) => (
                            <Checkbox key={permission.key} isSelected={form.permissions.includes(permission.key)} onChange={(selected) => togglePermission(permission.key, selected)}>
                              <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><span><span className="block text-sm font-medium">{permission.name}</span><span className="block text-xs text-muted">{permission.description}</span></span></Checkbox.Content>
                            </Checkbox>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer><Button variant="tertiary" slot="close">Abbrechen</Button><Button type="submit" isDisabled={saving || !form.name || !form.key}>{saving ? 'Speichert …' : 'Speichern'}</Button></Modal.Footer>
            </form>
          </Modal.Dialog></Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmDialog isOpen={!!deleteRole} onOpenChange={(open) => !open && setDeleteRole(null)} title="Rolle löschen?" description={deleteRole?.userCount ? 'Diese Rolle ist noch Benutzern zugewiesen und kann erst nach einer Neuzuweisung gelöscht werden.' : 'Die Rolle und ihre Berechtigungen werden dauerhaft gelöscht.'} confirmLabel="Rolle löschen" isDanger isLoading={saving} onConfirm={confirmDelete} />
    </div>
  );
}
