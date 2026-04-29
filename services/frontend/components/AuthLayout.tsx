'use client';

import { JustAppsLogo } from '@/components/JustAppsLogo';
import { useSettings } from '@/context/SettingsContext';
import { fetchApi } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/assets';
import { Shield } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const SAMPLE_APPS = [
  { icon: '📊', name: 'Analytics', category: 'Analyse', style: { top: '5%', left: '6%', animationName: 'float1', animationDuration: '6.5s', animationDelay: '0s' } },
  { icon: '🗺️', name: 'GeoPortal', category: 'Geodaten', style: { top: '10%', right: '8%', animationName: 'float2', animationDuration: '8s', animationDelay: '-2.5s' } },
  { icon: '🔒', name: 'IAM Service', category: 'Sicherheit', style: { top: '36%', left: '2%', animationName: 'float3', animationDuration: '7s', animationDelay: '-1s' } },
  { icon: '📋', name: 'Formular-Manager', category: 'Formulare', style: { top: '50%', right: '5%', animationName: 'float1', animationDuration: '9s', animationDelay: '-4s' } },
  { icon: '📨', name: 'Bescheid-Versand', category: 'Kommunikation', style: { bottom: '18%', left: '8%', animationName: 'float2', animationDuration: '7.5s', animationDelay: '-3s' } },
  { icon: '🏛️', name: 'Bürger-Portal', category: 'E-Government', style: { bottom: '6%', right: '7%', animationName: 'float3', animationDuration: '8.5s', animationDelay: '-1.5s' } },
  { icon: '🚀', name: 'Deploy Assistant', category: 'DevOps', style: { bottom: '30%', right: '3%', animationName: 'float1', animationDuration: '10s', animationDelay: '-5s' } },
];

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const { settings } = useSettings();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const storeName = settings.storeName || 'JustApps';
  const storeDescription = settings.storeDescription || 'Zentraler App Store für Softwarelösungen der öffentlichen Verwaltung.';
  const logoSrc = isDark
    ? (settings.logoDarkUrl || settings.logoUrl || null)
    : (settings.logoUrl || null);
  const resolvedLogoSrc = resolveAssetUrl(logoSrc);

  const [appCount, setAppCount] = useState<number | null>(null);
  useEffect(() => {
    fetchApi('/apps')
      .then((r) => r.ok ? r.json() : null)
      .then((data: unknown) => { if (Array.isArray(data)) setAppCount(data.length); })
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="flex min-h-[calc(100vh-9rem)] rounded-3xl overflow-hidden border border-border shadow-2xl shadow-black/5">

        {/* ── Left decorative panel ── */}
        <div className="hidden lg:flex relative flex-1 bg-gradient-to-br from-accent/10 via-surface to-accent/5 flex-col items-center justify-center overflow-hidden">

          {/* Subtle dot grid */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          {/* Edge fade */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-surface/60 pointer-events-none" />

          {/* Floating mini app cards */}
          {SAMPLE_APPS.map((app) => (
            <div
              key={app.name}
              className="absolute flex items-center gap-2.5 bg-surface/85 backdrop-blur-md border border-border/60 rounded-xl px-3.5 py-2.5 shadow-md shadow-black/5 w-44 select-none"
              style={{
                ...(app.style as React.CSSProperties),
                animationIterationCount: 'infinite',
                animationTimingFunction: 'ease-in-out',
                animationFillMode: 'both',
              }}
            >
              <span className="text-xl leading-none">{app.icon}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate">{app.name}</span>
                <span className="text-[10px] text-muted truncate">{app.category}</span>
              </div>
            </div>
          ))}

          {/* Center branding */}
          <div className="relative z-10 flex flex-col items-center text-center gap-5 px-14">
            {resolvedLogoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolvedLogoSrc} alt={storeName} className="h-14 w-auto object-contain max-w-[160px]" />
            ) : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl shadow-accent/10">
                <JustAppsLogo className="w-16 h-16" />
              </div>
            )}
            <div>
              <h2 className="text-3xl font-bold text-foreground tracking-tight">{storeName}</h2>
              <p className="text-sm text-muted mt-2 max-w-[260px] leading-relaxed">
                {storeDescription}
              </p>
            </div>
            <div className="flex items-center gap-6 mt-1">
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg font-bold text-foreground">
                  {appCount !== null ? appCount : '—'}
                </span>
                <span className="text-[10px] text-muted uppercase tracking-wider">Apps</span>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg font-bold text-foreground">Offen</span>
                <span className="text-[10px] text-muted uppercase tracking-wider">Open Source</span>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-lg font-bold text-foreground">Aktiv</span>
                </div>
                <span className="text-[10px] text-muted uppercase tracking-wider">Plattform</span>
              </div>
            </div>
          </div>

          {/* Bottom attribution */}
          <div className="absolute bottom-5 flex items-center gap-1.5 text-muted/50">
            <Shield className="w-3 h-3" />
            <span className="text-[10px]">Sicher. Transparent. Nachnutzbar.</span>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="w-full lg:w-[440px] shrink-0 flex flex-col justify-center bg-surface px-8 py-10 lg:px-12">

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
            <p className="text-sm text-muted mt-1.5">{subtitle}</p>
          </div>

          {children}
        </div>
      </div>
    </>
  );
}
