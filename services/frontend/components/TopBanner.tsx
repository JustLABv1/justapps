'use client';

import { useSettings } from "@/context/SettingsContext";
import { Sparkles } from "lucide-react";

export function TopBanner() {
  const { settings, loaded } = useSettings();

  if (!loaded || !settings.showTopBanner || !settings.topBannerText) return null;

  return (
    <div className="bg-accent/10 border-b border-accent/20 px-4 py-3 text-center animate-in fade-in slide-in-from-top-4 duration-500">
      <p className="text-sm font-bold text-accent flex items-center justify-center gap-2">
        <Sparkles className="w-4 h-4" />
        {settings.topBannerText}
      </p>
    </div>
  );
}
