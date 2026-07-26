'use client';

import { AppEditorsModal } from '@/components/AppEditorsModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AppConfig, SystemUser } from '@/config/apps';
import { getAppStatusMeta } from '@/lib/appStatus';
import { getImageAssetUrl } from '@/lib/assets';
import {
    Button,
    Card,
    Chip,
    Dropdown,
    Input,
    toast
} from '@heroui/react';
import {
    ChevronLeft,
    Copy,
    ExternalLink,
    Lock,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    UsersRound
} from 'lucide-react';
import Image from "next/image";
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../lib/api';

function MyAppsCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 animate-pulse">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-surface-secondary shrink-0" />
        <div className="flex-grow space-y-3 w-full">
          <div className="flex gap-2 justify-center md:justify-start">
            <div className="h-5 w-40 bg-surface-secondary rounded" />
            <div className="h-5 w-20 bg-surface-secondary rounded-full" />
          </div>
          <div className="h-3 w-full max-w-md bg-surface-secondary rounded" />
          <div className="h-3 w-3/4 max-w-xs bg-surface-secondary rounded" />
          <div className="flex gap-2 justify-center md:justify-start">
            <div className="h-5 w-24 bg-surface-secondary rounded-md" />
            <div className="h-5 w-20 bg-surface-secondary rounded-md" />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="h-8 w-24 bg-surface-secondary rounded" />
          <div className="h-8 w-24 bg-surface-secondary rounded" />
          <div className="h-8 w-20 bg-surface-secondary rounded" />
        </div>
      </div>
    </div>
  );
}

