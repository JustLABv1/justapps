'use client';

import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

export function AppStoreGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { settings, loaded: settingsLoaded } = useSettings();

  useEffect(() => {
    if (!settingsLoaded || authLoading || !settings.requireAuthForAppStore || user) {
      return;
    }

    const callbackUrl = `${window.location.pathname}${window.location.search}`;
    router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }, [authLoading, router, settings.requireAuthForAppStore, settingsLoaded, user]);

  if (!settingsLoaded || authLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (settings.requireAuthForAppStore && !user) {
    return null;
  }

  return <>{children}</>;
}