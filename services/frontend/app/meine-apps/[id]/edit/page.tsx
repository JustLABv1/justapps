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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [app, setApp] = useState<AppConfig | null | undefined>(undefined);
  const [existingApps, setExistingApps] = useState<AppConfig[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
      return;
    }
    if (!id || !user) return;
    Promise.all([
      fetchApi(`/apps/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetchApi('/apps').then((r) => (r.ok ? r.json() : [])),
    ]).then(([loadedApp, apps]) => {
      // Only allow editing own apps (backend also enforces this)
      if (loadedApp && user.role !== 'admin' && loadedApp.ownerId !== user.id) {
        router.replace('/meine-apps');
        return;
      }
      setApp(loadedApp);
      setExistingApps(apps);
    });
  }, [id, user, authLoading, router]);

  if (authLoading || app === undefined) {
    return (
      <div className="max-w-5xl mx-auto py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (app === null) return notFound();

  return <AppEditorForm initialApp={app} existingApps={existingApps} />;
}
