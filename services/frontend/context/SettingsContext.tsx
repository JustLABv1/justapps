'use client';

import { fetchApi } from '@/lib/api';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface DetailFieldDef {
  key: string;
  label: string;
  icon?: string; // Lucide icon name, e.g. "Layers"
}

export interface FooterLink {
  label: string;
  url: string;
}

export interface StoreSettings {
  id: string;
  allowAppSubmissions: boolean;
  showTopBanner: boolean;
  topBannerText: string;
  /** Schema for the "Fachliche Details" tab — admin-configurable */
  detailFields: DetailFieldDef[];
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
  footerLinks: FooterLink[];
  showFlagBar: boolean;
}

/** Default field schema — matches the 11 legacy columns so apps with old data still display correctly. */
export const defaultDetailFields: DetailFieldDef[] = [
  { key: 'focus',          label: 'Themenfeld',      icon: 'Layers' },
  { key: 'app_type',       label: 'Anwendungstyp',   icon: 'Globe' },
  { key: 'use_case',       label: 'Anwendungsfall',  icon: 'FileCode' },
  { key: 'visualization',  label: 'Visualisierung',  icon: 'Eye' },
  { key: 'deployment',     label: 'Deployment',      icon: 'Server' },
  { key: 'infrastructure', label: 'Infrastruktur',   icon: 'LayoutDashboard' },
  { key: 'database',       label: 'Datenbasis',      icon: 'Database' },
  { key: 'transferability',label: 'Übertragbarkeit', icon: 'ArrowRightLeft' },
  { key: 'authority',      label: 'Behörde',         icon: 'Globe' },
  { key: 'contact_person', label: 'Ansprechpartner', icon: 'User' },
  { key: 'additional_info',label: 'Sonstiges',       icon: 'ClipboardList' },
];

export const defaultSettings: StoreSettings = {
  id: 'default',
  allowAppSubmissions: true,
  showTopBanner: false,
  topBannerText: '',
  detailFields: defaultDetailFields,
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
  footerLinks: [],
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
        setSettings({
          ...defaultSettings,
          ...data,
          // Guard: if the API returns null/empty detailFields, keep the built-in defaults
          detailFields: (data.detailFields && data.detailFields.length > 0)
            ? data.detailFields
            : defaultDetailFields,
        });
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
