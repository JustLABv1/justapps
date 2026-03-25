'use client';

import { AppTable } from '@/components/AppTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { isDraftStatus } from '@/lib/appStatus';
import { Button, Modal, toast } from '@heroui/react';
import { Check, Download, Loader2, Plus, ShieldCheck, Upload, UserRoundCog } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

interface SystemUser {
  id: string;
  username: string;
  email: string;
  role: string;
  disabled: boolean;
}

function AppsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Transfer ownership
  const [transferApp, setTransferApp] = useState<AppConfig | null>(null);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [transferUserId, setTransferUserId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<AppConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
        setUsers((data || []).filter((u: SystemUser) => !u.disabled));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadApps(); loadUsers(); }, []);

  const handleCreateApp = () => {
    router.push('/verwaltung/apps/new');
  };

  const handleEditApp = (app: AppConfig) => {
    router.push(`/verwaltung/apps/${app.id}/edit`);
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

  const handleOpenTransfer = (app: AppConfig) => {
    setTransferApp(app);
    setTransferUserId('');
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
        loadApps();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message || 'Übertragung fehlgeschlagen');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindungsfehler');
    } finally {
      setTransferring(false);
    }
  };

  const handleExportApps = async () => {
    try {
      const res = await fetchApi('/apps/export');
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `apps-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        toast.danger('Der Export ist fehlgeschlagen.');
      }
    } catch (err) {
      console.error(err);
      toast.danger('Der Export ist fehlgeschlagen.');
    }
  };

  const handleImportApps = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const appsData = JSON.parse(event.target?.result as string);
        const res = await fetchApi('/apps/import', { method: 'POST', body: JSON.stringify(appsData) });
        if (res.ok) {
          const result = await res.json().catch(() => null);
          const importedCount = typeof result?.importedCount === 'number' ? result.importedCount : Array.isArray(appsData) ? appsData.length : null;
          const importedDraftCount = typeof result?.draftCount === 'number' ? result.draftCount : null;
          const parts = [importedCount !== null ? `${importedCount} Apps importiert` : 'Apps wurden erfolgreich importiert'];
          if (importedDraftCount !== null) {
            parts.push(`${importedDraftCount} Entwürfe`);
          }
          toast.success(parts.join(' · '));
          loadApps();
        } else {
          toast.danger('Der Import ist fehlgeschlagen.');
        }
      } catch (err) {
        console.error(err);
        toast.danger('Die Datei konnte nicht importiert werden.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Deep linking: ?edit=<appId> → redirect to full editor page
  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (editId) {
      router.replace(`/verwaltung/apps/${editId}/edit`);
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
          <Button variant="secondary" size="sm" onPress={handleExportApps} className="gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={handleImportApps}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <Button variant="secondary" size="sm" className="gap-2">
              <Upload className="w-4 h-4" /> Import
            </Button>
          </div>
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

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : (
        <AppTable
          apps={apps}
          handleEditApp={handleEditApp}
          handleDeleteApp={handleDeleteApp}
          handleToggleAppLock={handleToggleAppLock}
          handleTransferApp={handleOpenTransfer}
        />
      )}

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
