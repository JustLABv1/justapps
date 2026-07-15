'use client';

import type { ReleaseInboxItem, UpdatePreferences } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface UpdatesContextType {
  totalUnread: number;
  appUnreadCounts: Record<string, number>;
  preferences: UpdatePreferences | null;
  loaded: boolean;
  refreshSummary: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
  updatePreferences: (patch: Pick<UpdatePreferences, 'notifyFavoritedApps' | 'notifyRecentlyViewedApps' | 'notifyOwnedManagedApps'>) => Promise<boolean>;
  markAsSeen: (itemId: string) => Promise<boolean>;
  loadInboxItems: (status?: 'all' | 'unread') => Promise<ReleaseInboxItem[]>;
}

const UpdatesContext = createContext<UpdatesContextType>({
  totalUnread: 0,
  appUnreadCounts: {},
  preferences: null,
  loaded: false,
  refreshSummary: async () => {},
  refreshPreferences: async () => {},
  updatePreferences: async () => false,
  markAsSeen: async () => false,
  loadInboxItems: async () => [],
});

export function UpdatesProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const [appUnreadCounts, setAppUnreadCounts] = useState<Record<string, number>>({});
  const [preferences, setPreferences] = useState<UpdatePreferences | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reset = () => {
    setTotalUnread(0);
    setAppUnreadCounts({});
    setPreferences(null);
    setLoaded(false);
  };

  const refreshSummary = async () => {
    if (!user || !token) return;
    try {
      const response = await fetchApi('/user/updates/summary', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { totalUnread?: number; appUnreadCounts?: Record<string, number> };
      setTotalUnread(data.totalUnread ?? 0);
      setAppUnreadCounts(data.appUnreadCounts ?? {});
    } finally {
      setLoaded(true);
    }
  };

  const refreshPreferences = async () => {
    if (!user || !token) return;
    const response = await fetchApi('/user/update-preferences', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json() as UpdatePreferences;
    setPreferences(data);
  };

  useEffect(() => {
    if (!user) {
      const timeoutId = window.setTimeout(() => {
        reset();
      }, 0);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    if (!token) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void Promise.all([refreshSummary(), refreshPreferences()]);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const updatePreferences = async (patch: Pick<UpdatePreferences, 'notifyFavoritedApps' | 'notifyRecentlyViewedApps' | 'notifyOwnedManagedApps'>) => {
    const previousPreferences = preferences;

    if (previousPreferences) {
      setPreferences({ ...previousPreferences, ...patch });
    }

    try {
      const response = await fetchApi('/user/update-preferences', {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        setPreferences(previousPreferences);
        return false;
      }

      const data = await response.json() as UpdatePreferences;
      setPreferences(data);
      return true;
    } catch {
      setPreferences(previousPreferences);
      return false;
    }
  };

  const markAsSeen = async (itemId: string) => {
    const response = await fetchApi(`/user/updates/${itemId}/seen`, { method: 'POST' });
    if (!response.ok) {
      return false;
    }
    await refreshSummary();
    return true;
  };

  const loadInboxItems = async (status: 'all' | 'unread' = 'all') => {
    const query = status === 'unread' ? '?status=unread' : '';
    const response = await fetchApi(`/user/updates${query}`, { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }
    const data = await response.json() as ReleaseInboxItem[] | null;
    return Array.isArray(data) ? data : [];
  };

  return (
    <UpdatesContext.Provider
      value={{
        totalUnread,
        appUnreadCounts,
        preferences,
        loaded,
        refreshSummary,
        refreshPreferences,
        updatePreferences,
        markAsSeen,
        loadInboxItems,
      }}
    >
      {children}
    </UpdatesContext.Provider>
  );
}

export function useUpdates() {
  return useContext(UpdatesContext);
}
