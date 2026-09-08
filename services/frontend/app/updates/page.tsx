"use client";

import { ReleaseDiffViewer } from "@/components/ReleaseDiffViewer";
import type { FAQNotification, ReleaseInboxItem } from "@/config/apps";
import { useAuth } from "@/context/AuthContext";
import { useUpdates } from "@/context/UpdatesContext";
import {
    Accordion,
    Button,
    Card,
    Chip,
    Spinner,
    Switch,
    toast,
} from "@heroui/react";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  MessageCircleQuestion,
  RefreshCw,
} from "lucide-react";
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
    loadFAQNotifications,
    markAsSeen,
    markAllAsSeen,
    markFAQAsSeen,
    refreshSummary,
    preferences,
    updatePreferences,
    loaded,
  } = useUpdates();
  const [items, setItems] = useState<ReleaseInboxItem[]>([]);
  const [faqNotifications, setFAQNotifications] = useState<FAQNotification[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [markingAllSeen, setMarkingAllSeen] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const safeItems = Array.isArray(items) ? items : [];
  const safeFAQNotifications = Array.isArray(faqNotifications)
    ? faqNotifications
    : [];
  const hasUnreadItems = safeItems.some((item) => !item.seenAt)
    || safeFAQNotifications.some((item) => !item.seenAt);

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
        const [nextItems, nextFAQNotifications] = await Promise.all([
          loadInboxItems("all"),
          loadFAQNotifications("all"),
        ]);
        setItems(nextItems);
        setFAQNotifications(nextFAQNotifications);
      } finally {
        setPageLoading(false);
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadFAQNotifications, loadInboxItems, user]);

  const handleRefresh = async () => {
    setPageLoading(true);
    try {
      await refreshSummary();
      const [nextItems, nextFAQNotifications] = await Promise.all([
        loadInboxItems("all"),
        loadFAQNotifications("all"),
      ]);
      setItems(nextItems);
      setFAQNotifications(nextFAQNotifications);
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

  const handleMarkAllSeen = async () => {
    if (!hasUnreadItems) return;

    setMarkingAllSeen(true);
    try {
      const ok = await markAllAsSeen();
      if (!ok) {
        toast.danger("Updates konnten nicht als gelesen markiert werden.");
        return;
      }

      const seenAt = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, seenAt })));
      setFAQNotifications((current) =>
        current.map((notification) => ({ ...notification, seenAt })),
      );
      toast.success("Alle Updates wurden als gelesen markiert.");
    } finally {
      setMarkingAllSeen(false);
    }
  };

  const handleMarkFAQSeen = async (notificationId: string) => {
    setUpdatingItemId(`faq:${notificationId}`);
    try {
      const ok = await markFAQAsSeen(notificationId);
      if (!ok) {
        toast.danger("FAQ-Benachrichtigung konnte nicht als gelesen markiert werden.");
        return;
      }
      setFAQNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, seenAt: new Date().toISOString() }
            : notification,
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
            Neue Releases und wichtige Hinweise zu Ihren Apps.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            isDisabled={!hasUnreadItems || markingAllSeen}
            isPending={markingAllSeen}
            onPress={() => void handleMarkAllSeen()}
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Alle als gelesen markieren
          </Button>
          <Button variant="secondary" onPress={handleRefresh} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Aktualisieren
          </Button>
        </div>
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
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Favorisierte Apps
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
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Zuletzt angesehene Apps
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
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Eigene und verwaltete Apps
            </Switch.Content>
          </Switch>
        </Card.Content>
      </Card>

      <div className="flex flex-col gap-4">
        {pageLoading ? (
          <div className="flex min-h-[20vh] flex-col items-center justify-center gap-3">
            <Spinner />
            <p className="text-sm text-muted">
              Updates und FAQ-Benachrichtigungen werden geladen...
            </p>
          </div>
        ) : safeItems.length === 0 && safeFAQNotifications.length === 0 ? (
          <Card variant="default">
            <Card.Content className="flex flex-col items-center gap-3 py-12 text-center">
              <Bell className="h-8 w-8 text-muted" />
              <div>
                <p className="font-semibold text-foreground">
                  Keine Updates vorhanden
                </p>
                <p className="text-sm text-muted">
                  Sobald verfolgte Apps neue Releases veröffentlichen oder
                  neue Fragen zu Ihren Apps gestellt werden, erscheinen sie hier.
                </p>
              </div>
            </Card.Content>
          </Card>
        ) : (
          <>
            {safeFAQNotifications.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <MessageCircleQuestion className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Offene FAQ-Fragen
                  </h2>
                  <Chip size="sm" color="accent" variant="soft" className="text-[10px] font-bold">
                    {safeFAQNotifications.length}
                  </Chip>
                </div>
                {safeFAQNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    variant={notification.seenAt ? "default" : "secondary"}
                  >
                    <Card.Content className="flex flex-col gap-4 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-secondary">
                            <MessageCircleQuestion className="h-6 w-6 text-accent" />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-foreground">
                                {notification.appName}
                              </p>
                              <Chip size="sm" color="accent" variant="soft" className="text-[10px] font-bold uppercase">
                                FAQ
                              </Chip>
                              {!notification.seenAt && (
                                <Chip size="sm" color="accent" variant="soft" className="text-[10px] font-bold uppercase">
                                  Neu
                                </Chip>
                              )}
                            </div>
                            <p className="text-sm font-medium text-foreground">
                              Neue Frage von {notification.questioner || "einem Nutzer"}
                            </p>
                            <p className="whitespace-pre-wrap text-sm text-muted">
                              {notification.question}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                              <span>{new Date(notification.createdAt).toLocaleString("de-DE")}</span>
                              <span>•</span>
                              <span>
                                {notification.answerCount} {notification.answerCount === 1 ? "Antwort" : "Antworten"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                          <Button
                            variant="secondary"
                            className="gap-2"
                            onPress={() => {
                              if (!notification.seenAt) {
                                void handleMarkFAQSeen(notification.id);
                              }
                              router.push(`/apps/${notification.appId}#faq`);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Frage öffnen
                          </Button>
                          {!notification.seenAt && (
                            <Button
                              variant="secondary"
                              className="gap-2"
                              isPending={updatingItemId === `faq:${notification.id}`}
                              onPress={() => void handleMarkFAQSeen(notification.id)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Gelesen
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card.Content>
                  </Card>
                ))}
              </section>
            )}
            {safeItems.map((item) => {
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
            })}
          </>
        )}
      </div>
    </div>
  );
}
