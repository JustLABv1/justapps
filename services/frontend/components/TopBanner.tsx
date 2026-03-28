'use client';

import { useSettings } from "@/context/SettingsContext";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

const BANNER_STYLES = {
  info: {
    bg: 'bg-accent/10',
    border: 'border-accent/20',
    text: 'text-accent',
    Icon: Sparkles,
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-warning/20',
    text: 'text-warning',
    Icon: AlertTriangle,
  },
  critical: {
    bg: 'bg-danger/10',
    border: 'border-danger/20',
    text: 'text-danger',
    Icon: AlertTriangle,
  },
} as const;

export function TopBanner() {
  const { settings, loaded } = useSettings();
  const [dismissed, setDismissed] = useState(false);

  const dismissKey = `banner-dismissed-${settings.topBannerText}`;

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(dismissKey)) {
      setDismissed(true);
    }
  }, [dismissKey]);

  const handleDismiss = () => {
    sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  if (!loaded || !settings.showTopBanner || !settings.topBannerText || dismissed) return null;

  const type = (settings.topBannerType || 'info') as keyof typeof BANNER_STYLES;
  const style = BANNER_STYLES[type] ?? BANNER_STYLES.info;
  const { Icon } = style;

  return (
    <div className={`${style.bg} border-b ${style.border} px-4 py-3 animate-in fade-in slide-in-from-top-4 duration-500`}>
      <div className="relative flex items-center justify-center max-w-7xl mx-auto">
        <p className={`text-sm font-bold ${style.text} flex items-center gap-2`}>
          <Icon className="w-4 h-4 shrink-0" />
          {settings.topBannerText}
        </p>
        <button
          onClick={handleDismiss}
          className={`absolute right-0 ${style.text} opacity-60 hover:opacity-100 transition-opacity p-1 rounded`}
          aria-label="Banner schließen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
