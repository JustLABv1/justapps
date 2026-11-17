'use client';

import { AppCreationFlow, type AppCreationSpace } from '@/components/AppCreationFlow';
import { AppConfig } from '@/config/apps';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { prepareAppCopyDraft } from '@/lib/appCopy';
import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
import { Spinner } from '@/components/panelui/spinner';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function NewMyAppContent() {
  const { user, loading: authLoading, profileReady, profileError, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceId = searchParams?.get('spaceId')?.trim() || null;
  const copyId = searchParams?.get('copy')?.trim() || null;
  const [availableSpaces, setAvailableSpaces] = useState<AppCreationSpace[]>([]);
  const [existingApps, setExistingApps] = useState<AppConfig[]>([]);
  const [initialFormData, setInitialFormData] = useState<Partial<AppConfig> | null>(null);
  const [copySource, setCopySource] = useState<{ id: string; name: string } | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
      return;
    }
    if (!user || !profileReady) return;

    let active = true;

    const loadData = async () => {
      setLoading(true);
      setCopyError(null);

      try {
        if (user.role !== 'admin' && !user.canSubmitApps) {
          setCopyError('Sie haben keine Berechtigung, Apps zu erstellen.');
          return;
        }
        const spacesResponse = await fetchApi('/spaces');
        if (!spacesResponse.ok) throw new Error('Die verfügbaren Spaces konnten nicht geladen werden. Bitte laden Sie die Seite erneut.');
        const spaces = (await spacesResponse.json() as (AppCreationSpace & { accepted: boolean })[]).filter((space) => space.accepted);
        if (!active) return;
        setAvailableSpaces(spaces);
        if (spaceId && !spaces.some((space) => space.id === spaceId)) {
          setCopyError('Sie dürfen in diesem Space keine App erstellen. Eine angenommene Mitgliedschaft oder Eigentümerschaft ist erforderlich.');
          return;
        }
        const appsResponse = await fetchApi('/apps');
        const apps = appsResponse.ok ? await appsResponse.json() as AppConfig[] : [];
        if (!active) return;
        setExistingApps(apps);

        if (!copyId) {
          setInitialFormData(spaceId ? { spaceId } : null);
          setCopySource(null);
          return;
        }

        const sourceResponse = await fetchApi(`/apps/${copyId}`);
        if (!sourceResponse.ok) {
          setCopyError('Die ausgewählte Vorlage konnte nicht geladen werden.');
          setInitialFormData(null);
          setCopySource(null);
          return;
        }

        const sourceApp = await sourceResponse.json() as AppConfig;
        if (!active) return;

        if (user.role !== 'admin' && sourceApp.ownerId !== user.id) {
          setCopyError('Sie können nur eigene Apps kopieren.');
          setInitialFormData(null);
          setCopySource(null);
          return;
        }

        const targetSpaceId = spaceId || sourceApp.spaceId || null;
        if (targetSpaceId && !spaces.some((space) => space.id === targetSpaceId)) {
          setCopyError('Sie dürfen im Space dieser Vorlage keine App erstellen.');
          return;
        }
        setInitialFormData({ ...prepareAppCopyDraft(sourceApp), spaceId: targetSpaceId });
        setCopySource({ id: sourceApp.id, name: sourceApp.name });
      } catch (error) {
        if (!active) return;
        setCopyError(error instanceof Error ? error.message : 'Die Vorlage konnte nicht geladen werden.');
        setInitialFormData(null);
        setCopySource(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [user, authLoading, profileReady, router, copyId, spaceId]);

  if (authLoading || loading) {
    return (
<div className="flex justify-center py-20">
        <Spinner size="lg" label="Wird geladen" />
      </div>
    );
  }

  if (user && !profileReady) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Alert tone="warning">
          <Alert.Icon />
          <Alert.Title>Profil wird noch synchronisiert</Alert.Title>
          <Alert.Description>
            {profileError || 'Das Backend bestätigt Ihr Benutzerprofil noch. Bitte laden Sie die Daten erneut, bevor Sie eine App anlegen.'}
          </Alert.Description>
          <Alert.Actions>
            <Button size="sm" onClick={() => void refreshUser()}>Erneut laden</Button>
          </Alert.Actions>
        </Alert>
      </div>
    );
  }

  if (copyError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Alert tone="destructive">
          <Alert.Icon />
          <Alert.Title>App-Erstellung nicht verfügbar</Alert.Title>
          <Alert.Description>{copyError}</Alert.Description>
          <Alert.Actions>
            <Button variant="outline" size="sm" onClick={() => router.push('/meine-apps')}>Zurück zu Meine Apps</Button>
          </Alert.Actions>
        </Alert>
      </div>
    );
  }

  return <AppCreationFlow availableSpaces={availableSpaces} initialFormData={initialFormData} copySource={copySource} existingApps={existingApps} editHref={(id) => `/meine-apps/${encodeURIComponent(id)}/edit`} />;
}

export default function NewMyAppPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner size="lg" label="Wird geladen" /></div>}>
      <NewMyAppContent />
    </Suspense>
  );
}
