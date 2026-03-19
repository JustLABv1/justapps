'use client';

import { AppEditorForm } from '@/components/AppEditorForm';
import { AppConfig } from '@/config/apps';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function NewMyAppPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [existingApps, setExistingApps] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
      return;
    }
    if (user) {
      fetchApi('/apps')
        .then((r) => (r.ok ? r.json() : []))
        .then(setExistingApps)
        .finally(() => setLoading(false));
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return <AppEditorForm initialApp={null} existingApps={existingApps} />;
}
