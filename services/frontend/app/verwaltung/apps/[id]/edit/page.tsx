'use client';

import { AppEditor } from '@/components/app-editor/AppEditor';
import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { Spinner } from '@/components/panelui/spinner';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EditAppPage() {
  const params = useParams();
  const id = params?.id as string;

  // undefined = loading, null = not found, AppConfig = loaded
  const [app, setApp] = useState<AppConfig | null | undefined>(undefined);
  const [existingApps, setExistingApps] = useState<AppConfig[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchApi(`/apps/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetchApi('/apps').then((r) => (r.ok ? r.json() : [])),
    ]).then(([loadedApp, apps]) => {
      setApp(loadedApp);
      setExistingApps(apps);
    });
  }, [id]);

  if (app === undefined) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="App wird geladen" />
      </div>
    );
  }

  if (app === null) return notFound();

  return <AppEditor key={app.id} initialApp={app} existingApps={existingApps} />;
}
