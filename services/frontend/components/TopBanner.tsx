'use client';

import { useSettings } from "@/context/SettingsContext";
import { Alert, type AlertTone } from "@/components/panelui/alert";
import { startTransition, useEffect, useState } from "react";

const BANNER_TONE: Record<string, AlertTone> = {
  info: 'info',
  warning: 'warning',
  critical: 'destructive',
};

export function TopBanner() {
  const { settings, loaded } = useSettings();
  const [dismissed, setDismissed] = useState(false);

  const dismissKey = `banner-dismissed-${settings.topBannerText}`;

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(dismissKey)) {
      startTransition(() => setDismissed(true));
    }
  }, [dismissKey]);

  const handleDismiss = () => {
    sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  if (!loaded || !settings.showTopBanner || !settings.topBannerText || dismissed) return null;

  const tone = BANNER_TONE[settings.topBannerType || 'info'] ?? 'info';

  return (
    <Alert
      variant="banner"
      tone={tone}
      onOpenChange={(open) => {
        if (!open) handleDismiss();
      }}
    >
      <Alert.Icon />
      <Alert.Title>{settings.topBannerText}</Alert.Title>
      <Alert.Close aria-label="Hinweis schließen" />
    </Alert>
  );
}
