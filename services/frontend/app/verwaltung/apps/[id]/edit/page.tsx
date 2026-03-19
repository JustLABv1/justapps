'use client';

import { AppEditorForm } from '@/components/AppEditorForm';
import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';
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
      <div className="max-w-5xl mx-auto py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (app === null) return notFound();

  return <AppEditorForm initialApp={app} existingApps={existingApps} />;
}
