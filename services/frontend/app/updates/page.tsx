"use client";

import type { ReleaseInboxItem } from "@/config/apps";
import { ReleaseDiffViewer } from "@/components/ReleaseDiffViewer";
import { useAuth } from "@/context/AuthContext";
import { useUpdates } from "@/context/UpdatesContext";
import { Accordion, Button, Card, Chip, Label, Spinner, Switch, toast } from "@heroui/react";
import { Bell, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getImageAssetUrl } from "../../lib/assets";

function reasonLabel(reason: string) {
  switch (reason) {
    case "favorite":
      return "Favorit";
    case "recently_viewed":
      return "Zuletzt angesehen";
    case "owned":
      return "Eigene App";
    default:
      return reason;
  }
}

export default function UpdatesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    loadInboxItems,
    markAsSeen,
    refreshSummary,
    preferences,
    updatePreferences,
    loaded,
  } = useUpdates();
  const [items, setItems] = useState<ReleaseInboxItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const safeItems = Array.isArray(items) ? items : [];

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;

    const timeoutId = window.setTimeout(async () => {
      setPageLoading(true);
      try {
        const nextItems = await loadInboxItems("all");
        setItems(nextItems);
      } finally {
        setPageLoading(false);
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadInboxItems, user]);

  const handleRefresh = async () => {
    setPageLoading(true);
    try {
      await refreshSummary();
      const nextItems = await loadInboxItems("all");
      setItems(nextItems);
    } finally {
      setPageLoading(false);
    }
  };

  const handleMarkSeen = async (itemId: string) => {
    setUpdatingItemId(itemId);
    try {
      const ok = await markAsSeen(itemId);
      if (!ok) {
        toast.danger("Update konnte nicht als gelesen markiert werden.");
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === itemId
            ? { ...item, seenAt: new Date().toISOString() }
            : item,
        ),
      );
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handlePreferenceChange = async (patch: {
    notifyFavoritedApps: boolean;
    notifyRecentlyViewedApps: boolean;
    notifyOwnedManagedApps: boolean;
  }) => {
    setSavingPreferences(true);
    try {
      const ok = await updatePreferences(patch);
      if (!ok) {
        toast.danger(
          "Benachrichtigungseinstellungen konnten nicht gespeichert werden.",
        );
      }
    } finally {
      setSavingPreferences(false);
    }
  };

  if (authLoading || (!loaded && pageLoading)) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-sm text-muted">Updates werden geladen...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Updates</h1>
          <p className="text-sm text-muted">
            Alle automatischen Änderungen aus Apps, die Sie verfolgen.
          </p>
        </div>
        <Button variant="secondary" onPress={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Aktualisieren
        </Button>
      </div>

      <Card variant="default">
        <Card.Header className="flex flex-col items-start gap-1">
          <Card.Title>Benachrichtigungseinstellungen</Card.Title>
          <Card.Description>
            Steuern Sie, für welche App-Beziehungen neue Releases in Ihrem
            Posteingang auftauchen.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-4 sm:grid-cols-3">
          <Switch
            isSelected={preferences?.notifyFavoritedApps ?? true}
            isDisabled={savingPreferences || !preferences}
            onChange={(value) => {
              if (!preferences) return;
              void handlePreferenceChange({
                notifyFavoritedApps: value,
                notifyRecentlyViewedApps: preferences.notifyRecentlyViewedApps,
                notifyOwnedManagedApps: preferences.notifyOwnedManagedApps,
              });
            }}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label>Favorisierte Apps</Label>
            </Switch.Content>
          </Switch>
          <Switch
            isSelected={preferences?.notifyRecentlyViewedApps ?? true}
            isDisabled={savingPreferences || !preferences}
            onChange={(value) => {
              if (!preferences) return;
              void handlePreferenceChange({
                notifyFavoritedApps: preferences.notifyFavoritedApps,
                notifyRecentlyViewedApps: value,
                notifyOwnedManagedApps: preferences.notifyOwnedManagedApps,
              });
            }}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label>Zuletzt angesehene Apps</Label>
            </Switch.Content>
          </Switch>
          <Switch
            isSelected={preferences?.notifyOwnedManagedApps ?? true}
            isDisabled={savingPreferences || !preferences}
            onChange={(value) => {
              if (!preferences) return;
              void handlePreferenceChange({
                notifyFavoritedApps: preferences.notifyFavoritedApps,
                notifyRecentlyViewedApps: preferences.notifyRecentlyViewedApps,
                notifyOwnedManagedApps: value,
              });
            }}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label>Eigene und verwaltete Apps</Label>
            </Switch.Content>
          </Switch>
        </Card.Content>
      </Card>

      <div className="flex flex-col gap-4">
        {pageLoading ? (
          <div className="flex min-h-[20vh] flex-col items-center justify-center gap-3">
            <Spinner />
            <p className="text-sm text-muted">
              Release-Updates werden geladen...
            </p>
          </div>
        ) : safeItems.length === 0 ? (
          <Card variant="default">
            <Card.Content className="flex flex-col items-center gap-3 py-12 text-center">
              <Bell className="h-8 w-8 text-muted" />
              <div>
                <p className="font-semibold text-foreground">
                  Keine Updates vorhanden
                </p>
                <p className="text-sm text-muted">
                  Sobald verfolgte Apps neue Releases veröffentlichen,
                  erscheinen sie hier.
                </p>
              </div>
            </Card.Content>
          </Card>
        ) : (
          safeItems.map((item) => {
            const iconSrc = getImageAssetUrl(item.appIcon);

            return (
              <Card
                key={item.id}
                variant={item.seenAt ? "default" : "secondary"}
              >
                <Card.Content className="flex flex-col gap-4 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-border bg-surface-secondary">
                        {iconSrc ? (
                          <Image
                            src={iconSrc}
                            alt={item.appName}
                            fill
                            className="object-contain p-2"
                            sizes="48px"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-lg font-semibold text-muted">
                            {item.appName.slice(0, 1)}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-foreground">
                            {item.appName}
                          </p>
                          <Chip
                            size="sm"
                            color={
                              item.releaseType === "minor"
                                ? "accent"
                                : "success"
                            }
                            variant="soft"
                            className="text-[10px] font-bold uppercase"
                          >
                            {item.releaseType}
                          </Chip>
                          <Chip
                            size="sm"
                            variant="soft"
                            className="text-[10px] font-bold uppercase"
                          >
                            v{item.version}
                          </Chip>
                          {!item.seenAt && (
                            <Chip
                              size="sm"
                              color="accent"
                              variant="soft"
                              className="text-[10px] font-bold uppercase"
                            >
                              Neu
                            </Chip>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        <p className="text-sm text-muted">{item.summary}</p>
                        {item.diffPreview && (
                          <p className="text-sm font-medium text-foreground/85">
                            {item.diffPreview}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>
                            {new Date(item.publishedAt).toLocaleString("de-DE")}
                          </span>
                          <span>•</span>
                          <span>{reasonLabel(item.reason)}</span>
                        </div>
                        {item.changedAreas.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {item.changedAreas.map((area) => (
                              <Chip
                                key={area}
                                size="sm"
                                variant="soft"
                                className="text-[10px] font-semibold uppercase"
                              >
                                {area}
                              </Chip>
                            ))}
                          </div>
                        )}
                        {item.changeDetails.length > 0 && (
                          <Accordion
                            variant="surface"
                            className="rounded-2xl bg-surface-secondary/50"
                          >
                            <Accordion.Item>
                              <Accordion.Heading>
                                <Accordion.Trigger className="text-sm font-medium">
                                  Diff anzeigen
                                  <Accordion.Indicator />
                                </Accordion.Trigger>
                              </Accordion.Heading>
                              <Accordion.Panel>
                                <Accordion.Body className="flex flex-col gap-3">
                                  {item.changeDetails.map((detail) => (
                                    <ReleaseDiffViewer
                                      key={`${detail.area}-${detail.field}`}
                                      detail={detail}
                                    />
                                  ))}
                                </Accordion.Body>
                              </Accordion.Panel>
                            </Accordion.Item>
                          </Accordion>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        className="gap-2"
                        onPress={() =>
                          router.push(`/apps/${item.appId}#changelog`)
                        }
                      >
                        <ExternalLink className="h-4 w-4" />
                        Öffnen
                      </Button>
                      {!item.seenAt && (
                        <Button
                          variant="secondary"
                          className="gap-2"
                          isPending={updatingItemId === item.id}
                          onPress={() => void handleMarkSeen(item.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Gelesen
                        </Button>
                      )}
                    </div>
                  </div>
                </Card.Content>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
