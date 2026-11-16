"use client";

import { Button } from "@/components/panelui/button";
import type { AppRelease } from "@/config/apps";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useUpdates } from "@/context/UpdatesContext";
import { toast } from "@/lib/toast";
import { Bell, BellOff, BellRing } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ReleaseList } from "./ReleaseList";

/**
 * Updates for an app reach a user's inbox when they favourite it (with that
 * preference on), manage it, or have viewed it recently. "Abonnieren" is the
 * favourite route, the one a user controls per app.
 */
function Subscription({ appId, isOwner }: { appId: string; isOwner: boolean }) {
  const { favorites, isLoaded, toggle } = useFavorites();
  const { preferences, updatePreferences } = useUpdates();
  const [busy, setBusy] = useState(false);
  if (!isLoaded || !preferences) return null;

  const favourite = favorites.has(appId);
  const subscribed = favourite && preferences.notifyFavoritedApps;
  const viaOwnership = isOwner && preferences.notifyOwnedManagedApps;

  const subscribe = async () => {
    setBusy(true);
    try {
      if (!favourite) await toggle(appId);
      if (!preferences.notifyFavoritedApps) {
        await updatePreferences({
          notifyFavoritedApps: true,
          notifyRecentlyViewedApps: preferences.notifyRecentlyViewedApps,
          notifyOwnedManagedApps: preferences.notifyOwnedManagedApps,
        });
      }
      toast.success("Du wirst über neue Versionen informiert.");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    try {
      await toggle(appId);
      toast.info("Die App ist nicht mehr in deinen Favoriten.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
      <p className="flex items-center gap-2.5 text-sm">
        {subscribed || viaOwnership ? <BellRing className="size-4 text-info" /> : <Bell className="size-4 text-muted-foreground" />}
        {subscribed
          ? "Du bekommst neue Versionen in deine Updates, weil die App in deinen Favoriten ist."
          : viaOwnership
            ? "Du bekommst neue Versionen in deine Updates, weil du die App betreust."
            : "Neue Versionen dieser App in deinen Updates sehen."}
      </p>
      {subscribed ? (
        <Button variant="ghost" size="sm" loading={busy} onClick={() => void unsubscribe()}>
          <BellOff />
          Abbestellen
        </Button>
      ) : !viaOwnership ? (
        <Button variant="outline" size="sm" loading={busy} onClick={() => void subscribe()}>
          <Bell />
          Abonnieren
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The release history. Releases still unread in the user's update inbox are
 * marked "Neu für dich" for this visit and marked as seen once the tab has been
 * open for a moment, so the badge in the navigation goes down.
 */
export function ChangelogTab({ appId, releases, active, isOwner, fallback }: {
  appId: string;
  releases: AppRelease[];
  active: boolean;
  isOwner: boolean;
  fallback: ReactNode;
}) {
  const { user } = useAuth();
  const { appUnreadCounts, loadInboxItems, markAsSeen } = useUpdates();
  const [unread, setUnread] = useState<Map<string, string>>(new Map());
  const hasUnread = (appUnreadCounts[appId] ?? 0) > 0;

  useEffect(() => {
    if (!user || !hasUnread) return;
    let cancelled = false;
    void loadInboxItems("unread", 1, 50).then((page) => {
      if (cancelled) return;
      const items = page.items.filter((item) => item.appId === appId);
      if (items.length) setUnread(new Map(items.map((item) => [item.releaseId, item.id])));
    });
    return () => {
      cancelled = true;
    };
    // Loaded once per app; later count changes come from marking these seen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, appId, hasUnread]);

  // Each item is marked once; the context's functions change on every refresh.
  const marked = useRef(new Set<string>());
  const markRef = useRef(markAsSeen);
  useEffect(() => {
    markRef.current = markAsSeen;
  });
  useEffect(() => {
    const pending = [...unread.values()].filter((itemId) => !marked.current.has(itemId));
    if (!active || pending.length === 0) return;
    const timeout = window.setTimeout(() => {
      pending.forEach((itemId) => {
        marked.current.add(itemId);
        void markRef.current(itemId);
      });
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [active, unread]);

  return (
    <div className="flex flex-col gap-6">
      {user && <Subscription appId={appId} isOwner={isOwner} />}
      {releases.length > 0 ? <ReleaseList releases={releases} newReleaseIds={new Set(unread.keys())} /> : fallback}
    </div>
  );
}
