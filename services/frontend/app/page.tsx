'use client';

import { AppGrid } from "@/components/AppGrid";
import { AppConfig } from "@/config/apps";
import { fetchApi } from "@/lib/api";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export const dynamic = 'force-dynamic';

async function getApps() {
  try {
    const res = await fetchApi('/apps', { cache: 'no-store' });
    if (!res.ok) {
      console.error(`Failed to fetch apps: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Error in getApps SSR:", e);
    return [];
  }
}

export default function Home() {
  const { theme } = useTheme();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isDark = theme === 'dark';

  useEffect(() => {
    getApps().then(data => {
      setApps(data);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return null;
  }

  console.log(isDark ? "Dark mode is active" : "Light mode is active");
  
  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Hero section */}
      <section className="relative overflow-hidden rounded-3xl bg-surface-secondary border border-border px-6 py-10 md:py-14 text-center mt-2">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl pointer-events-none opacity-30 dark:opacity-20">
          <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[60%] rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-gov-gold/20 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-xs font-semibold text-muted mb-4 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-success"></span>
            Open Source für die Verwaltung
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-4 max-w-4xl leading-[1.15]">
            Community Store für die{" "}
            <span className={`inline-block font-extrabold bg-gradient-to-r from-accent via-gov-red to-gov-gold bg-clip-text text-transparent ${isDark ? "drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]" : ""}`}>PLAIN Plattform</span>
          </h1>
          
          <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed mb-2">
            Entdecken Sie Open-Source-Lösungen, Cloud-Native Applikationen und Standards
            für die Digitalisierung staatlicher Leistungen.
          </p>
        </div>
      </section>

      <AppGrid initialApps={apps} />
    </div>
  );
}
