"use client";

import { AREAS, RELEASE_TYPE } from "@/components/app-detail/ReleaseList";
import { ReleaseDiffViewer } from "@/components/ReleaseDiffViewer";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Spinner } from "@/components/panelui/spinner";
import { Tabs } from "@/components/panelui/tabs";
import { Tooltip } from "@/components/panelui/tooltip";
import type { FAQAnswerNotification, FAQNotification, ReleaseInboxItem } from "@/config/apps";
import { useAuth } from "@/context/AuthContext";
import { useUpdates } from "@/context/UpdatesContext";
import { getImageAssetUrl } from "@/lib/assets";
import { toast } from "@/lib/toast";
import { Bell, Check, CheckCheck, ChevronDown, MessageCircleQuestion, MessageCircleReply, Settings2 } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 15;
type Kind = "release" | "question" | "answer";
type Filter = "all" | Kind;

/** One inbox entry, whatever it is about, so the three kinds share one timeline. */
type Entry =
  | { kind: "release"; id: string; at: string; seen: boolean; item: ReleaseInboxItem }
  | { kind: "question"; id: string; at: string; seen: boolean; item: FAQNotification }
  | { kind: "answer"; id: string; at: string; seen: boolean; item: FAQAnswerNotification };

const REASONS: Record<string, string> = {
  favorite: "weil sie in deinen Favoriten ist",
  recently_viewed: "weil du sie kürzlich angesehen hast",
  owned: "weil du sie betreust",
};

const relative = new Intl.RelativeTimeFormat("de", { numeric: "auto" });
function timeAgo(value: string) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return "gerade eben";
}

/** Heute, Gestern, Diese Woche, Diesen Monat, Älter */
function dayGroup(value: string) {
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
  if (days <= 0) return "Heute";
  if (days === 1) return "Gestern";
  if (days < 7) return "Diese Woche";
  if (days < 31) return "Diesen Monat";
  return "Älter";
}

const hrefOf = (entry: Entry) => {
  if (entry.kind === "release") return `/apps/${entry.item.appId}#changelog`;
  if (entry.kind === "question") return `/apps/${entry.item.appId}?frage=${entry.item.questionId}#faq`;
  return entry.item.scope === "global" ? `/faq?frage=${entry.item.questionId}` : `/apps/${entry.item.appId}?frage=${entry.item.questionId}#faq`;
};

