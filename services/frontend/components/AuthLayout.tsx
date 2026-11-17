'use client';

import { JustAppsLogo } from '@/components/JustAppsLogo';
import { useSettings } from '@/context/SettingsContext';
import { fetchApi } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/assets';
import { Shield } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

/** The frame around sign-in and registration: the store's identity beside the form. */
export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const { settings, loaded: settingsLoaded } = useSettings();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const storeName = settings.storeName || 'JustApps';
  const storeDescription = settings.storeDescription || 'Zentraler App Store für Softwarelösungen der öffentlichen Verwaltung.';
  const logoSrc = isDark ? (settings.logoDarkUrl || settings.logoUrl || null) : (settings.logoUrl || null);
  const resolvedLogoSrc = resolveAssetUrl(logoSrc);

  const [appCount, setAppCount] = useState<number | null>(null);
  useEffect(() => {
    if (!settingsLoaded || settings.requireAuthForAppStore) return;
    fetchApi('/apps')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => { if (Array.isArray(data)) setAppCount(data.length); })
      .catch(() => {});
  }, [settings.requireAuthForAppStore, settingsLoaded]);

  const logo = resolvedLogoSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolvedLogoSrc} alt={storeName} className="h-12 w-auto max-w-40 object-contain" />
  ) : (
    <JustAppsLogo className="size-14" />
  );

  return (
    <div className="mx-auto grid min-h-[calc(100vh-14rem)] w-full max-w-4xl overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.07] lg:grid-cols-[minmax(0,1fr)_26rem]">
      <aside className="hidden flex-col justify-between gap-10 bg-muted/40 p-10 lg:flex">
        <div className="flex flex-col gap-5">
          {logo}
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{storeName}</h2>
            <p className="max-w-xs text-pretty text-sm text-muted-foreground">{storeDescription}</p>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <dl className="flex gap-8">
            <div>
              <dd className="text-lg font-semibold">{appCount !== null ? appCount : '–'}</dd>
              <dt className="text-xs text-muted-foreground">Apps</dt>
            </div>
            <div>
              <dd className="text-lg font-semibold">Offen</dd>
              <dt className="text-xs text-muted-foreground">Open Source</dt>
            </div>
          </dl>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="size-3.5" />
            Sicher. Transparent. Nachnutzbar.
          </p>
        </div>
      </aside>

      <div className="flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mb-6 lg:hidden">{logo}</div>
        <header className="mb-7 flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </header>
        {children}
      </div>
    </div>
  );
}
