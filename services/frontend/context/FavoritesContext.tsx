'use client';

import { fetchApi } from '@/lib/api';
import React, { createContext, startTransition, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface FavoritesContextType {
  favorites: Set<string>;
  isLoaded: boolean;
  toggle: (appId: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: new Set(),
  isLoaded: false,
  toggle: async () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      startTransition(() => {
        setFavorites(new Set());
        setIsLoaded(false);
      });
      return;
    }

    async function load() {
      setIsLoaded(false);
      try {
        const res = await fetchApi('/user/favorites');
        const data: { app_ids?: string[] } | null = res.ok ? await res.json() : null;
        setFavorites(new Set(data?.app_ids ?? []));
        setIsLoaded(true);
      } catch {
        setIsLoaded(true);
      }
    }
    load();
  }, [user]);

  const toggle = useCallback(async (appId: string) => {
    const isFav = favorites.has(appId);

    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(appId);
      else next.add(appId);
      return next;
    });

    try {
      const res = await fetchApi(`/apps/${appId}/favorite`, {
        method: isFav ? 'DELETE' : 'POST',
      });
      if (!res.ok) {
        // Revert on failure
        setFavorites((prev) => {
          const next = new Set(prev);
          if (isFav) next.add(appId);
          else next.delete(appId);
          return next;
        });
      }
    } catch {
      // Revert on error
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(appId);
        else next.delete(appId);
        return next;
      });
    }
  }, [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, isLoaded, toggle }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
