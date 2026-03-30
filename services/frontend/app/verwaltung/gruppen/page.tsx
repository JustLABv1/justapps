'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { fetchApi } from '@/lib/api';
import { Button, Input, Label, TextArea, TextField, toast } from '@heroui/react';
import { Layers2, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AppGroup {
  id: string;
  name: string;
  description?: string;
}

interface GroupFormState {
  name: string;
  description: string;
}

const emptyForm: GroupFormState = { name: '', description: '' };

export default function VerwaltungGruppenPage() {
  const [groups, setGroups] = useState<AppGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GroupFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AppGroup | null>(null);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/app-groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGroups(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (group: AppGroup) => {
    setEditingId(group.id);
    setForm({ name: group.name, description: group.description ?? '' });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = { name: form.name.trim(), description: form.description.trim() || undefined };
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
            <button onClick={cancelForm} className="text-muted hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
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
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-secondary/50">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden sm:table-cell">Beschreibung</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((group) => (
                <tr key={group.id} className="hover:bg-surface-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                        <Layers2 className="w-3.5 h-3.5" />
                      </span>
                      <span className="font-medium text-foreground">{group.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted hidden sm:table-cell">
                    {group.description || <span className="italic text-muted/50">–</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(group)}
                        className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-default transition-colors"
                        title="Bearbeiten"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(group)}
                        className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Gruppe löschen"
        description={`Die Gruppe „${deleteTarget?.name}" wird dauerhaft gelöscht. Apps werden nicht gelöscht, nur aus der Gruppe entfernt.`}
        confirmLabel="Löschen"
        isDanger={true}
        onConfirm={handleDelete}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      />
    </div>
  );
}
