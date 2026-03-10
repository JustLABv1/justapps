'use client';

import { useSettings } from "@/context/SettingsContext";

export function FlagBar() {
  const { settings, loaded } = useSettings();

  // Default to showing flag bar until settings load, then respect the setting
  if (loaded && !settings.showFlagBar) return null;

  return (
    <div className="h-1 w-full flex shrink-0" aria-hidden="true">
      <div className="h-full w-1/3 bg-[#000]" />
      <div className="h-full w-1/3 bg-gov-red" />
      <div className="h-full w-1/3 bg-gov-gold" />
    </div>
  );
}
