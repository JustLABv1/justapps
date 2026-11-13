'use client';

import { Button } from '@/components/panelui/button';
import { useFavorites } from '@/context/FavoritesContext';
import { Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface FavoriteButtonProps {
  appId: string;
  className?: string;
}

export function FavoriteButton({ appId, className }: FavoriteButtonProps) {
  const { user } = useAuth();
  const { favorites, isLoaded, toggle } = useFavorites();

  if (!user || !isLoaded) return null;

  const isFav = favorites.has(appId);
  const label = isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen';

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      shape="pill"
      aria-label={label}
      aria-pressed={isFav}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(appId);
      }}
    >
      <Heart className={isFav ? 'fill-destructive text-destructive' : undefined} />
    </Button>
  );
}
