'use client';

import { AppEditorsModal } from '@/components/AppEditorsModal';
import { AppTable } from '@/components/AppTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AppConfig, SystemUser } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { isDraftStatus } from '@/lib/appStatus';
import { Button, Modal, toast } from '@heroui/react';
import { Check, Loader2, Plus, ShieldCheck, UserRoundCog } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function AppsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Transfer ownership
  const [transferApp, setTransferApp] = useState<AppConfig | null>(null);
  const [editorApp, setEditorApp] = useState<AppConfig | null>(null);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [transferUserId, setTransferUserId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<AppConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const draftCount = apps.filter((app) => isDraftStatus(app.status)).length;

  const loadApps = async () => {
    try {
      const res = await fetchApi('/apps');
      if (res.ok) {
        const data = await res.json();
        setApps(data);
      } else {
        setError(`Fehler beim Laden der Apps: ${res.statusText}`);
      }
    } catch (err) {
      setError(`Verbindungsfehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetchApi('/users');
      if (res.ok) {
        const data = await res.json();
        const userList = Array.isArray(data) ? data : data.users || [];
        setUsers(userList.filter((u: SystemUser) => !u.disabled));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadApps();
      void loadUsers();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const handleCreateApp = () => {
    router.push('/verwaltung/katalog/apps/new');
  };

  const handleEditApp = (app: AppConfig) => {
    router.push(`/verwaltung/katalog/apps/${app.id}/edit`);
  };

  const handleCopyApp = (app: AppConfig) => {
    router.push(`/verwaltung/katalog/apps/new?copy=${encodeURIComponent(app.id)}`);
  };

  const handleDeleteApp = async (id: string) => {
    const app = apps.find((entry) => entry.id === id) || null;
    setDeleteCandidate(app);
  };

  const confirmDeleteApp = async () => {
    if (!deleteCandidate) return;

    setIsDeleting(true);
    try {
      const res = await fetchApi(`/apps/${deleteCandidate.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`"${deleteCandidate.name}" wurde entfernt.`);
        setDeleteCandidate(null);
        await loadApps();
      } else {
        toast.danger('Die App konnte nicht gelöscht werden.');
      }
    } catch {
      toast.danger('Beim Löschen ist ein Fehler aufgetreten.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleAppLock = async (app: AppConfig) => {
    try {
      const payload = { ...app, isLocked: !app.isLocked };
      const res = await fetchApi(`/apps/${app.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.ok) loadApps();
    } catch (err) { console.error(err); }
  };

  const handleBulkDelete = (ids: string[]) => {
    setBulkDeleteIds(ids);
  };

  const confirmBulkDelete = async () => {
    if (bulkDeleteIds.length === 0) return;
    setIsBulkDeleting(true);
    let failCount = 0;
    for (const id of bulkDeleteIds) {
      try {
        const res = await fetchApi(`/apps/${id}`, { method: 'DELETE' });
        if (!res.ok) failCount++;
      } catch {
        failCount++;
      }
    }
    setIsBulkDeleting(false);
    setBulkDeleteIds([]);
    if (failCount === 0) {
      toast.success(`${bulkDeleteIds.length} App${bulkDeleteIds.length !== 1 ? 's' : ''} gelöscht.`);
    } else {
      toast.warning(`${bulkDeleteIds.length - failCount} von ${bulkDeleteIds.length} Apps gelöscht. ${failCount} fehlgeschlagen.`);
    }
    await loadApps();
  };

  const handleBulkToggleLock = async (ids: string[], lock: boolean) => {
    let failCount = 0;
    for (const id of ids) {
      const app = apps.find((a) => a.id === id);
      if (!app) continue;
      try {
        const payload = { ...app, isLocked: lock };
        const res = await fetchApi(`/apps/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        if (!res.ok) failCount++;
      } catch {
        failCount++;
      }
    }
    if (failCount === 0) {
      toast.success(`${ids.length} App${ids.length !== 1 ? 's' : ''} ${lock ? 'gesperrt' : 'freigegeben'}.`);
    } else {
      toast.warning(`${ids.length - failCount} von ${ids.length} Apps ${lock ? 'gesperrt' : 'freigegeben'}. ${failCount} fehlgeschlagen.`);
    }
    await loadApps();
  };

  const handleOpenTransfer = (app: AppConfig) => {
    setTransferApp(app);
    setTransferUserId('');
  };

  const handleOpenEditors = (app: AppConfig) => {
    setEditorApp(app);
  };

  const handleSubmitTransfer = async () => {
    if (!transferApp || !transferUserId) return;
    setTransferring(true);
    try {
      const res = await fetchApi(`/apps/${transferApp.id}/transfer`, {
        method: 'PUT',
        body: JSON.stringify({ newOwnerId: transferUserId }),
      });
      if (res.ok) {
        setTransferApp(null);
        toast.success(`"${transferApp.name}" wurde übertragen.`);
        void loadApps();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.danger(err.message || 'Übertragung fehlgeschlagen');
      }
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Verbindungsfehler');
    } finally {
      setTransferring(false);
    }
  };

  // Deep linking: ?edit=<appId> → redirect to full editor page
  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (editId) {
      router.replace(`/verwaltung/katalog/apps/${editId}/edit`);
    }
  }, [searchParams, router]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted">
          {apps.length} App{apps.length !== 1 ? 's' : ''} im Store
          {draftCount > 0 ? `, davon ${draftCount} Entwurf${draftCount !== 1 ? 'e' : ''}` : ''}
        </p>
        <div className="flex gap-2">
          <Button
            className="bg-accent text-white gap-2 shadow-sm font-medium"
            size="sm"
            onPress={handleCreateApp}
          >
            <Plus className="w-4 h-4" /> App hinzufügen
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm font-medium flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex-grow">{error}</div>
          <Button size="sm" variant="secondary" onPress={loadApps} className="h-8">Wiederholen</Button>
        </div>
      )}

      <AppTable
        apps={apps}
        isLoading={loading}
        handleEditApp={handleEditApp}
        handleDeleteApp={handleDeleteApp}
        handleToggleAppLock={handleToggleAppLock}
        handleCopyApp={handleCopyApp}
        handleTransferApp={handleOpenTransfer}
        handleManageEditors={handleOpenEditors}
        onBulkDelete={handleBulkDelete}
        onBulkToggleLock={handleBulkToggleLock}
      />

      <AppEditorsModal
        app={editorApp}
        users={users}
        onOpenChange={(open) => { if (!open) setEditorApp(null); }}
        onSaved={loadApps}
      />

      {/* Transfer ownership modal */}
      <Modal.Backdrop isOpen={!!transferApp} onOpenChange={(open) => { if (!open) setTransferApp(null); }}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent">
                <UserRoundCog className="w-5 h-5" />
              </Modal.Icon>
              <Modal.Heading>Besitzer übertragen</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-muted mb-4">
                Übertragen Sie die Eigentümerschaft von <strong className="text-foreground">{transferApp?.name}</strong> auf einen anderen Benutzer.
              </p>
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Neuer Besitzer</p>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-surface divide-y divide-border/60">
                {users.filter(u => u.id !== transferApp?.ownerId).map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setTransferUserId(u.id)}
                    className={`w-full flex items-center gap-3 p-3 transition-colors text-left ${
                      transferUserId === u.id
                        ? 'bg-accent/10 text-accent'
                        : 'hover:bg-surface-secondary'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      transferUserId === u.id ? 'bg-accent text-white' : 'bg-surface-secondary text-muted'
                    }`}>
                      {u.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{u.username}</p>
                      <p className="text-xs text-muted truncate">{u.email}</p>
                    </div>
                    {transferUserId === u.id && <Check className="w-4 h-4 ml-auto text-accent shrink-0" />}
                  </button>
                ))}
                {users.filter(u => u.id !== transferApp?.ownerId).length === 0 && (
                  <p className="p-4 text-sm text-muted text-center">Keine weiteren Benutzer vorhanden</p>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setTransferApp(null)}>
                Abbrechen
              </Button>
              <Button
                className="bg-accent text-white"
                isDisabled={!transferUserId || transferring}
                onPress={handleSubmitTransfer}
              >
                {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Übertragen
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <ConfirmDialog
        confirmLabel="App löschen"
        description={deleteCandidate ? `Die App "${deleteCandidate.name}" wird dauerhaft aus dem Store entfernt.` : ''}
        isDanger
        isLoading={isDeleting}
        isOpen={!!deleteCandidate}
        onConfirm={confirmDeleteApp}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteCandidate(null);
        }}
        title="App wirklich löschen?"
      />

      <ConfirmDialog
        confirmLabel={`${bulkDeleteIds.length} Apps löschen`}
        description={`${bulkDeleteIds.length} App${bulkDeleteIds.length !== 1 ? 's' : ''} werden dauerhaft aus dem Store entfernt. Dieser Schritt kann nicht rückgängig gemacht werden.`}
        isDanger
        isLoading={isBulkDeleting}
        isOpen={bulkDeleteIds.length > 0}
        onConfirm={confirmBulkDelete}
        onOpenChange={(open) => { if (!open && !isBulkDeleting) setBulkDeleteIds([]); }}
        title={`${bulkDeleteIds.length} Apps löschen?`}
      />
    </div>
  );
}

export default function AppsPage() {
  return (
    <Suspense fallback={<div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>}>
      <AppsContent />
    </Suspense>
  );
}
