'use client';

import { AppCreationFlow } from '@/components/AppCreationFlow';
import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { prepareAppCopyDraft } from '@/lib/appCopy';
import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
import { Spinner } from '@/components/panelui/spinner';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function NewAppContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyId = searchParams?.get('copy')?.trim() || null;
  const [existingApps, setExistingApps] = useState<AppConfig[]>([]);
  const [initialFormData, setInitialFormData] = useState<Partial<AppConfig> | null>(null);
  const [copySource, setCopySource] = useState<{ id: string; name: string } | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      setCopyError(null);

      try {
        const appsResponse = await fetchApi('/apps');
        const apps = appsResponse.ok ? await appsResponse.json() as AppConfig[] : [];
        if (!active) return;
        setExistingApps(apps);

        if (!copyId) {
          setInitialFormData(null);
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
        setInitialFormData(prepareAppCopyDraft(sourceApp));
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
  }, [copyId]);

  if (loading) {
    return (
<div className="flex justify-center py-20">
        <Spinner size="lg" label="Wird geladen" />
      </div>
    );
  }

  if (copyError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Alert tone="destructive">
          <Alert.Icon />
          <Alert.Title>Kopie konnte nicht vorbereitet werden</Alert.Title>
          <Alert.Description>{copyError}</Alert.Description>
          <Alert.Actions>
            <Button variant="outline" size="sm" onClick={() => router.push('/verwaltung/katalog/apps')}>Zurück zur App-Verwaltung</Button>
          </Alert.Actions>
        </Alert>
      </div>
    );
  }

  return <AppCreationFlow initialFormData={initialFormData} copySource={copySource} existingApps={existingApps} editHref={(id) => `/verwaltung/apps/${encodeURIComponent(id)}/edit`} />;
}

export default function NewAppPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner size="lg" label="Wird geladen" /></div>}>
      <NewAppContent />
    </Suspense>
  );
}
