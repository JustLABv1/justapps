import type { StoreSettings } from '@/context/SettingsContext';

export function allowsAnonymousAI(settings: StoreSettings): boolean {
  return settings.aiEnabled && settings.allowAnonymousAI && !settings.requireAuthForAppStore;
}

export function canAccessAI(settings: StoreSettings, isAuthenticated: boolean): boolean {
  return settings.aiEnabled && (isAuthenticated || allowsAnonymousAI(settings));
}