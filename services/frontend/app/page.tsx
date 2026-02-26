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
    <div className="flex flex-col gap-10">
      {/* Hero section */}
      <section className="text-center py-8 md:py-12">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4">
          Community Store für die{" "}
          <span className={`inline-block font-bold bg-gradient-to-r from-black via-gov-red to-gov-gold bg-clip-text text-transparent ${isDark ? "drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]" : ""}`}>PLAIN Plattform</span>
        </h1>
        <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
          Entdecken Sie Open-Source-Lösungen, Cloud-Native Applikationen und Standards
          für die Digitalisierung staatlicher Leistungen.
        </p>
      </section>

      <AppGrid initialApps={apps} />
    </div>
  );
}
