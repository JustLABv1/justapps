'use client';

import { fetchApi } from '@/lib/api';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface StoreSettings {
  id: string;
  allowAppSubmissions: boolean;
  showTopBanner: boolean;
  topBannerText: string;
  // Branding
  storeName: string;
  storeDescription: string;
  logoUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  accentColor: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  footerText: string;
  showFlagBar: boolean;
}

export const defaultSettings: StoreSettings = {
  id: 'default',
  allowAppSubmissions: true,
  showTopBanner: false,
  topBannerText: '',
  storeName: '',
  storeDescription: '',
  logoUrl: '',
  logoDarkUrl: '',
  faviconUrl: '',
  accentColor: '',
  heroBadge: '',
  heroTitle: '',
  heroSubtitle: '',
  footerText: '',
  showFlagBar: true,
};

interface SettingsContextType {
  settings: StoreSettings;
  loaded: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loaded: false,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetchApi('/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...defaultSettings, ...data });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Inject accent color CSS override
  useEffect(() => {
    const styleId = 'store-brand-accent';
    let el = document.getElementById(styleId) as HTMLStyleElement | null;

    if (settings.accentColor) {
      if (!el) {
        el = document.createElement('style');
        el.id = styleId;
        document.head.appendChild(el);
      }
      el.textContent = `
        :root, [data-theme="light"] { --accent: ${settings.accentColor}; }
        .dark, [data-theme="dark"] { --accent: ${settings.accentColor}; }
      `;
    } else if (el) {
      el.remove();
    }
  }, [settings.accentColor]);

  // Update document title dynamically
  useEffect(() => {
    if (settings.storeName) {
      document.title = settings.storeName;
    }
  }, [settings.storeName]);

  return (
    <SettingsContext.Provider value={{ settings, loaded, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

// Helper: returns storeName with fallback
export function useStoreName(fallback = 'JustApps') {
  const { settings } = useSettings();
  return settings.storeName || fallback;
}
