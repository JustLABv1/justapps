'use client';

import { AppModal } from '@/components/AppModal';
import { AppConfig } from '@/config/apps';
import {
  Button,
  Card,
  Chip
} from '@heroui/react';
import {
  ChevronLeft,
  ExternalLink,
  Loader2,
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

function MyAppsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [settings, setSettings] = useState({ allowAppSubmissions: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Form states
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppConfig | null>(null);

  const [iconInput, setIconInput] = useState('');
  const [appFormData, setAppFormData] = useState<Partial<AppConfig>>({});

  // Auth check
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        const timer = setTimeout(() => {
          if (!user) {
            router.push('/');
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch settings
      const settingsRes = await fetchApi('/settings');
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      }

      const res = await fetchApi('/apps');
      if (res.ok) {
        const data: AppConfig[] = await res.json();
        // Filter apps where app.ownerId === user.id
        const myApps = data.filter(app => app.ownerId === user.id);
        setApps(myApps);
      } else {
        setError(`Failed to load apps: ${res.statusText}`);
      }
    } catch (err) {
      setError(`Error connecting to API: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCreateApp = () => {
    if (!user?.canSubmitApps) {
      alert("Submission blocked for your account");
      return;
    }
    if (!settings.allowAppSubmissions && user?.role !== 'admin') {
      alert("App submissions are currently disabled system-wide.");
      return;
    }
    setSelectedApp(null);
    setAppFormData({
      id: '',
      name: '',
      description: '',
      categories: [],
      icon: '🏛️',
      techStack: [],
      license: 'MIT',
      markdownContent: '',
      liveUrl: '',
      liveDemos: [],
      repoUrl: '',
      repositories: [],
      customLinks: [],
      dockerRepo: '',
      helmRepo: '',
      docsUrl: '',
      focus: '',
      appType: '',
      useCase: '',
      visualization: '',
      deployment: '',
      infrastructure: '',
      database: '',
      additionalInfo: '',
      status: 'POC',
      transferability: '',
      contactPerson: '',
      customDockerCommand: '',
      customComposeCommand: '',
      customHelmCommand: '',
      customDockerNote: '',
      customComposeNote: '',
      customHelmNote: '',
      hasDeploymentAssistant: true,
      showDocker: true,
      showCompose: true,
      showHelm: true,
      customHelmValues: ''
    });
    setIsAppModalOpen(true);
  };

  const handleEditApp = (app: AppConfig) => {
    if (app.isLocked) return;
    setSelectedApp(app);
    setAppFormData({ ...app });
    setIsAppModalOpen(true);
  };

  const handleDeleteApp = async (app: AppConfig) => {
    if (app.isLocked) return;
    if (confirm('Bist du sicher? Diese App wird unwiderruflich gelöscht.')) {
      await fetchApi(`/apps/${app.id}`, { method: 'DELETE' });
      loadData();
    }
  };

  const handleAppSubmit = async (finalData: Partial<AppConfig>) => {
    const method = selectedApp ? 'PUT' : 'POST';
    const url = selectedApp ? `/apps/${selectedApp.id}` : '/apps';

    try {
      const res = await fetchApi(url, {
        method,
        body: JSON.stringify(finalData)
      });
      if (res.ok) {
        loadData();
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || `Fehler beim Speichern: ${res.statusText}`);
        return false;
      }
    } catch (err) {
      console.error(err);
      setError(`Verbindungsfehler: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
      return false;
    }
  };

  // Deep linking
  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (editId && apps.length > 0) {
      const appToEdit = apps.find(a => a.id === editId);
      if (appToEdit && !appToEdit.isLocked) {
        const timer = setTimeout(() => {
          handleEditApp(appToEdit);
          const url = new URL(window.location.href);
          url.searchParams.delete('edit');
          window.history.replaceState({}, '', url.pathname);
        }, 0);
        return () => clearTimeout(timer);
      }
    }

  }, [searchParams, apps]);

  if (authLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
      <p className="text-muted font-medium">Lade Ihre Apps...</p>
    </div>
  );

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Meine Apps</h1>
          <p className="text-muted">Verwalten Sie Ihre eigenen Applikationen im JustApps.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onPress={() => router.push('/')}
            className="font-bold gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Zum Store
          </Button>
          <Button
            onPress={handleCreateApp}
            isDisabled={!user.canSubmitApps || (!settings.allowAppSubmissions && user.role !== 'admin')}
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
          <div className="flex-grow">
            {error}
          </div>
          <Button size="sm" variant="secondary" onPress={loadData} className="h-8">Wiederholen</Button>
        </div>
      )}

      {/* Main Content */}
      <div className="pt-6">
        {!settings.allowAppSubmissions && user.role !== 'admin' && !user.canSubmitApps && (
          <div className='flex flex-col md:flex-row gap-4 pb-4 justify-end items-center'>
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
          {apps.map((app) => (
            <Card key={app.id} variant="default" className="hover:border-accent/30 transition-all duration-200 border-border shadow-sm hover:shadow-md group">
              <div className="flex flex-col md:flex-row items-center p-5 gap-6">
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-surface-secondary to-surface border border-border flex items-center justify-center text-3xl shadow-sm flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  {app.icon?.startsWith('http') ? (
                    <Image
                      src={app.icon}
                      alt={app.name}
                      fill
                      className="object-contain w-full h-full p-2"
                      unoptimized
                    />
                  ) : (
                    app.icon || "🏛️"
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
                  <div className="text-sm text-muted line-clamp-2 mb-3 max-w-3xl">{app.description || <span className="italic opacity-50">Keine Beschreibung</span>}</div>
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <div className="text-[10px] font-mono text-muted bg-surface-secondary px-2 py-1 rounded-md border border-border/50 flex items-center gap-1.5">
                      <span className="opacity-50">ID:</span> {app.id}
                    </div>
                    {app.status && (
                      <div className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-1 rounded-md border border-accent/20 uppercase tracking-wider">
                        {app.status}
                      </div>
                    )}
                    {app.isLocked && (
                      <div className="text-[10px] font-bold text-warning bg-warning/10 px-2 py-1 rounded-md border border-warning/20 uppercase tracking-wider flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Locked
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-row md:flex-col gap-2 flex-shrink-0 w-full md:w-auto mt-4 md:mt-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => router.push(`/apps/${app.id}`)}
                    className="font-bold gap-2 flex-1 md:flex-none justify-start"
                  >
                    <ExternalLink className="w-4 h-4 text-muted" />
                    Ansehen
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => handleEditApp(app)}
                    isDisabled={!!app.isLocked}
                    className={`font-bold gap-2 flex-1 md:flex-none justify-start ${app.isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Pencil className="w-4 h-4 text-muted" />
                    Bearbeiten
                  </Button>
                  <Button
                    size="sm"
                    variant="danger-soft"
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
          ))}
          {apps.length === 0 && !loading && (
            <div className="py-20 text-center bg-surface-secondary rounded-2xl border-2 border-dashed border-border px-4">
              <p className="text-muted font-medium mb-4">Sie haben noch keine eigenen Apps erstellt.</p>
              {user.canSubmitApps ? (
                <Button variant="ghost" onPress={handleCreateApp}>
                  Erste App erstellen
                </Button>
              ) : (
                <p className="text-xs text-warning">Erstellung neuer Apps ist derzeit deaktiviert.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      )}

      {/* App Modal */}
      <AppModal
        isOpen={isAppModalOpen}
        onOpenChange={setIsAppModalOpen}
        selectedApp={selectedApp}
        onSubmit={handleAppSubmit}
        initialData={appFormData}
      />
    </div>
  );
}

export default function MyAppsPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <MyAppsContent />
    </Suspense>
  );
}
