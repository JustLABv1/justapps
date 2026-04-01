'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { GroupIcon } from '@/components/GroupIcon';
import { fetchApi, uploadFile } from '@/lib/api';
import { Button, Chip, Input, Label, TextArea, TextField, toast } from '@heroui/react';
import { ChevronDown, ChevronUp, Layers2, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import Image from 'next/image';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';

interface AppSummary {
  id: string;
  name: string;
  icon?: string;
}

interface AppGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  members?: AppSummary[];
  membersLoading?: boolean;
}

interface GroupFormState {
  name: string;
  description: string;
  icon: string;
}

const emptyForm: GroupFormState = { name: '', description: '', icon: '' };

export default function VerwaltungGruppenPage() {
  const [groups, setGroups] = useState<AppGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GroupFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AppGroup | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/app-groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(Array.isArray(data) ? data.map((g: AppGroup) => ({ ...g, members: undefined })) : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGroups(); }, []);

  const loadMembers = async (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => g.id === groupId ? { ...g, membersLoading: true } : g)
    );
    try {
      const res = await fetchApi(`/app-groups/${groupId}/members`);
      if (res.ok) {
        const data: AppSummary[] = await res.json();
        setGroups((prev) =>
          prev.map((g) => g.id === groupId ? { ...g, members: data, membersLoading: false } : g)
        );
      } else {
        setGroups((prev) =>
          prev.map((g) => g.id === groupId ? { ...g, members: [], membersLoading: false } : g)
        );
      }
    } catch {
      setGroups((prev) =>
        prev.map((g) => g.id === groupId ? { ...g, members: [], membersLoading: false } : g)
      );
    }
  };

  const toggleExpand = (groupId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
        const group = groups.find((g) => g.id === groupId);
        if (group && group.members === undefined) {
          loadMembers(groupId);
        }
      }
      return next;
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (group: AppGroup) => {
    setEditingId(group.id);
    setForm({ name: group.name, description: group.description ?? '', icon: group.icon ?? '' });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setUploadError(null);
  };

  const handleIconUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingIcon(true);
    setUploadError(null);

    try {
      const iconUrl = await uploadFile('/upload/logo', file);
      setForm((previous) => ({ ...previous, icon: iconUrl }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload fehlgeschlagen.');
    } finally {
      setUploadingIcon(false);
      event.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        icon: form.icon.trim() || undefined,
      };
      const res = editingId
        ? await fetchApi(`/app-groups/${editingId}`, { method: 'PUT', body: JSON.stringify(body) })
        : await fetchApi('/app-groups', { method: 'POST', body: JSON.stringify(body) });

      if (res.ok) {
        toast.success(editingId ? 'Gruppe aktualisiert.' : 'Gruppe angelegt.');
        cancelForm();
        await loadGroups();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.danger((err as { message?: string }).message || 'Speichern fehlgeschlagen.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchApi(`/app-groups/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Gruppe gelöscht.');
        setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id));
        setExpandedIds((prev) => { const next = new Set(prev); next.delete(deleteTarget.id); return next; });
      } else {
        const err = await res.json().catch(() => ({}));
        toast.danger((err as { message?: string }).message || 'Löschen fehlgeschlagen.');
      }
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">App-Gruppen</h2>
          <p className="text-sm text-muted mt-0.5">Thematische Sammlungen von Apps verwalten</p>
        </div>
        <Button onPress={openCreate} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Gruppe anlegen
        </Button>
      </div>

      {/* Inline create / edit form */}
      {showForm && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {editingId ? 'Gruppe bearbeiten' : 'Neue Gruppe'}
            </p>
            <Button isIconOnly variant="ghost" size="sm" onPress={cancelForm} aria-label="Formular schließen">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField isRequired onChange={(v) => setForm((p) => ({ ...p, name: v }))}>
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Name</Label>
              <Input value={form.name} placeholder="z.B. KI-Tools" className="bg-field-background" />
            </TextField>
            <TextField onChange={(v) => setForm((p) => ({ ...p, description: v }))}>
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Beschreibung (optional)</Label>
              <TextArea value={form.description} placeholder="Kurze Beschreibung der Gruppe..." className="bg-field-background resize-none" rows={1} />
            </TextField>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Logo / Icon</p>
              <p className="mt-1 text-xs text-muted">Emoji oder Bild-URL, optional.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-h-[78px] items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
                <GroupIcon icon={form.icon} name={form.name || 'Gruppe'} className="h-12 w-12 rounded-2xl bg-accent/10 text-accent" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Vorschau</p>
                  <p className="text-xs text-muted">So erscheint die Gruppe in Listen und Details.</p>
                </div>
              </div>

              <TextField value={form.icon} onChange={(value) => setForm((previous) => ({ ...previous, icon: value }))}>
                <Input value={form.icon} placeholder="https://... oder 🧩" className="bg-field-background" />
              </TextField>

              <div className="flex lg:justify-end">
                <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                <Button variant="secondary" size="sm" className="gap-1.5" isDisabled={uploadingIcon} onPress={() => iconInputRef.current?.click()}>
                  {uploadingIcon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploadingIcon ? 'Laedt...' : 'Upload'}
                </Button>
              </div>
            </div>
          </div>
          {uploadError && <p className="text-xs text-danger">{uploadError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onPress={cancelForm} isDisabled={saving}>Abbrechen</Button>
            <Button size="sm" onPress={handleSave} isDisabled={!form.name.trim() || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingId ? 'Speichern' : 'Anlegen'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3 rounded-2xl border border-dashed border-border bg-surface-secondary/30">
          <Layers2 className="w-10 h-10 text-muted/40" />
          <p className="text-base font-semibold text-foreground">Noch keine Gruppen vorhanden</p>
          <p className="text-sm text-muted">Legen Sie die erste Gruppe an, um Apps thematisch zu bündeln.</p>
          <Button size="sm" onPress={openCreate} className="mt-1 gap-1.5">
            <Plus className="w-4 h-4" />
            Erste Gruppe anlegen
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border">
          {groups.map((group) => {
            const isExpanded = expandedIds.has(group.id);
            return (
              <div key={group.id}>
                {/* Group header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary/30 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(group.id)}
                >
                  <GroupIcon icon={group.icon} name={group.name} className="h-7 w-7 rounded-lg bg-accent/10 text-accent shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{group.name}</span>
                      {group.members !== undefined && !group.membersLoading && (
                        <Chip size="sm" variant="soft" className="text-[10px] font-bold uppercase tracking-wider">
                          {group.members.length} App{group.members.length !== 1 ? 's' : ''}
                        </Chip>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-xs text-muted mt-0.5 truncate max-w-md">{group.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="tertiary"
                      onPress={() => openEdit(group)}
                      aria-label="Gruppe bearbeiten"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="danger-soft"
                      onPress={() => setDeleteTarget(group)}
                      aria-label="Gruppe löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="text-muted shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded member list */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 bg-surface-secondary/20 border-t border-border/50">
                    {group.membersLoading ? (
                      <div className="flex items-center gap-2 py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                        <span className="text-sm text-muted">Apps werden geladen…</span>
                      </div>
                    ) : group.members && group.members.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {group.members.map((app) => (
                          <div
                            key={app.id}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-surface shadow-sm"
                          >
                            <div className="relative w-5 h-5 shrink-0">
                              {app.icon?.startsWith('http') ? (
                                <Image src={app.icon} alt={app.name} fill className="object-contain rounded" sizes="20px" unoptimized />
                              ) : (
                                <span className="text-sm leading-none">{app.icon || '🏛️'}</span>
                              )}
                            </div>
                            <span className="text-xs font-medium text-foreground whitespace-nowrap">{app.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted italic py-3">Keine Apps in dieser Gruppe.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Gruppe löschen"
        description={`Die Gruppe „${deleteTarget?.name}“ wird dauerhaft gelöscht. Apps werden nicht gelöscht, nur aus der Gruppe entfernt.`}
        confirmLabel="Löschen"
        isDanger={true}
        onConfirm={handleDelete}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      />
    </div>
  );
}