function MyAppsContent() {
  const { user, loading: authLoading, profileReady, profileError, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [settings, setSettings] = useState({ allowAppSubmissions: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<AppConfig | null>(null);
  const [editorApp, setEditorApp] = useState<AppConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [query, setQuery] = useState('');

  // Auth check
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        const timer = setTimeout(() => {
          if (!user) router.push('/');
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    if (!user || !profileReady) return;
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, appsRes] = await Promise.all([
        fetchApi('/settings'),
        fetchApi('/apps?editable=me'),
      ]);
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      }
      if (appsRes.ok) {
        const data: AppConfig[] = await appsRes.json();
        setApps(data);
      } else {
        setError(`Fehler beim Laden Ihrer Apps: ${appsRes.statusText}`);
      }
      const usersRes = await fetchApi('/users');
      if (usersRes.ok) {
        const data = await usersRes.json();
        const userList = Array.isArray(data) ? data : data.users || [];
        setUsers(userList.filter((entry: SystemUser) => !entry.disabled));
      }
    } catch (err) {
      setError(`Verbindungsfehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profileReady) return;

    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileReady]);

  const handleCreateApp = async () => {
    if (!profileReady) {
      const refreshed = await refreshUser();
      if (!refreshed) {
        toast.danger('Ihr Benutzerprofil ist noch nicht bereit. Bitte erneut versuchen.');
        return;
      }
    }
    if (!user?.canSubmitApps && user?.role !== 'admin') {
      toast.warning('Ihr Konto ist aktuell nicht für neue App-Einreichungen freigeschaltet.');
      return;
    }
    if (!settings.allowAppSubmissions && user?.role !== 'admin') {
      toast.info('App-Einreichungen sind derzeit systemweit deaktiviert.');
      return;
    }
    router.push('/meine-apps/new');
  };

  const handleCopyApp = async (app: AppConfig) => {
    const canCopy = user?.role === 'admin' || app.ownerId === user?.id;
    if (!canCopy) {
      toast.info('Sie können nur eigene Apps kopieren.');
      return;
    }
    if (!profileReady) {
      const refreshed = await refreshUser();
      if (!refreshed) {
        toast.danger('Ihr Benutzerprofil ist noch nicht bereit. Bitte erneut versuchen.');
        return;
      }
    }
    if (!user?.canSubmitApps && user?.role !== 'admin') {
      toast.warning('Ihr Konto ist aktuell nicht für neue App-Einreichungen freigeschaltet.');
      return;
    }
    if (!settings.allowAppSubmissions && user?.role !== 'admin') {
      toast.info('App-Einreichungen sind derzeit systemweit deaktiviert.');
      return;
    }
    router.push(`/meine-apps/new?copy=${encodeURIComponent(app.id)}`);
  };

  const handleEditApp = (app: AppConfig) => {
    const permissions = getAppPermissions(app);
    if (app.isLocked || !permissions.canEdit) return;
    router.push(`/meine-apps/${app.id}/edit`);
  };

  const handleDeleteApp = (app: AppConfig) => {
    const permissions = getAppPermissions(app);
    if (app.isLocked || !permissions.canDelete) return;
    setDeleteCandidate(app);
  };

  const getAppPermissions = (app: AppConfig) => {
    const isOwnerOrAdmin = user?.role === 'admin' || app.ownerId === user?.id;
    return {
      canEdit: app.viewerPermissions?.canEdit ?? isOwnerOrAdmin,
      canDelete: app.viewerPermissions?.canDelete ?? isOwnerOrAdmin,
      canManageEditors: app.viewerPermissions?.canManageEditors ?? isOwnerOrAdmin,
      accessRole: app.viewerPermissions?.accessRole ?? (isOwnerOrAdmin ? (user?.role === 'admin' ? 'admin' : 'owner') : 'viewer'),
    };
  };

  const handleManageEditors = (app: AppConfig) => {
    const permissions = getAppPermissions(app);
    if (!permissions.canManageEditors) return;
    setEditorApp(app);
  };

  const confirmDeleteApp = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      const res = await fetchApi(`/apps/${deleteCandidate.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`"${deleteCandidate.name}" wurde gelöscht.`);
        setDeleteCandidate(null);
        await loadData();
      } else {
        toast.danger('Die App konnte nicht gelöscht werden.');
      }
    } catch {
      toast.danger('Beim Löschen der App ist ein Fehler aufgetreten.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Deep linking: ?edit=<id> → redirect to full editor page
  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (editId) router.replace(`/meine-apps/${editId}/edit`);
  }, [searchParams, router]);

  const visibleApps = apps.filter((app) => {
    const search = query.trim().toLowerCase();
    return !search || [app.name, app.id, app.description, ...(app.categories || [])].some((value) => value?.toLowerCase().includes(search));
  });

  if (authLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      <p className="text-muted font-medium">Authentifizierung wird geprüft…</p>
    </div>
  );

  if (!user) return null;

  if (!profileReady) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 pb-8 md:pb-10">
        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Profil wird noch synchronisiert</h1>
          <p className="text-sm text-muted mb-4">
            {profileError || 'Nach der Anmeldung wird Ihr Benutzerprofil gerade mit dem Backend abgeglichen. Versuchen Sie es in wenigen Sekunden erneut.'}
          </p>
          <Button onPress={() => void refreshUser()}>Erneut laden</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <header className="flex flex-col gap-6 border-b border-border pb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Arbeitsbereich</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Meine Apps</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">Verwalten Sie Ihre eigenen Apps und Lösungen, für die Sie freigegeben sind.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onPress={() => router.push('/')}>
            <ChevronLeft className="h-4 w-4" />
            Zum Store
          </Button>
          <Button onPress={handleCreateApp} isDisabled={user.role !== 'admin' && (!user.canSubmitApps || !settings.allowAppSubmissions)}>
            <Plus className="h-4 w-4" />
            Neue App
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm font-medium flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex-grow">{error}</div>
          <Button size="sm" variant="secondary" onPress={loadData} className="h-8">Wiederholen</Button>
        </div>
      )}

      <div className="pt-6">
        {!settings.allowAppSubmissions && user.role !== 'admin' && !user.canSubmitApps && (
          <div className="flex flex-col md:flex-row gap-4 pb-4 justify-end items-center">
            {!settings.allowAppSubmissions && user.role !== 'admin' && (
              <div className="flex items-center text-danger text-sm font-bold bg-danger/10 px-3 py-2 rounded-lg md:mr-auto w-full md:w-auto border border-danger/20">
                <Lock className="w-4 h-4 mr-2" />
                App-Einreichungen sind derzeit systemweit deaktiviert.
              </div>
            )}
            {!user.canSubmitApps && (
              <div className="flex items-center text-danger text-sm font-bold bg-danger/10 px-3 py-2 rounded-lg md:mr-auto w-full md:w-auto border border-danger/20">
                <Lock className="w-4 h-4 mr-2" />
                Ihr Konto ist für die Einreichung von Apps gesperrt.
              </div>
            )}
          </div>
        )}

        <Card variant="default" className="overflow-hidden border-border shadow-sm">
          <div className="relative flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div><h2 className="font-semibold text-foreground">Apps</h2><p className="text-sm text-muted">{loading ? 'Wird geladen …' : `${visibleApps.length} ${visibleApps.length === 1 ? 'App' : 'Apps'}`}</p></div>
            <div className="absolute right-5 top-1/2 w-80 -translate-y-1/2"><Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" /><Input variant="secondary" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Apps durchsuchen" aria-label="Apps durchsuchen" className="w-full pl-10" /></div>
          </div>
          <div className="divide-y divide-border">
          {loading ? (
            [...Array(3)].map((_, i) => <MyAppsCardSkeleton key={i} />)
          ) : (
            <>
              {visibleApps.map((app) => {
                const statusMeta = getAppStatusMeta(app.status);
                const iconSrc = getImageAssetUrl(app.icon);
                const permissions = getAppPermissions(app);
                const canEdit = permissions.canEdit && !app.isLocked;
                const canDelete = permissions.canDelete && !app.isLocked;
                const canCopy = user.role === 'admin' || app.ownerId === user.id;
                return (
                  <article key={app.id} className="group flex flex-col gap-4 px-4 py-5 transition-colors duration-200 ease-out hover:bg-surface-secondary/45 sm:px-5 lg:flex-row lg:items-center">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-secondary text-2xl shadow-sm">
                        {iconSrc ? (
                          <Image src={iconSrc} alt={app.name} fill className="object-contain w-full h-full p-2" unoptimized />
                        ) : (
                          app.icon || '🏛️'
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-foreground">{app.name}</h3>
                          {app.categories?.slice(0, 2).map(cat => (
                            <Chip key={cat} size="sm" variant="soft" className="font-bold text-[10px] uppercase tracking-wider">{cat}</Chip>
                          ))}
                          {(app.categories?.length || 0) > 2 && (
                            <Chip size="sm" variant="soft" className="font-bold text-[10px] uppercase tracking-wider">+{app.categories!.length - 2}</Chip>
                          )}
                        </div>

                        <div className="mt-1.5 max-w-3xl text-sm text-muted line-clamp-2">
                          {app.description || <span className="italic opacity-50">Keine Beschreibung</span>}
                        </div>

                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono text-muted bg-surface-secondary px-2 py-1 rounded-md border border-border/50 flex items-center gap-1.5">
                            <span className="opacity-50">ID:</span> {app.id}
                          </span>
                          {statusMeta && (
                            <Chip
                              size="sm"
                              color={statusMeta.color as 'default' | 'success' | 'warning' | 'accent'}
                              variant="soft"
                              className="font-bold text-[10px] uppercase tracking-wider"
                            >
                              {statusMeta.label}
                            </Chip>
                          )}
                          {app.isLocked && (
                            <Chip size="sm" color="warning" variant="soft" className="font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Gesperrt
                            </Chip>
                          )}
                          {permissions.accessRole === 'editor' && (
                            <Chip size="sm" color="accent" variant="soft" className="font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                              <UsersRound className="w-3 h-3" /> Bearbeiter
                            </Chip>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 lg:justify-end">
                        <Button size="sm" variant="secondary" onPress={() => router.push(`/apps/${app.id}`)}>
                          <ExternalLink className="h-4 w-4" />
                          Öffnen
                        </Button>
                        <Button
                          size="sm" variant="secondary"
                          onPress={() => handleEditApp(app)}
                          isDisabled={!canEdit}
                          className={!canEdit ? 'opacity-50 cursor-not-allowed' : ''}
                        >
                          <Pencil className="h-4 w-4" />
                          Bearbeiten
                        </Button>
                        <Dropdown>
                          <Button isIconOnly size="sm" variant="secondary" aria-label={`Weitere Aktionen für ${app.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          <Dropdown.Popover>
                            <Dropdown.Menu aria-label={`Aktionen für ${app.name}`} onAction={(key) => {
                              if (key === 'copy') void handleCopyApp(app);
                              if (key === 'editors') handleManageEditors(app);
                              if (key === 'delete') handleDeleteApp(app);
                            }}>
                              {canCopy && <Dropdown.Item id="copy" textValue="Kopieren"><div className="flex items-center gap-2"><Copy className="h-4 w-4" />Kopieren</div></Dropdown.Item>}
                              {permissions.canManageEditors && <Dropdown.Item id="editors" textValue="Bearbeiter verwalten"><div className="flex items-center gap-2"><UsersRound className="h-4 w-4" />Bearbeiter verwalten</div></Dropdown.Item>}
                              <Dropdown.Item id="delete" textValue="Löschen" isDisabled={!canDelete} className="text-danger"><div className="flex items-center gap-2"><Trash2 className="h-4 w-4" />Löschen</div></Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown.Popover>
                        </Dropdown>
                      </div>
                  </article>
                );
              })}

              {apps.length === 0 && (
                <div className="py-20 text-center bg-surface-secondary px-4">
                  <p className="text-muted font-medium mb-4">Sie haben noch keine eigenen oder freigegebenen Apps.</p>
                  {(user.canSubmitApps || user.role === 'admin') ? (
                    <Button variant="ghost" onPress={handleCreateApp}>Erste App erstellen</Button>
                  ) : (
                    <p className="text-xs text-warning">Erstellung neuer Apps ist derzeit deaktiviert.</p>
                  )}
                </div>
              )}
              {apps.length > 0 && visibleApps.length === 0 && (
                <div className="py-16 text-center"><p className="font-medium text-foreground">Keine Apps gefunden</p><p className="mt-1 text-sm text-muted">Passen Sie den Suchbegriff an.</p></div>
              )}
            </>
          )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        confirmLabel="App löschen"
        description={deleteCandidate ? `Die App "${deleteCandidate.name}" wird dauerhaft entfernt. Dieser Schritt kann nicht rückgängig gemacht werden.` : ''}
        isDanger
        isLoading={isDeleting}
        isOpen={!!deleteCandidate}
        onConfirm={confirmDeleteApp}
        onOpenChange={(open) => { if (!open && !isDeleting) setDeleteCandidate(null); }}
        title="App wirklich löschen?"
      />

      <AppEditorsModal
        key={editorApp?.id ?? 'no-editor-app'}
        app={editorApp}
        users={users}
        onOpenChange={(open) => { if (!open) setEditorApp(null); }}
        onSaved={loadData}
      />
    </div>
  );
}

export default function MyAppsPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" /></div>}>
      <MyAppsContent />
    </Suspense>
  );
}