function EntryIcon({ entry }: { entry: Entry }) {
  if (entry.kind === "release") {
    const src = getImageAssetUrl(entry.item.appIcon);
    return (
      <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40 text-lg">
        {src ? <Image src={src} alt="" fill sizes="40px" className="object-contain p-1.5" unoptimized /> : entry.item.appIcon || entry.item.appName.charAt(0)}
      </span>
    );
  }
  const Icon = entry.kind === "question" ? MessageCircleQuestion : MessageCircleReply;
  return (
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${entry.kind === "answer" ? "bg-success/12 text-success" : "bg-info/12 text-info"}`}>
      <Icon className="size-5" />
    </span>
  );
}

function ReleaseDetails({ item }: { item: ReleaseInboxItem }) {
  const [open, setOpen] = useState(false);
  if (item.changeDetails.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" size="sm" className="-ms-3 w-fit" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Änderungen ausblenden" : `Geändert: ${item.changeDetails.map((detail) => detail.label).join(", ")}`}
      </Button>
      {open && item.changeDetails.map((detail) => <ReleaseDiffViewer key={`${detail.area}-${detail.field}`} detail={detail} />)}
    </div>
  );
}

function EntryRow({ entry, onOpen, onMarkSeen, pending }: { entry: Entry; onOpen: () => void; onMarkSeen: () => void; pending: boolean }) {
  let title: ReactNode;
  let body: ReactNode;
  let meta: ReactNode;
  if (entry.kind === "release") {
    const { item } = entry;
    const type = RELEASE_TYPE[item.releaseType] ?? { label: item.releaseType, variant: "secondary" as const };
    title = (
      <>
        <span className="font-medium">{item.appName}</span>
        <span className="font-mono text-xs text-muted-foreground">v{item.version}</span>
        <Badge variant={type.variant} size="sm">{type.label}</Badge>
      </>
    );
    body = (
      <>
        <p className="text-sm">{item.title}</p>
        {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
        {item.changedAreas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {item.changedAreas.map((area) => <Badge key={area} variant="outline" size="sm">{AREAS[area]?.icon}{AREAS[area]?.label ?? area}</Badge>)}
          </div>
        )}
      </>
    );
    meta = REASONS[item.reason] ? `Du siehst das, ${REASONS[item.reason]}.` : null;
  } else if (entry.kind === "question") {
    const { item } = entry;
    title = (
      <>
        <span className="font-medium">Neue Frage zu {item.appName}</span>
        {item.answerCount === 0 ? <Badge variant="warning" size="sm">Antwort gesucht</Badge> : <span className="text-xs text-muted-foreground">{item.answerCount} {item.answerCount === 1 ? "Antwort" : "Antworten"}</span>}
      </>
    );
    body = <p className="line-clamp-2 text-sm text-muted-foreground"><span className="text-foreground">{item.questioner || "Jemand"}</span> fragt: „{item.question}“</p>;
  } else {
    const { item } = entry;
    title = <span className="font-medium">{item.answerer || "Jemand"} hat deine Frage beantwortet</span>;
    body = (
      <>
        <p className="line-clamp-1 text-sm text-muted-foreground">„{item.question}“ · {item.scope === "global" ? "Allgemein" : item.appName}</p>
        <p className="line-clamp-2 border-s-2 ps-3 text-sm">{item.answer}</p>
      </>
    );
  }

  return (
    <li className={`group relative flex gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:px-5 ${entry.seen ? "" : "bg-info/[0.04]"}`}>
      <span aria-hidden="true" className={`mt-4 size-2 shrink-0 rounded-full ${entry.seen ? "bg-transparent" : "bg-info"}`} />
      <EntryIcon entry={entry} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {title}
          {!entry.seen && <span className="sr-only">(ungelesen)</span>}
        </div>
        {body}
        <p className="pt-0.5 text-xs text-muted-foreground">
          <time dateTime={entry.at} title={new Date(entry.at).toLocaleString("de-DE")}>{timeAgo(entry.at)}</time>
          {meta && <> · {meta}</>}
        </p>
        {entry.kind === "release" && <ReleaseDetails item={entry.item} />}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {!entry.seen && (
          <Tooltip>
            <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" loading={pending} aria-label="Als gelesen markieren" onClick={onMarkSeen} />}>
              <Check />
            </Tooltip.Trigger>
            <Tooltip.Content>Als gelesen markieren</Tooltip.Content>
          </Tooltip>
        )}
        <Button variant="outline" size="sm" render={<NextLink href={hrefOf(entry)} onClick={onOpen} />}>
          Öffnen
        </Button>
      </div>
    </li>
  );
}

export default function UpdatesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    loadInboxItems, loadFAQNotifications, loadFAQAnswerNotifications,
    markAsSeen, markAllAsSeen, markFAQAsSeen, markFAQAnswerAsSeen, refreshSummary,
  } = useUpdates();
  const [releases, setReleases] = useState<ReleaseInboxItem[]>([]);
  const [questions, setQuestions] = useState<FAQNotification[]>([]);
  const [answers, setAnswers] = useState<FAQAnswerNotification[]>([]);
  const [pages, setPages] = useState({ release: 1, question: 1, answer: 1 });
  const [hasMore, setHasMore] = useState({ release: false, question: false, answer: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/");
  }, [authLoading, router, user]);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const [r, q, a] = await Promise.all([loadInboxItems("all"), loadFAQNotifications("all"), loadFAQAnswerNotifications("all")]);
      setReleases(r.items);
      setQuestions(q.items);
      setAnswers(a.items);
      setPages({ release: r.page, question: q.page, answer: a.page });
      setHasMore({ release: r.hasMore, question: q.hasMore, answer: a.hasMore });
    } finally {
      setLoading(false);
    }
  }, [loadFAQAnswerNotifications, loadFAQNotifications, loadInboxItems]);

  useEffect(() => {
    if (!user) return;
    const timeout = window.setTimeout(() => void loadFirst(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadFirst, user]);

  // New entries arrive while the page is open in another tab; reload when it is looked at again.
  const lastRefresh = useRef(0);
  const refreshSummaryRef = useRef(refreshSummary);
  useEffect(() => {
    refreshSummaryRef.current = refreshSummary;
  });
  useEffect(() => {
    if (!user) return;
    lastRefresh.current = Date.now();
    const onFocus = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh.current < 60_000) return;
      lastRefresh.current = Date.now();
      void refreshSummaryRef.current().then(loadFirst);
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [loadFirst, user]);

  const shows = (kind: Kind) => filter === "all" || filter === kind;
  const moreAvailable = (["release", "question", "answer"] as const).some((kind) => shows(kind) && hasMore[kind]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !moreAvailable) return;
    setLoadingMore(true);
    try {
      const want = (kind: Kind) => (filter === "all" || filter === kind) && hasMore[kind];
      const [r, q, a] = await Promise.all([
        want("release") ? loadInboxItems("all", pages.release + 1, PAGE_SIZE) : null,
        want("question") ? loadFAQNotifications("all", pages.question + 1, PAGE_SIZE) : null,
        want("answer") ? loadFAQAnswerNotifications("all", pages.answer + 1, PAGE_SIZE) : null,
      ]);
      if (r) setReleases((current) => [...current, ...r.items]);
      if (q) setQuestions((current) => [...current, ...q.items]);
      if (a) setAnswers((current) => [...current, ...a.items]);
      setPages((current) => ({ release: r?.page ?? current.release, question: q?.page ?? current.question, answer: a?.page ?? current.answer }));
      setHasMore((current) => ({ release: r?.hasMore ?? current.release, question: q?.hasMore ?? current.question, answer: a?.hasMore ?? current.answer }));
    } finally {
      setLoadingMore(false);
    }
  }, [filter, hasMore, loadFAQAnswerNotifications, loadFAQNotifications, loadInboxItems, loadingMore, moreAvailable, pages]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loading || !moreAvailable) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: "320px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, loading, moreAvailable]);

  const entries = useMemo<Entry[]>(() => [
    ...releases.map((item) => ({ kind: "release" as const, id: item.id, at: item.publishedAt, seen: !!item.seenAt, item })),
    ...questions.map((item) => ({ kind: "question" as const, id: item.id, at: item.createdAt, seen: !!item.seenAt, item })),
    ...answers.map((item) => ({ kind: "answer" as const, id: item.id, at: item.createdAt, seen: !!item.seenAt, item })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [releases, questions, answers]);

  const unread = (kind?: Kind) => entries.filter((entry) => !entry.seen && (!kind || entry.kind === kind)).length;
  const visible = entries.filter((entry) => shows(entry.kind) && (!unreadOnly || !entry.seen));
  const groups = visible.reduce<{ label: string; entries: Entry[] }[]>((list, entry) => {
    const label = dayGroup(entry.at);
    const last = list[list.length - 1];
    if (last?.label === label) last.entries.push(entry);
    else list.push({ label, entries: [entry] });
    return list;
  }, []);

  const markSeen = async (entry: Entry, quiet = false) => {
    if (entry.seen) return;
    setPendingId(entry.id);
    try {
      const ok = entry.kind === "release" ? await markAsSeen(entry.id) : entry.kind === "question" ? await markFAQAsSeen(entry.id) : await markFAQAnswerAsSeen(entry.id);
      if (!ok) {
        if (!quiet) toast.danger("Konnte nicht als gelesen markiert werden.");
        return;
      }
      const seenAt = new Date().toISOString();
      const mark = <T extends { id: string; seenAt?: string | null }>(list: T[]) => list.map((item) => (item.id === entry.id ? { ...item, seenAt } : item));
      if (entry.kind === "release") setReleases(mark);
      else if (entry.kind === "question") setQuestions(mark);
      else setAnswers(mark);
    } finally {
      setPendingId(null);
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      if (!(await markAllAsSeen())) {
        toast.danger("Die Updates konnten nicht als gelesen markiert werden.");
        return;
      }
      const seenAt = new Date().toISOString();
      setReleases((list) => list.map((item) => ({ ...item, seenAt })));
      setQuestions((list) => list.map((item) => ({ ...item, seenAt })));
      setAnswers((list) => list.map((item) => ({ ...item, seenAt })));
      toast.success("Alles als gelesen markiert.");
    } finally {
      setMarkingAll(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-muted-foreground">
        <Spinner />
        Updates werden geladen …
      </div>
    );
  }

  const totalUnread = unread();

  return (
    <div className="flex w-full flex-col gap-6 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Updates</h1>
          <p className="text-muted-foreground">
            {totalUnread > 0 ? `${totalUnread} ungelesen. ` : "Alles gelesen. "}
            Neue Versionen deiner Apps und Neuigkeiten zu Fragen.
          </p>
        </div>
        <Button variant="outline" render={<NextLink href="/profil#benachrichtigungen" />}>
          <Settings2 />
          Einstellungen
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <Tabs.List aria-label="Updates filtern">
            <Tabs.Trigger value="all">Alle{totalUnread > 0 && <Tabs.Badge>{totalUnread}</Tabs.Badge>}</Tabs.Trigger>
            <Tabs.Trigger value="release">Versionen{unread("release") > 0 && <Tabs.Badge>{unread("release")}</Tabs.Badge>}</Tabs.Trigger>
            <Tabs.Trigger value="question">Fragen{unread("question") > 0 && <Tabs.Badge>{unread("question")}</Tabs.Badge>}</Tabs.Trigger>
            <Tabs.Trigger value="answer">Antworten{unread("answer") > 0 && <Tabs.Badge>{unread("answer")}</Tabs.Badge>}</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
        <Button variant={unreadOnly ? "secondary" : "ghost"} size="sm" shape="pill" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(!unreadOnly)}>
          <span aria-hidden="true" className={`size-2 rounded-full ${unreadOnly ? "bg-info" : "border border-muted-foreground/60"}`} />
          Nur ungelesene
        </Button>
        <Button variant="ghost" size="sm" className="ms-auto" disabled={totalUnread === 0} loading={markingAll} onClick={() => void markAll()}>
          <CheckCheck />
          Alle als gelesen markieren
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
          <Spinner />
          Updates werden geladen …
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-16 text-center">
          <Bell className="size-7 text-muted-foreground/50" />
          <p className="font-medium">{unreadOnly && entries.length > 0 ? "Nichts Ungelesenes" : "Noch keine Updates"}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {unreadOnly && entries.length > 0
              ? "Du bist auf dem neuesten Stand."
              : "Sobald Apps, denen du folgst, neue Versionen bekommen oder es Neues zu Fragen gibt, erscheint es hier. Folgen kannst du einer App mit dem Herz."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label} className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {group.entries.map((entry) => (
                  <EntryRow
                    key={`${entry.kind}-${entry.id}`}
                    entry={entry}
                    pending={pendingId === entry.id}
                    onMarkSeen={() => void markSeen(entry)}
                    onOpen={() => void markSeen(entry, true)}
                  />
                ))}
              </ul>
            </section>
          ))}
          {moreAvailable && (
            <div ref={loadMoreRef} className="flex min-h-16 items-center justify-center" aria-live="polite">
              {loadingMore && <Spinner />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
