'use client';

import { AppConfig, AppEditorUser, SystemUser } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { Button, Chip, EmptyState, Input, Modal, toast } from '@heroui/react';
import { Check, Loader2, Search, UserRoundCog, UsersRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface AppEditorsModalProps {
  app: AppConfig | null;
  users: SystemUser[];
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void | Promise<void>;
}

function userMatchesSearch(user: SystemUser, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [user.username, user.email, user.role, user.authType]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(query));
}

export function AppEditorsModal({ app, users, onOpenChange, onSaved }: AppEditorsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(Boolean(app));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!app) {
      return;
    }

    let active = true;
    fetchApi(`/apps/${app.id}/editors`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((data as { message?: string }).message || 'Bearbeiter konnten nicht geladen werden.');
        }
        if (!active) return;
        const editors = ((data as { editors?: AppEditorUser[] }).editors || []).filter((user) => !user.disabled);
        setError(null);
        setSelectedIds(new Set(editors.map((user) => user.id)));
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Bearbeiter konnten nicht geladen werden.');
        setSelectedIds(new Set());
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [app]);

  const selectableUsers = useMemo(
    () => users.filter((user) => !user.disabled && user.id !== app?.ownerId),
    [app?.ownerId, users]
  );

  const filteredUsers = useMemo(
    () => selectableUsers.filter((user) => userMatchesSearch(user, search)),
    [search, selectableUsers]
  );

  const selectedUsers = useMemo(
    () => selectableUsers.filter((user) => selectedIds.has(user.id)),
    [selectableUsers, selectedIds]
  );

  const toggleUser = (userId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const removeUser = (userId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(userId);
      return next;
    });
  };

  const saveEditors = async () => {
    if (!app) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetchApi(`/apps/${app.id}/editors`, {
        method: 'PUT',
        body: JSON.stringify({ userIds: Array.from(selectedIds) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { message?: string }).message || 'Bearbeiter konnten nicht gespeichert werden.');
      }
      toast.success('Bearbeiter wurden gespeichert.');
      await onSaved?.();
      onOpenChange(false);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Bearbeiter konnten nicht gespeichert werden.';
      setError(message);
      toast.danger(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal.Backdrop isOpen={!!app} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="max-w-2xl">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent">
              <UsersRound className="w-5 h-5" />
            </Modal.Icon>
            <Modal.Heading>Bearbeiter verwalten</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted">
                  <strong className="text-foreground">{app?.name}</strong> kann von ausgewählten Benutzern bearbeitet werden, ohne die Eigentümerschaft zu übertragen.
                </p>
                {app?.owner && (
                  <p className="mt-1 text-xs text-muted">
                    Besitzer: <span className="font-medium text-foreground">{app.owner.username}</span>
                  </p>
                )}
              </div>

              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <Chip key={user.id} size="sm" variant="soft" color="accent" className="gap-1 text-xs font-semibold">
                      {user.username}
                      <button type="button" onClick={() => removeUser(user.id)} className="opacity-70 hover:opacity-100">
                        <X className="w-3 h-3" />
                      </button>
                    </Chip>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none" />
                <Input
                  className="w-full pl-9"
                  placeholder="Benutzer suchen..."
                  value={search}
                  variant="secondary"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <div className="max-h-80 overflow-y-auto rounded-xl border border-border bg-surface divide-y divide-border/60">
                {loading ? (
                  <div className="flex items-center justify-center gap-3 p-8 text-sm text-muted">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    Bearbeiter werden geladen...
                  </div>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => {
                    const selected = selectedIds.has(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleUser(user.id)}
                        className={`flex w-full items-center gap-3 p-3 text-left transition-colors ${selected ? 'bg-accent/10 text-accent' : 'hover:bg-surface-secondary'}`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${selected ? 'bg-accent text-white' : 'bg-surface-secondary text-muted'}`}>
                          {user.username[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{user.username}</p>
                          <p className="truncate text-xs text-muted">{user.email}</p>
                        </div>
                        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                          {user.authType || user.role}
                        </span>
                        {selected ? <Check className="h-4 w-4 shrink-0 text-accent" /> : <UserRoundCog className="h-4 w-4 shrink-0 text-muted" />}
                      </button>
                    );
                  })
                ) : (
                  <EmptyState className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                    <UsersRound className="h-8 w-8 text-muted opacity-50" />
                    <span className="text-sm text-muted">Keine passenden Benutzer gefunden</span>
                  </EmptyState>
                )}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={() => onOpenChange(false)} isDisabled={saving}>
              Abbrechen
            </Button>
            <Button className="bg-accent text-white" onPress={saveEditors} isDisabled={saving || loading}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Speichern
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
