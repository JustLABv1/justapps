"use client";

import { ReleaseDiffViewer } from "@/components/ReleaseDiffViewer";
import { PageContainer, PageFilters, PageHeader } from "@/components/PageHeader";
import type { FAQAnswerNotification, FAQNotification, ReleaseInboxItem } from "@/config/apps";
import { useAuth } from "@/context/AuthContext";
import { useUpdates } from "@/context/UpdatesContext";
import {
    Accordion,
    Button,
    Card,
    Chip,
    Disclosure,
    Spinner,
    Switch,
    toast,
} from "@heroui/react";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  MessageCircleReply,
  MessageCircleQuestion,
  RefreshCw,
  Settings2,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getImageAssetUrl } from "../../lib/assets";

const UPDATES_PAGE_SIZE = 15;
type NotificationTypeFilter = "all" | "release" | "question" | "answer";

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
    loadFAQAnswerNotifications,
    markAsSeen,
    markAllAsSeen,
    markFAQAsSeen,
    markFAQAnswerAsSeen,
    refreshSummary,
    preferences,
    updatePreferences,
    loaded,
  } = useUpdates();
  const [items, setItems] = useState<ReleaseInboxItem[]>([]);
  const [faqNotifications, setFAQNotifications] = useState<FAQNotification[]>([]);
  const [faqAnswerNotifications, setFAQAnswerNotifications] = useState<FAQAnswerNotification[]>([]);
  const [pages, setPages] = useState({ releases: 1, questions: 1, answers: 1 });
  const [hasMore, setHasMore] = useState({ releases: false, questions: false, answers: false });
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [markingAllSeen, setMarkingAllSeen] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferencesExpanded, setPreferencesExpanded] = useState(false);
  const [notificationType, setNotificationType] = useState<NotificationTypeFilter>("all");
  const safeItems = Array.isArray(items) ? items : [];
  const safeFAQNotifications = Array.isArray(faqNotifications)
    ? faqNotifications
    : [];
  const safeFAQAnswerNotifications = Array.isArray(faqAnswerNotifications)
    ? faqAnswerNotifications
    : [];
  const hasUnreadItems = safeItems.some((item) => !item.seenAt)
    || safeFAQNotifications.some((item) => !item.seenAt)
    || safeFAQAnswerNotifications.some((item) => !item.seenAt);
  const showsReleases = notificationType === "all" || notificationType === "release";
  const showsQuestions = notificationType === "all" || notificationType === "question";
  const showsAnswers = notificationType === "all" || notificationType === "answer";
  const hasVisibleNotifications = (showsReleases && safeItems.length > 0)
    || (showsQuestions && safeFAQNotifications.length > 0)
    || (showsAnswers && safeFAQAnswerNotifications.length > 0);
  const hasMoreVisible = (showsReleases && hasMore.releases)
    || (showsQuestions && hasMore.questions)
    || (showsAnswers && hasMore.answers);
  const activePreferenceCount = preferences
    ? [preferences.notifyFavoritedApps, preferences.notifyRecentlyViewedApps, preferences.notifyOwnedManagedApps].filter(Boolean).length
    : 0;

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
        const [nextItems, nextFAQNotifications, nextFAQAnswerNotifications] = await Promise.all([
          loadInboxItems("all"),
          loadFAQNotifications("all"),
          loadFAQAnswerNotifications("all"),
        ]);
        setItems(nextItems.items);
        setFAQNotifications(nextFAQNotifications.items);
        setFAQAnswerNotifications(nextFAQAnswerNotifications.items);
        setPages({ releases: nextItems.page, questions: nextFAQNotifications.page, answers: nextFAQAnswerNotifications.page });
        setHasMore({ releases: nextItems.hasMore, questions: nextFAQNotifications.hasMore, answers: nextFAQAnswerNotifications.hasMore });
      } finally {
        setPageLoading(false);
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadFAQAnswerNotifications, loadFAQNotifications, loadInboxItems, user]);

  const handleRefresh = async () => {
    setPageLoading(true);
    try {
      await refreshSummary();
      const [nextItems, nextFAQNotifications, nextFAQAnswerNotifications] = await Promise.all([
        loadInboxItems("all"),
        loadFAQNotifications("all"),
        loadFAQAnswerNotifications("all"),
      ]);
      setItems(nextItems.items);
      setFAQNotifications(nextFAQNotifications.items);
      setFAQAnswerNotifications(nextFAQAnswerNotifications.items);
      setPages({ releases: nextItems.page, questions: nextFAQNotifications.page, answers: nextFAQAnswerNotifications.page });
      setHasMore({ releases: nextItems.hasMore, questions: nextFAQNotifications.hasMore, answers: nextFAQAnswerNotifications.hasMore });
    } finally {
      setPageLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMoreVisible) return;
    setLoadingMore(true);
    try {
      const [nextReleases, nextQuestions, nextAnswers] = await Promise.all([
        showsReleases && hasMore.releases ? loadInboxItems("all", pages.releases + 1, UPDATES_PAGE_SIZE) : null,
        showsQuestions && hasMore.questions ? loadFAQNotifications("all", pages.questions + 1, UPDATES_PAGE_SIZE) : null,
        showsAnswers && hasMore.answers ? loadFAQAnswerNotifications("all", pages.answers + 1, UPDATES_PAGE_SIZE) : null,
      ]);
      if (nextReleases) setItems((current) => [...current, ...nextReleases.items]);
      if (nextQuestions) setFAQNotifications((current) => [...current, ...nextQuestions.items]);
      if (nextAnswers) setFAQAnswerNotifications((current) => [...current, ...nextAnswers.items]);
      setPages((current) => ({
        releases: nextReleases?.page ?? current.releases,
        questions: nextQuestions?.page ?? current.questions,
        answers: nextAnswers?.page ?? current.answers,
      }));
      setHasMore((current) => ({
        releases: nextReleases?.hasMore ?? current.releases,
        questions: nextQuestions?.hasMore ?? current.questions,
        answers: nextAnswers?.hasMore ?? current.answers,
      }));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, hasMoreVisible, loadFAQAnswerNotifications, loadFAQNotifications, loadInboxItems, loadingMore, pages, showsAnswers, showsQuestions, showsReleases]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || pageLoading || !hasMoreVisible) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: "320px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreVisible, loadMore, pageLoading]);

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
      setFAQAnswerNotifications((current) =>
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

  const handleMarkFAQAnswerSeen = async (notificationId: string) => {
    setUpdatingItemId(`faq-answer:${notificationId}`);
    try {
      const ok = await markFAQAnswerAsSeen(notificationId);
      if (!ok) {
        toast.danger("Antwort-Benachrichtigung konnte nicht als gelesen markiert werden.");
        return;
      }
      setFAQAnswerNotifications((current) =>
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
    <PageContainer>
      <PageHeader
        eyebrow="Posteingang"
        title="Updates"
        description="Neue Releases und wichtige FAQ-Aktivitäten zu Ihren Apps und Fragen."
        actions={
          <>
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
          </>
        }
      />

      <PageFilters>
        <span className="text-sm font-medium text-foreground">Benachrichtigungstyp</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Benachrichtigungen nach Typ filtern">
          {([
            ["all", "Alle"],
            ["release", "Releases"],
            ["question", "FAQ-Fragen"],
            ["answer", "FAQ-Antworten"],
          ] as const).map(([value, label]) => (
            <Button key={value} size="sm" variant={notificationType === value ? "primary" : "secondary"} aria-pressed={notificationType === value} onPress={() => setNotificationType(value)}>
              {label}
            </Button>
          ))}
        </div>
      </PageFilters>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <Disclosure isExpanded={preferencesExpanded} onExpandedChange={setPreferencesExpanded}>
          <Disclosure.Heading>
            <Button
              slot="trigger"
              variant="ghost"
              className="h-auto w-full justify-between rounded-none px-4 py-3.5 text-left sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-secondary text-muted">
                  <Settings2 className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">Benachrichtigungseinstellungen</span>
                  <span className="block truncate text-xs font-normal text-muted">
                    {preferences ? `${activePreferenceCount} von 3 Release-Regeln aktiv` : "Einstellungen werden geladen"}
                  </span>
                </span>
              </span>
              <Disclosure.Indicator className="ml-2 shrink-0 text-muted" />
            </Button>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="border-t border-border px-4 py-4 sm:px-5">
              <p className="mb-4 text-sm text-muted">
                Steuern Sie, für welche App-Beziehungen neue Releases in Ihrem Posteingang auftauchen.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
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
              </div>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      </div>

      <div className="flex flex-col gap-4">
        {pageLoading ? (
          <div className="flex min-h-[20vh] flex-col items-center justify-center gap-3">
            <Spinner />
            <p className="text-sm text-muted">
              Updates und FAQ-Benachrichtigungen werden geladen...
            </p>
          </div>
        ) : !hasVisibleNotifications ? (
          <Card variant="default">
            <Card.Content className="flex flex-col items-center gap-3 py-12 text-center">
              <Bell className="h-8 w-8 text-muted" />
              <div>
                <p className="font-semibold text-foreground">
                  Keine Updates vorhanden
                </p>
                <p className="text-sm text-muted">
                  Sobald verfolgte Apps neue Releases veröffentlichen oder
                  neue FAQ-Aktivitäten entstehen, erscheinen sie hier.
                </p>
              </div>
            </Card.Content>
          </Card>
        ) : (
          <>
            {showsAnswers && safeFAQAnswerNotifications.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <MessageCircleReply className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Antworten auf Ihre Fragen
                  </h2>
                  <Chip size="sm" color="accent" variant="soft" className="text-[10px] font-bold">
                    {safeFAQAnswerNotifications.length}
                  </Chip>
                </div>
                {safeFAQAnswerNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    variant={notification.seenAt ? "default" : "secondary"}
                  >
                    <Card.Content className="flex flex-col gap-4 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-secondary">
                            <MessageCircleReply className="h-6 w-6 text-accent" />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-foreground">
                                {notification.scope === "global" ? "Globales FAQ" : notification.appName}
                              </p>
                              <Chip size="sm" color="accent" variant="soft" className="text-[10px] font-bold uppercase">
                                Neue Antwort
                              </Chip>
                              {!notification.seenAt && (
                                <Chip size="sm" color="accent" variant="soft" className="text-[10px] font-bold uppercase">
                                  Neu
                                </Chip>
                              )}
                            </div>
                            <p className="text-sm font-medium text-foreground">
                              {notification.answerer || "Ein Nutzer"} hat auf Ihre Frage geantwortet
                            </p>
                            <p className="line-clamp-2 text-sm text-muted">„{notification.question}“</p>
                            <p className="whitespace-pre-wrap text-sm text-foreground">{notification.answer}</p>
                            <span className="text-xs text-muted">
                              {new Date(notification.createdAt).toLocaleString("de-DE")}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                          <Button
                            variant="secondary"
                            className="gap-2"
                            onPress={() => {
                              if (!notification.seenAt) void handleMarkFAQAnswerSeen(notification.id);
                              router.push(notification.scope === "global" ? "/faq" : `/apps/${notification.appId}#faq`);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Antwort öffnen
                          </Button>
                          {!notification.seenAt && (
                            <Button
                              variant="secondary"
                              className="gap-2"
                              isPending={updatingItemId === `faq-answer:${notification.id}`}
                              onPress={() => void handleMarkFAQAnswerSeen(notification.id)}
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
            {showsQuestions && safeFAQNotifications.length > 0 && (
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
            {showsReleases && safeItems.map((item) => {
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
            {hasMoreVisible && (
              <div ref={loadMoreRef} className="flex min-h-16 items-center justify-center" aria-live="polite">
                {loadingMore && <Spinner size="sm" />}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
