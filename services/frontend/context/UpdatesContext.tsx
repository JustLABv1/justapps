'use client';

import type { FAQAnswerNotification, FAQNotification, ReleaseInboxItem, UpdatePreferences } from '@/config/apps';
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
  markAllAsSeen: () => Promise<boolean>;
  markFAQAsSeen: (notificationId: string) => Promise<boolean>;
  markFAQAnswerAsSeen: (notificationId: string) => Promise<boolean>;
  loadInboxItems: (status?: 'all' | 'unread', page?: number, pageSize?: number) => Promise<NotificationPage<ReleaseInboxItem>>;
  loadFAQNotifications: (status?: 'all' | 'unread', page?: number, pageSize?: number) => Promise<NotificationPage<FAQNotification>>;
  loadFAQAnswerNotifications: (status?: 'all' | 'unread', page?: number, pageSize?: number) => Promise<NotificationPage<FAQAnswerNotification>>;
}

export interface NotificationPage<T> {
  items: T[];
  page: number;
  total: number;
  hasMore: boolean;
}

const emptyPage = <T,>(page = 1): NotificationPage<T> => ({ items: [], page, total: 0, hasMore: false });

const UpdatesContext = createContext<UpdatesContextType>({
  totalUnread: 0,
  appUnreadCounts: {},
  preferences: null,
  loaded: false,
  refreshSummary: async () => {},
  refreshPreferences: async () => {},
  updatePreferences: async () => false,
  markAsSeen: async () => false,
  markAllAsSeen: async () => false,
  markFAQAsSeen: async () => false,
  markFAQAnswerAsSeen: async () => false,
  loadInboxItems: async () => emptyPage(),
  loadFAQNotifications: async () => emptyPage(),
  loadFAQAnswerNotifications: async () => emptyPage(),
});

export function UpdatesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
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
    if (!user) return;
    try {
      const [releaseResponse, faqResponse] = await Promise.all([
        fetchApi('/user/updates/summary', { cache: 'no-store' }).catch(() => null),
        fetchApi('/user/faq-notifications/summary', { cache: 'no-store' }).catch(() => null),
      ]);
      const releaseData = releaseResponse?.ok
        ? await releaseResponse.json() as { totalUnread?: number; appUnreadCounts?: Record<string, number> }
        : {};
      const faqData = faqResponse?.ok
        ? await faqResponse.json() as { totalUnread?: number; appUnreadCounts?: Record<string, number> }
        : {};
      const appCounts = { ...(releaseData.appUnreadCounts ?? {}) };
      Object.entries(faqData.appUnreadCounts ?? {}).forEach(([appId, count]) => {
        appCounts[appId] = (appCounts[appId] ?? 0) + count;
      });
      setTotalUnread((releaseData.totalUnread ?? 0) + (faqData.totalUnread ?? 0));
      setAppUnreadCounts(appCounts);
    } finally {
      setLoaded(true);
    }
  };

  const refreshPreferences = async () => {
    if (!user) return;
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

    const timeoutId = window.setTimeout(() => {
      void Promise.all([refreshSummary(), refreshPreferences()]);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  const markAllAsSeen = async () => {
    try {
      const response = await fetchApi('/user/updates/seen', { method: 'POST' });
      if (!response.ok) {
        return false;
      }

      setTotalUnread(0);
      setAppUnreadCounts({});
      await refreshSummary().catch(() => {});
      return true;
    } catch {
      return false;
    }
  };

  const markFAQAsSeen = async (notificationId: string) => {
    try {
      const response = await fetchApi(`/user/faq-notifications/${notificationId}/seen`, { method: 'POST' });
      if (!response.ok) {
        return false;
      }
      await refreshSummary().catch(() => {});
      return true;
    } catch {
      return false;
    }
  };

  const markFAQAnswerAsSeen = async (notificationId: string) => {
    try {
      const response = await fetchApi(`/user/faq-answer-notifications/${notificationId}/seen`, { method: 'POST' });
      if (!response.ok) return false;
      await refreshSummary().catch(() => {});
      return true;
    } catch {
      return false;
    }
  };

  const loadInboxItems = async (status: 'all' | 'unread' = 'all', page = 1, pageSize = 15) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status === 'unread') query.set('status', 'unread');
    const response = await fetchApi(`/user/updates?${query}`, { cache: 'no-store' });
    if (!response.ok) {
      return emptyPage<ReleaseInboxItem>(page);
    }
    const data = await response.json() as Partial<NotificationPage<ReleaseInboxItem>> | null;
    return { items: Array.isArray(data?.items) ? data.items : [], page: data?.page ?? page, total: data?.total ?? 0, hasMore: data?.hasMore === true };
  };

  const loadFAQNotifications = async (status: 'all' | 'unread' = 'all', page = 1, pageSize = 15) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status === 'unread') query.set('status', 'unread');
    try {
      const response = await fetchApi(`/user/faq-notifications?${query}`, { cache: 'no-store' });
      if (!response.ok) {
        return emptyPage<FAQNotification>(page);
      }
      const data = await response.json() as Partial<NotificationPage<FAQNotification>> | null;
      return { items: Array.isArray(data?.items) ? data.items : [], page: data?.page ?? page, total: data?.total ?? 0, hasMore: data?.hasMore === true };
    } catch {
      return emptyPage<FAQNotification>(page);
    }
  };

  const loadFAQAnswerNotifications = async (status: 'all' | 'unread' = 'all', page = 1, pageSize = 15) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status === 'unread') query.set('status', 'unread');
    try {
      const response = await fetchApi(`/user/faq-answer-notifications?${query}`, { cache: 'no-store' });
      if (!response.ok) return emptyPage<FAQAnswerNotification>(page);
      const data = await response.json() as Partial<NotificationPage<FAQAnswerNotification>> | null;
      return { items: Array.isArray(data?.items) ? data.items : [], page: data?.page ?? page, total: data?.total ?? 0, hasMore: data?.hasMore === true };
    } catch {
      return emptyPage<FAQAnswerNotification>(page);
    }
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
        markAllAsSeen,
        markFAQAsSeen,
        markFAQAnswerAsSeen,
        loadInboxItems,
        loadFAQNotifications,
        loadFAQAnswerNotifications,
      }}
    >
      {children}
    </UpdatesContext.Provider>
  );
}

export function useUpdates() {
  return useContext(UpdatesContext);
}
