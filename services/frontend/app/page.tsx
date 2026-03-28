'use client';

import { AppGrid } from "@/components/AppGrid";
import { AppConfig } from "@/config/apps";
import { useSettings } from "@/context/SettingsContext";
import { fetchApi } from "@/lib/api";
import { Rocket } from "lucide-react";
import { useTheme } from "next-themes";
import { Suspense, useEffect, useState } from "react";

export const dynamic = 'force-dynamic';

async function getApps() {
  try {
    const res = await fetchApi('/apps', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Error in getApps:", e);
    return [];
  }
}

function HomeLoadingState() {
  return (
    <div className="flex flex-col gap-8 pb-16 animate-pulse">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface-secondary px-6 py-8 md:py-10 mt-2">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <div className="h-7 w-52 rounded-full bg-default/70" />
          <div className="h-10 w-full max-w-2xl rounded-2xl bg-default/80" />
          <div className="h-5 w-full max-w-xl rounded-full bg-default/60" />
          <div className="h-5 w-3/4 max-w-lg rounded-full bg-default/50" />
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-default/70" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-2/3 rounded-full bg-default/80" />
                <div className="h-4 w-1/2 rounded-full bg-default/60" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 rounded-full bg-default/60" />
              <div className="h-4 rounded-full bg-default/50" />
              <div className="h-4 w-5/6 rounded-full bg-default/40" />
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
              <div className="h-4 w-28 rounded-full bg-default/70" />
              <div className="h-8 w-24 rounded-full bg-default/60" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function Home() {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isDark = theme === 'dark';

  const heroBadge = settings.heroBadge || 'Open Source. Community-getrieben.';
  const heroTitle = settings.heroTitle || 'Der App Store für alle.';
  const heroSubtitle = settings.heroSubtitle || 'Entdecken Sie Open-Source-Apps, cloud-native Lösungen und community-entwickelte Tools – frei zugänglich für jeden.';

  useEffect(() => {
    getApps().then((appsData) => {
      setApps(appsData);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return <HomeLoadingState />;

  return (
    <div className="flex flex-col gap-10 pb-16">
      {/* Hero section */}
      <section className="relative overflow-hidden rounded-2xl bg-surface-secondary border border-border px-6 py-8 md:py-10 text-center mt-2 group">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl pointer-events-none opacity-30 dark:opacity-20 transition-opacity group-hover:opacity-40">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[70%] rounded-full bg-accent/20 blur-[100px] animate-pulse" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[70%] rounded-full bg-gov-gold/20 blur-[100px] animate-pulse delay-700" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-xs font-bold text-muted mb-4 shadow-sm">
            <Rocket className="w-3 h-3 text-success" />
            {heroBadge}
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground mb-3 max-w-4xl leading-[1.1]">
            <span className={`inline-block font-extrabold bg-gradient-to-r from-accent via-gov-red to-gov-gold bg-clip-text text-transparent ${isDark ? "drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]" : ""}`}>
              {heroTitle}
            </span>
          </h1>

          <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {heroSubtitle}
          </p>
        </div>
      </section>

      <div id="all-apps" className="scroll-mt-8">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-surface-secondary border border-border" />}>
          <AppGrid initialApps={apps} />
        </Suspense>
      </div>
    </div>
  );
}
