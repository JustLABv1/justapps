'use client';

import { AppEditorsModal } from '@/components/AppEditorsModal';
import { AppTable } from '@/components/AppTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CatalogSteward } from '@/components/admin/CatalogSteward';
import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
import { Dialog } from '@/components/panelui/dialog';
import { Input } from '@/components/panelui/input';
import { Spinner } from '@/components/panelui/spinner';
import { UserAvatar, authorName } from '@/components/profile/UserAvatar';
import { AppCatalogFilters, AppConfig, AppUserSummary, SystemUser } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { APP_STATUS_OPTIONS, isDraftStatus, sortAppStatuses } from '@/lib/appStatus';
import { toast } from '@/lib/toast';
import { Check, Plus, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

const FILTER_PARAM_KEYS: Array<keyof AppCatalogFilters> = [
  'q',
  'status',
  'category',
  'ownerId',
  'hasEditors',
  'syncStatus',
  'featured',
  'locked',
  'visibility',
];

function readFilters(searchParams: ReturnType<typeof useSearchParams>): AppCatalogFilters {
  return {
    q: searchParams?.get('q') ?? '',
    status: searchParams?.get('status') ?? '',
    category: searchParams?.get('category') ?? '',
    ownerId: searchParams?.get('ownerId') ?? '',
    hasEditors: searchParams?.get('hasEditors') ?? '',
    syncStatus: searchParams?.get('syncStatus') ?? '',
    featured: searchParams?.get('featured') ?? '',
    locked: searchParams?.get('locked') ?? '',
    visibility: searchParams?.get('visibility') ?? '',
  };
}

function buildAppsQuery(filters: AppCatalogFilters) {
  const params = new URLSearchParams();
  FILTER_PARAM_KEYS.forEach((key) => {
    const value = filters[key].trim();
    if (value) {
      params.set(key, value);
    }
  });
  return params;
}

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
  const [transferSearch, setTransferSearch] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<AppConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const appsQueryString = useMemo(() => buildAppsQuery(filters).toString(), [filters]);
  const draftCount = apps.filter((app) => isDraftStatus(app.status)).length;

  const categoryOptions = useMemo(
    () => Array.from(new Set(apps.flatMap((app) => app.categories || []))).sort((left, right) => left.localeCompare(right, 'de')),
    [apps]
  );
  const statusOptions = useMemo(
    () => sortAppStatuses(Array.from(new Set([...APP_STATUS_OPTIONS, ...apps.map((app) => app.status).filter(Boolean) as string[]]))),
    [apps]
  );
  const ownerOptions = useMemo(() => {
    const owners = new Map<string, AppUserSummary>();
    users.forEach((user) => {
      owners.set(user.id, { id: user.id, username: user.username, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl });
    });
    apps.forEach((app) => {
      if (app.owner) {
        owners.set(app.owner.id, app.owner);
      }
    });
    return Array.from(owners.values()).sort((left, right) => authorName(left).localeCompare(authorName(right), 'de'));
  }, [apps, users]);

  const updateFilters = useCallback((updates: Partial<AppCatalogFilters>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');

    Object.entries(updates).forEach(([key, value]) => {
      const nextValue = value?.trim() ?? '';
      if (nextValue) {
        params.set(key, nextValue);
      } else {
        params.delete(key);
      }
    });

    const query = params.toString();
    router.replace(query ? `/verwaltung/katalog/apps?${query}` : '/verwaltung/katalog/apps', { scroll: false });
  }, [router, searchParams]);

  const resetFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    FILTER_PARAM_KEYS.forEach((key) => params.delete(key));
    const query = params.toString();
    router.replace(query ? `/verwaltung/katalog/apps?${query}` : '/verwaltung/katalog/apps', { scroll: false });
  }, [router, searchParams]);

  const loadApps = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi(`/apps${appsQueryString ? `?${appsQueryString}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setApps(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setError((err as { message?: string }).message || `Fehler beim Laden der Apps: ${res.statusText}`);
      }
    } catch (err) {
      setError(`Verbindungsfehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [appsQueryString]);

  const loadUsers = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadApps();
      void loadUsers();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadApps, loadUsers]);

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
    setTransferSearch('');
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

  const transferCandidates = users
    .filter((user) => user.id !== transferApp?.ownerId)
    .filter((user) => {
      const query = transferSearch.trim().toLocaleLowerCase('de');
      return !query || [user.username, user.email, user.displayName ?? ''].some((value) => value.toLocaleLowerCase('de').includes(query));
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Apps verwalten</h1>
          <p className="text-muted-foreground">
            {loading ? 'Apps werden geladen …' : `${apps.length} ${apps.length === 1 ? 'App' : 'Apps'}${draftCount > 0 ? `, davon ${draftCount} ${draftCount === 1 ? 'Entwurf' : 'Entwürfe'}` : ''}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CatalogSteward />
          <Button onClick={handleCreateApp}>
            <Plus />
            Neue App
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
          <Alert.Actions>
            <Button size="sm" variant="secondary" onClick={() => void loadApps()}>Erneut versuchen</Button>
          </Alert.Actions>
        </Alert>
      )}

      <AppTable
        apps={apps}
        categoryOptions={categoryOptions}
        filters={filters}
        isLoading={loading}
        ownerOptions={ownerOptions}
        handleEditApp={handleEditApp}
        handleDeleteApp={handleDeleteApp}
        handleToggleAppLock={handleToggleAppLock}
        handleCopyApp={handleCopyApp}
        handleTransferApp={handleOpenTransfer}
        handleManageEditors={handleOpenEditors}
        onFilterChange={updateFilters}
        onResetFilters={resetFilters}
        onBulkDelete={handleBulkDelete}
        onBulkToggleLock={handleBulkToggleLock}
        statusOptions={statusOptions}
      />

      <AppEditorsModal
        key={editorApp?.id ?? 'no-editor-app'}
        app={editorApp}
        users={users}
        onOpenChange={(open) => { if (!open) setEditorApp(null); }}
        onSaved={loadApps}
      />

      <Dialog open={!!transferApp} onOpenChange={(open) => { if (!open && !transferring) setTransferApp(null); }}>
        <Dialog.Content>
          <Dialog.Header
            title="Eigentümer übertragen"
            description={<>Wer soll künftig für <strong className="font-medium text-foreground">{transferApp?.name}</strong> verantwortlich sein?</>}
          />
          <Dialog.Body className="flex flex-col gap-3">
            <Input.Group size="sm">
              <Input.Addon><Search /></Input.Addon>
              <Input aria-label="Benutzer suchen" placeholder="Name oder E-Mail" value={transferSearch} onChange={(event) => setTransferSearch(event.target.value)} />
            </Input.Group>
            <div role="radiogroup" aria-label="Neuer Eigentümer" className="max-h-72 divide-y overflow-y-auto rounded-xl border">
              {transferCandidates.map((user) => {
                const chosen = transferUserId === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    onClick={() => setTransferUserId(user.id)}
                    className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-start outline-none transition-colors focus-visible:bg-muted ${chosen ? 'bg-muted' : 'hover:bg-muted/60'}`}
                  >
                    <UserAvatar user={user} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{authorName(user)}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </span>
                    {chosen && <Check className="size-4 shrink-0 text-success" />}
                  </button>
                );
              })}
              {transferCandidates.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Niemand gefunden.</p>}
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close render={<Button variant="secondary" disabled={transferring} />}>Abbrechen</Dialog.Close>
            <Button disabled={!transferUserId} loading={transferring} onClick={() => void handleSubmitTransfer()}>Übertragen</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>

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
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
      <AppsContent />
    </Suspense>
  );
}
