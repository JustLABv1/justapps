'use client';

import { AppEditor } from '@/components/app-editor/AppEditor';
import { AppConfig } from '@/config/apps';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { Spinner } from '@/components/panelui/spinner';
import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
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
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="App wird geladen" />
      </div>
    );
  }

  if (app === null) return notFound();

  if (user && !profileReady) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Alert tone="warning">
          <Alert.Icon />
          <Alert.Title>Profil wird noch synchronisiert</Alert.Title>
          <Alert.Description>
            {profileError || 'Das Backend bestätigt Ihr Benutzerprofil noch. Bitte laden Sie die Daten erneut, bevor Sie die App bearbeiten.'}
          </Alert.Description>
          <Alert.Actions>
            <Button size="sm" onClick={() => void refreshUser()}>Erneut laden</Button>
          </Alert.Actions>
        </Alert>
      </div>
    );
  }

  return <AppEditor key={app.id} initialApp={app} existingApps={existingApps} />;
}
