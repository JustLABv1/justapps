'use client';

import { useFavorites } from '@/context/FavoritesContext';
import { Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface FavoriteButtonProps {
  appId: string;
  className?: string;
}

export function FavoriteButton({ appId, className = '' }: FavoriteButtonProps) {
  const { user } = useAuth();
  const { favorites, isLoaded, toggle } = useFavorites();

  if (!user || !isLoaded) return null;

  const isFav = favorites.has(appId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(appId);
      }}
      aria-label={isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${
        isFav
          ? 'text-danger bg-danger/10 hover:bg-danger/20'
          : 'text-muted hover:text-danger hover:bg-danger/10'
      } ${className}`}
    >
      <Heart className={`w-3.5 h-3.5 transition-all ${isFav ? 'fill-current' : ''}`} />
    </button>
  );
}
