'use client';

import { AppModal } from '@/components/AppModal';
import { AppTable } from '@/components/AppTable';
import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { Button } from '@heroui/react';
import { Download, Loader2, Plus, ShieldCheck, Upload } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function AppsContent() {
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppConfig | null>(null);
  const [appFormData, setAppFormData] = useState<Partial<AppConfig>>({});

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

  useEffect(() => { loadApps(); }, []);

  const handleCreateApp = () => {
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
      customFields: [],
      status: 'POC',
      knownIssue: '',
      customDockerCommand: '',
      customComposeCommand: '',
      customHelmCommand: '',
      customDockerNote: '',
      customComposeNote: '',
      customHelmNote: '',
      customHelmValues: '',
      isFeatured: false,
      hasDeploymentAssistant: true,
      showDocker: true,
      showCompose: true,
      showHelm: true,
    });
    setIsAppModalOpen(true);
  };

  const handleEditApp = (app: AppConfig) => {
    setSelectedApp(app);
    setAppFormData({ ...app });
    setIsAppModalOpen(true);
  };

  const handleDeleteApp = async (id: string) => {
    if (confirm('Bist du sicher? Diese App wird unwiderruflich gelöscht.')) {
      await fetchApi(`/apps/${id}`, { method: 'DELETE' });
      loadApps();
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

  const handleAppSubmit = async (formData: Partial<AppConfig>) => {
    const method = selectedApp ? 'PUT' : 'POST';
    const url = selectedApp ? `/apps/${selectedApp.id}` : '/apps';

    const sanitizeLinks = (links: { label?: string; url?: string }[] | undefined) => {
      if (!Array.isArray(links)) return [];
      return links
        .map(link => ({ label: (link.label || '').trim(), url: (link.url || '').trim() }))
        .filter(link => link.url.length > 0)
        .map(link => ({ label: link.label || 'Link', url: link.url }));
    };

    const finalData = {
      ...formData,
      categories: Array.isArray(formData.categories)
        ? formData.categories
        : (formData.categories as unknown as string).split(',').map(s => s.trim()).filter(Boolean),
      techStack: Array.isArray(formData.techStack)
        ? formData.techStack
        : (formData.techStack as unknown as string).split(',').map(s => s.trim()).filter(Boolean),
      repositories: sanitizeLinks(formData.repositories),
      customLinks: sanitizeLinks(formData.customLinks),
    };

    try {
      const res = await fetchApi(url, { method, body: JSON.stringify(finalData) });
      if (res.ok) {
        loadApps();
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || `Fehler beim Speichern: ${res.statusText}`);
        return false;
      }
    } catch (err) {
      setError(`Verbindungsfehler: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
      return false;
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
        alert('Export fehlgeschlagen');
      }
    } catch (err) {
      console.error(err);
      alert('Export fehlgeschlagen');
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
          alert('Apps erfolgreich importiert');
          loadApps();
        } else {
          alert('Import fehlgeschlagen');
        }
      } catch (err) {
        console.error(err);
        alert('Fehler beim Importieren der Datei');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Deep linking: ?edit=<appId>
  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (editId && apps.length > 0) {
      const appToEdit = apps.find(a => a.id === editId);
      if (appToEdit) {
        const timer = setTimeout(() => {
          handleEditApp(appToEdit);
          const url = new URL(window.location.href);
          url.searchParams.delete('edit');
          window.history.replaceState({}, '', url.pathname);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, apps]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted">{apps.length} App{apps.length !== 1 ? 's' : ''} im Store</p>
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
          <Button size="sm" variant="secondary" onPress={loadApps} className="h-8">Retry</Button>
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
        />
      )}

      <AppModal
        isOpen={isAppModalOpen}
        onOpenChange={setIsAppModalOpen}
        selectedApp={selectedApp}
        onSubmit={handleAppSubmit}
        initialData={appFormData}
        existingApps={apps}
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
