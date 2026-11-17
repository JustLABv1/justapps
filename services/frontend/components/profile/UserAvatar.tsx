'use client';

import { Avatar, type AvatarSize } from '@/components/panelui/avatar';
import { resolveAssetUrl } from '@/lib/assets';

/** The name a person goes by: their display name, else their username. */
export function displayNameOf(user: { displayName?: string; username: string }) {
  return user.displayName?.trim() || user.username;
}

/** A user's profile picture, or their initials when they have none. */
export function UserAvatar({
  user,
  size,
  className,
}: {
  user: { displayName?: string; username?: string; avatarUrl?: string };
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <Avatar
      size={size}
      name={authorName(user, '?')}
      src={resolveAssetUrl(user.avatarUrl) ?? undefined}
      className={className}
    />
  );
}

/** What a rating, question or answer says about who wrote it. */
export interface AuthorFields {
  userId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

type Viewer = { id: string; username: string; displayName?: string; avatarUrl?: string } | null | undefined;

/**
 * The author as shown. For the viewer's own items the signed-in profile wins,
 * so a picture or name changed a moment ago shows at once, before any reload.
 */
export function authorOf(item: AuthorFields, viewer?: Viewer) {
  if (viewer && item.userId && item.userId === viewer.id) {
    return { username: viewer.username, displayName: viewer.displayName, avatarUrl: viewer.avatarUrl };
  }
  return { username: item.username || '', displayName: item.displayName, avatarUrl: item.avatarUrl };
}

/** The author's name, or a neutral word when the item has none. */
export function authorName(author: { username?: string; displayName?: string }, fallback = 'Anonymer Nutzer') {
  return author.displayName?.trim() || author.username?.trim() || fallback;
}
