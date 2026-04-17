'use client';

import { useSettings } from "@/context/SettingsContext";
import { resolveTopBarColors } from '@/lib/branding';

export function FlagBar() {
  const { settings, loaded } = useSettings();
  const colors = resolveTopBarColors(settings.topBarPreset, settings.topBarColors);

  // Default to showing flag bar until settings load, then respect the setting
  if (loaded && !settings.showFlagBar) return null;

  return (
    <div className="h-1 w-full flex shrink-0" aria-hidden="true">
      {colors.map((color, index) => (
        <div
          key={`${color}-${index}`}
          className="h-full flex-1"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}
