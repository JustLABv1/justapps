'use client';

import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

export function AppStoreGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { settings, loaded: settingsLoaded } = useSettings();

  useEffect(() => {
    if (!settingsLoaded || authLoading || !settings.requireAuthForAppStore || user) {
      return;
    }

    const query = searchParams.toString();
    const callbackUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }, [authLoading, pathname, router, searchParams, settings.requireAuthForAppStore, settingsLoaded, user]);

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