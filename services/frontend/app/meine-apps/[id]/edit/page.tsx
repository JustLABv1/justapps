'use client';

import { AppEditorForm } from '@/components/AppEditorForm';
import { AppConfig } from '@/config/apps';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EditMyAppPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user, loading: authLoading, profileReady, profileError, refreshUser } = useAuth();
  const router = useRouter();

  const [app, setApp] = useState<AppConfig | null | undefined>(undefined);
  const [existingApps, setExistingApps] = useState<AppConfig[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
      return;
    }
    if (!id || !user || !profileReady) return;
    Promise.all([
      fetchApi(`/apps/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetchApi('/apps').then((r) => (r.ok ? r.json() : [])),
    ]).then(([loadedApp, apps]) => {
      const fallbackCanEdit = user.role === 'admin' || loadedApp?.ownerId === user.id;
      const canEdit = loadedApp?.viewerPermissions?.canEdit ?? fallbackCanEdit;
      if (loadedApp && !canEdit) {
        router.replace('/meine-apps');
        return;
      }
      setApp(loadedApp);
      setExistingApps(apps);
    });
  }, [id, user, authLoading, profileReady, router]);

  if (authLoading || app === undefined) {
    return (
      <div className="max-w-5xl mx-auto py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (app === null) return notFound();

  if (user && !profileReady) {
    return (
      <div className="max-w-5xl mx-auto py-20 px-4">
        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-6">
          <p className="text-base font-semibold text-foreground mb-2">Profil wird noch synchronisiert</p>
          <p className="text-sm text-muted mb-4">
            {profileError || 'Das Backend bestätigt Ihr Benutzerprofil noch. Bitte laden Sie die Daten erneut, bevor Sie die App bearbeiten.'}
          </p>
          <button
            type="button"
            onClick={() => void refreshUser()}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 transition-colors"
          >
            Erneut laden
          </button>
        </div>
      </div>
    );
  }

  return <AppEditorForm initialApp={app} existingApps={existingApps} />;
}
