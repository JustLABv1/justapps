"use client";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { fetchApi } from "@/lib/api";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Checkbox } from "@/components/panelui/checkbox";
import { Dialog } from "@/components/panelui/dialog";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { toast } from "@/lib/toast";
import {
  LockKeyhole,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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

const emptyForm = {
  key: "",
  name: "",
  description: "",
  permissions: [] as string[],
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function RoleSettingsPanel() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [permissionDefinitions, setPermissionDefinitions] = useState<
    PermissionDefinition[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<RoleDefinition | null>(null);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi("/admin/roles");
      if (!response.ok) throw new Error("Rollen konnten nicht geladen werden.");
      const data = (await response.json()) as {
        roles: RoleDefinition[];
        permissions: PermissionDefinition[];
      };
      setRoles(
        (data.roles || []).map((role) => ({
          ...role,
          permissions: role.permissions || [],
        })),
      );
      setPermissionDefinitions(data.permissions || []);
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Rollen konnten nicht geladen werden.",
      );
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
    setForm({
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: [...(role.permissions || [])],
    });
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
      const response = await fetchApi(
        editingRole ? `/admin/roles/${editingRole.key}` : "/admin/roles",
        {
          method: editingRole ? "PUT" : "POST",
          body: JSON.stringify(form),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          body.message || "Rolle konnte nicht gespeichert werden.",
        );
      }
      toast.success(
        editingRole ? "Rolle wurde aktualisiert." : "Rolle wurde angelegt.",
      );
      setIsOpen(false);
      await loadRoles();
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Rolle konnte nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRole) return;
    setSaving(true);
    try {
      const response = await fetchApi(`/admin/roles/${deleteRole.key}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message || "Rolle konnte nicht gelöscht werden.");
      }
      toast.success("Rolle wurde gelöscht.");
      setDeleteRole(null);
      await loadRoles();
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Rolle konnte nicht gelöscht werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  const permissionGroups = permissionDefinitions.reduce<
    Record<string, PermissionDefinition[]>
  >((groups, permission) => {
    const group = permission.group || "Weitere";
    groups[group] = [...(groups[group] || []), permission];
    return groups;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Rollen & Rechte</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Erstellen Sie Rollen, kombinieren Sie einzelne Rechte und weisen Sie
            die Rollen anschließend Benutzern zu.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus />
          Neue Rolle
        </Button>
      </div>

      {loading ? (
        <p role="status" className="py-10 text-center text-sm text-muted-foreground">
          Rollen werden geladen …
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {roles.map((role) => {
            const protectedRole = role.key === "admin" || role.key === "user";
            return (
              <Card key={role.key}>
                <Card.Header>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <ShieldCheck className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Card.Title>{role.name}</Card.Title>
                          {role.isSystem && (
                            <Badge variant="secondary" size="sm">
                              <LockKeyhole />
                              Systemrolle
                            </Badge>
                          )}
                        </div>
                        <Card.Description>
                          {role.description || "Keine Beschreibung hinterlegt."}
                        </Card.Description>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!protectedRole && (
                        <Button variant="ghost" size="icon-sm" aria-label={`${role.name} bearbeiten`} onClick={() => openEdit(role)}>
                          <Pencil />
                        </Button>
                      )}
                      {!role.isSystem && (
                        <Button variant="ghost" size="icon-sm" aria-label={`${role.name} löschen`} onClick={() => setDeleteRole(role)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card.Header>
                <Card.Content className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="size-4" />
                    {role.userCount} {role.userCount === 1 ? "Benutzer" : "Benutzer"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {role.key === "admin" ? (
                      <Badge variant="default">Alle Rechte</Badge>
                    ) : (role.permissions || []).length > 0 ? (
                      (role.permissions || []).map((permission) => {
                        const definition = permissionDefinitions.find((item) => item.key === permission);
                        return (
                          <Badge key={permission} variant="secondary">
                            {definition?.name || permission}
                          </Badge>
                        );
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Keine zusätzlichen Rechte
                      </span>
                    )}
                  </div>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => { if (!saving) setIsOpen(open); }}>
        <Dialog.Content size="lg">
          <form onSubmit={saveRole} className="flex min-h-0 flex-col">
            <Dialog.Header title={editingRole ? "Rolle bearbeiten" : "Neue Rolle"} />
            <Dialog.Body className="flex flex-col gap-5">
              <Field>
                <Field.Label required>Name</Field.Label>
                <Input
                  required
                  value={form.name}
                  placeholder="Zum Beispiel App-Redaktion"
                  onChange={(event) => {
                    const name = event.target.value;
                    setForm((current) => ({ ...current, name, key: editingRole ? current.key : slugify(name) }));
                  }}
                />
              </Field>
              {!editingRole && (
                <Field>
                  <Field.Label required>Technischer Schlüssel</Field.Label>
                  <Input
                    required
                    value={form.key}
                    placeholder="app-redaktion"
                    onChange={(event) => setForm((current) => ({ ...current, key: slugify(event.target.value) }))}
                  />
                </Field>
              )}
              <Field>
                <Field.Label>Beschreibung</Field.Label>
                <Input
                  value={form.description}
                  placeholder="Wofür wird diese Rolle eingesetzt?"
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </Field>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Berechtigungen</p>
                {Object.entries(permissionGroups).map(([group, groupPermissions]) => (
                  <section key={group} className="rounded-xl bg-muted/40 p-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</h3>
                    <div className="flex flex-col gap-3">
                      {groupPermissions.map((permission) => (
                        <label key={permission.key} className="flex cursor-pointer items-start gap-3">
                          <Checkbox
                            className="mt-0.5"
                            label={permission.name}
                            checked={form.permissions.includes(permission.key)}
                            onCheckedChange={(selected) => togglePermission(permission.key, selected === true)}
                          />
                          <span>
                            <span className="block text-sm font-medium">{permission.name}</span>
                            <span className="block text-xs text-muted-foreground">{permission.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.Close render={<Button type="button" variant="secondary" disabled={saving} />}>Abbrechen</Dialog.Close>
              <Button type="submit" loading={saving} disabled={!form.name || !form.key}>Speichern</Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deleteRole}
        onOpenChange={(open) => !open && setDeleteRole(null)}
        title="Rolle löschen?"
        description={
          deleteRole?.userCount
            ? "Diese Rolle ist noch Benutzern zugewiesen und kann erst nach einer Neuzuweisung gelöscht werden."
            : "Die Rolle und ihre Berechtigungen werden dauerhaft gelöscht."
        }
        confirmLabel="Rolle löschen"
        isDanger
        isLoading={saving}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
