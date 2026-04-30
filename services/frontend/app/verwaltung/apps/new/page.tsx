'use client';

import { AppEditorForm } from '@/components/AppEditorForm';
import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { prepareAppCopyDraft } from '@/lib/appCopy';
import { Button } from '@heroui/react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
      <div className="max-w-5xl mx-auto py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (copyError) {
    return (
      <div className="max-w-5xl mx-auto py-20 px-4">
        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-danger/10 p-2 text-danger">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground mb-2">Kopie konnte nicht vorbereitet werden</p>
              <p className="text-sm text-muted mb-4">{copyError}</p>
              <Button variant="secondary" onPress={() => router.push('/verwaltung/katalog/apps')}>Zurück zur App-Verwaltung</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <AppEditorForm initialApp={null} initialFormData={initialFormData} copySource={copySource} existingApps={existingApps} />;
}

export default function NewAppPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>}>
      <NewAppContent />
    </Suspense>
  );
}
