'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AppConfig } from '@/config/apps';
import { getAppStatusMeta } from '@/lib/appStatus';
import { getImageAssetUrl } from '@/lib/assets';
import {
    Button,
    Card,
    Chip,
    toast
} from '@heroui/react';
import {
    ChevronLeft,
    Copy,
    ExternalLink,
    Lock,
    Pencil,
    Plus,
    ShieldCheck,
    Trash2
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
  const [settings, setSettings] = useState({ allowAppSubmissions: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<AppConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        fetchApi('/apps?owner=me'),
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
    if (app.isLocked) return;
    router.push(`/meine-apps/${app.id}/edit`);
  };

  const handleDeleteApp = (app: AppConfig) => {
    if (app.isLocked) return;
    setDeleteCandidate(app);
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
    <div className="max-w-6xl mx-auto px-4 md:px-8 pb-8 md:pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Meine Apps</h1>
          <p className="text-muted">Verwalten Sie Ihre eigenen Applikationen im JustApps.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onPress={() => router.push('/')} className="font-bold gap-2">
            <ChevronLeft className="w-4 h-4" />
            Zum Store
          </Button>
          <Button
            onPress={handleCreateApp}
            isDisabled={user.role !== 'admin' && (!user.canSubmitApps || !settings.allowAppSubmissions)}
          >
            <Plus className="w-6 h-6" />
            Neue App
          </Button>
        </div>
      </div>

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

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            [...Array(3)].map((_, i) => <MyAppsCardSkeleton key={i} />)
          ) : (
            <>
              {apps.map((app) => {
                const statusMeta = getAppStatusMeta(app.status);
                const iconSrc = getImageAssetUrl(app.icon);
                return (
                  <Card key={app.id} variant="default" className="hover:border-accent/30 transition-all duration-200 border-border shadow-sm hover:shadow-md group">
                    <div className="flex flex-col md:flex-row items-center p-5 gap-6">
                      <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-surface-secondary to-surface border border-border flex items-center justify-center text-3xl shadow-sm flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                        {iconSrc ? (
                          <Image src={iconSrc} alt={app.name} fill className="object-contain w-full h-full p-2" unoptimized />
                        ) : (
                          app.icon || '🏛️'
                        )}
                      </div>

                      <div className="flex-grow text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-1.5 flex-wrap">
                          <h3 className="text-lg font-bold text-foreground">{app.name}</h3>
                          {app.categories?.slice(0, 3).map(cat => (
                            <Chip key={cat} size="sm" variant="soft" className="font-bold text-[10px] uppercase tracking-wider">{cat}</Chip>
                          ))}
                          {(app.categories?.length || 0) > 3 && (
                            <Chip size="sm" variant="soft" className="font-bold text-[10px] uppercase tracking-wider">+{app.categories!.length - 3}</Chip>
                          )}
                        </div>

                        <div className="text-sm text-muted line-clamp-2 mb-3 max-w-3xl">
                          {app.description || <span className="italic opacity-50">Keine Beschreibung</span>}
                        </div>

                        <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
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
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-2 flex-shrink-0 w-full md:w-auto mt-4 md:mt-0">
                        <Button size="sm" variant="secondary" onPress={() => router.push(`/apps/${app.id}`)} className="font-bold gap-2 flex-1 md:flex-none justify-start">
                          <ExternalLink className="w-4 h-4 text-muted" />
                          Ansehen
                        </Button>
                        <Button size="sm" variant="secondary" onPress={() => void handleCopyApp(app)} className="font-bold gap-2 flex-1 md:flex-none justify-start">
                          <Copy className="w-4 h-4 text-muted" />
                          Kopieren
                        </Button>
                        <Button
                          size="sm" variant="secondary"
                          onPress={() => handleEditApp(app)}
                          isDisabled={!!app.isLocked}
                          className={`font-bold gap-2 flex-1 md:flex-none justify-start ${app.isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Pencil className="w-4 h-4 text-muted" />
                          Bearbeiten
                        </Button>
                        <Button
                          size="sm" variant="danger-soft"
                          onPress={() => handleDeleteApp(app)}
                          isDisabled={!!app.isLocked}
                          className={`font-bold gap-2 flex-1 md:flex-none justify-start ${app.isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Trash2 className="w-4 h-4" />
                          Löschen
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {apps.length === 0 && (
                <div className="py-20 text-center bg-surface-secondary rounded-2xl border-2 border-dashed border-border px-4">
                  <p className="text-muted font-medium mb-4">Sie haben noch keine eigenen Apps erstellt.</p>
                  {(user.canSubmitApps || user.role === 'admin') ? (
                    <Button variant="ghost" onPress={handleCreateApp}>Erste App erstellen</Button>
                  ) : (
                    <p className="text-xs text-warning">Erstellung neuer Apps ist derzeit deaktiviert.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
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
