"use client";

import { DeploymentAssistant } from "@/components/DeploymentAssistant";
import { FavoriteButton } from "@/components/FavoriteButton";
import { FAQSection } from "@/components/FAQSection";
import { GitHubIcon } from "@/components/GitHubIcon";
import { LinkStatusDot } from "@/components/LinkStatusDot";
import { RatingSection } from "@/components/RatingSection";
import { Alert } from "@/components/panelui/alert";
import { Badge, type BadgeVariant } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Menu } from "@/components/panelui/menu";
import { Spinner } from "@/components/panelui/spinner";
import { TableOfContents } from "@/components/panelui/table-of-contents";
import { Tabs } from "@/components/panelui/tabs";
import { AppConfig, AppRelease, GitLabIntegrationState } from "@/config/apps";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { fetchApi } from "@/lib/api";
import { getAppBannerMeta } from "@/lib/appBanner";
import { APP_MATURITY_DESCRIPTIONS, APP_STATUS_OPTIONS, DRAFT_STATUS, getAppStatusMeta, isDraftStatus } from "@/lib/appStatus";
import { getImageAssetUrl } from "@/lib/assets";
import { resolveIcon } from "@/lib/detailFieldIcons";
import { hasPermission, Permission } from "@/lib/permissions";
import { addRecentlyViewed } from "@/lib/recentlyViewed";
import { toast } from "@/lib/toast";
import {
  ArrowLeft, BookOpen, ChevronDown, ExternalLink, GitBranch, History, Link2, ListTree, MessageCircleQuestion, Pencil, Recycle, Server, Share2, Star,
} from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { extractHeadings } from "./headings";
import { docComponents, stripLeadingTitle } from "./markdown";
import { ReleaseList } from "./ReleaseList";

type TabId = "docs" | "deployment" | "ratings" | "faq" | "changelog";
const TAB_IDS: TabId[] = ["docs", "deployment", "ratings", "faq", "changelog"];

const STATUS_VARIANT: Record<string, BadgeVariant> = { default: "secondary", accent: "info", success: "success", warning: "warning" };

interface LinkItem {
  label: string;
  url: string;
  icon: ReactNode;
  status?: ReactNode;
}

function initialTab(): TabId {
  if (typeof window === "undefined") return "docs";
  const hash = window.location.hash.slice(1) as TabId;
  return TAB_IDS.includes(hash) ? hash : "docs";
}

function AppLogo({ icon, name, small = false }: { icon?: string; name: string; small?: boolean }) {
  const src = getImageAssetUrl(icon);
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border bg-card ${small ? "size-8 rounded-lg text-lg" : "size-16 rounded-2xl text-4xl shadow-xs sm:size-20 sm:text-5xl"}`}
    >
      {src ? <Image src={src} alt={small ? "" : name} fill sizes={small ? "32px" : "80px"} className={`object-contain ${small ? "p-1" : "p-2"}`} unoptimized /> : icon || "🏛️"}
    </div>
  );
}

const LICENSES: Record<string, string> = {
  custom: "Eigene Lizenz",
  proprietary: "Proprietär",
  "apache-2.0": "Apache 2.0",
  mit: "MIT",
  "eupl-1.2": "EUPL 1.2",
  "eupl-1.1": "EUPL 1.1",
  "gpl-2.0": "GPL 2.0",
  "gpl-3.0": "GPL 3.0",
  "agpl-3.0": "AGPL 3.0",
  "lgpl-3.0": "LGPL 3.0",
  "mpl-2.0": "MPL 2.0",
  "bsd-2-clause": "BSD 2-Clause",
  "bsd-3-clause": "BSD 3-Clause",
};
const licenseLabel = (license: string) => LICENSES[license.trim().toLowerCase().replace(/-only$|-or-later$/, "")] || license;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/\S+$/i;

/** A detail value as a link when it is an address or a URL. */
function FactValue({ value }: { value: string }) {
  const trimmed = value.trim();
  if (EMAIL.test(trimmed)) return <a href={`mailto:${trimmed}`} className="underline-offset-4 hover:underline">{trimmed}</a>;
  if (URL_PATTERN.test(trimmed)) {
    return <a href={trimmed} target="_blank" rel="noreferrer noopener" className="underline-offset-4 hover:underline">{hostOf(trimmed) || trimmed}</a>;
  }
  return <>{trimmed}</>;
}

/** One labelled block of the side panel. */
function Aside({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t py-5 first:border-t-0 first:pt-0 last:pb-0">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

/** A label and its value; a long value goes under its label instead of being squeezed beside it. */
function Fact({ label, children, long = false }: { label: string; children: ReactNode; long?: boolean }) {
  return long ? (
    <div className="flex flex-col gap-0.5 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  ) : (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
const MATURITY_LEVELS = APP_STATUS_OPTIONS.filter((status) => status !== DRAFT_STATUS);

const PROBE_TEXT: Record<string, { label: string; dot: string }> = {
  ok: { label: "Erreichbar", dot: "bg-success" },
  partial: { label: "Teilweise erreichbar", dot: "bg-warning" },
  down: { label: "Nicht erreichbar", dot: "bg-destructive" },
  unknown: { label: "Noch nicht geprüft", dot: "bg-muted-foreground/40" },
};

/** The theme colour of each maturity level, the same one its badge uses. */
const LEVEL_BG: Record<string, string> = { default: "bg-muted-foreground/60", accent: "bg-info", warning: "bg-warning", success: "bg-success" };
const LEVEL_TEXT: Record<string, string> = { default: "text-foreground", accent: "text-info", warning: "text-warning", success: "text-success" };

/** Where the app is on the way from proof of concept to established, as a row of segments. */
function Maturity({ label }: { label: string }) {
  const level = MATURITY_LEVELS.indexOf(label as (typeof MATURITY_LEVELS)[number]);
  return (
    <div className="flex flex-col gap-2 pb-2">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Reifegrad</span>
        <span className={`font-medium ${LEVEL_TEXT[getAppStatusMeta(label)?.color ?? "default"]}`}>{label}</span>
      </div>
      {level >= 0 && (
        <div
          role="meter"
          aria-label="Reifegrad"
          aria-valuemin={1}
          aria-valuemax={MATURITY_LEVELS.length}
          aria-valuenow={level + 1}
          aria-valuetext={`${label}, Stufe ${level + 1} von ${MATURITY_LEVELS.length}`}
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${MATURITY_LEVELS.length}, minmax(0, 1fr))` }}
        >
          {MATURITY_LEVELS.map((status, index) => (
            <span
              key={status}
              title={status}
              className={`h-1.5 rounded-full ${index <= level ? LEVEL_BG[getAppStatusMeta(status)?.color ?? "default"] : "bg-muted"}`}
            />
          ))}
        </div>
      )}
      {APP_MATURITY_DESCRIPTIONS[label] && <p className="text-xs text-muted-foreground">{APP_MATURITY_DESCRIPTIONS[label]}</p>}
    </div>
  );
}

const isLong = (label: string, value: string) => label.length + value.length > 28 || EMAIL.test(value.trim()) || URL_PATTERN.test(value.trim());

export function AppDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [app, setApp] = useState<AppConfig | null>(null);
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [integration, setIntegration] = useState<GitLabIntegrationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>(initialTab);
  const tabsRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const docs = useMemo(() => stripLeadingTitle(app?.markdownContent || ""), [app?.markdownContent]);
  const headings = useMemo(() => {
    const seen = new Set<string>();
    return extractHeadings(docs).filter((item) => !seen.has(item.id) && !!seen.add(item.id));
  }, [docs]);

  // The compact bar takes over once the header has scrolled under the navigation.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0), {
      rootMargin: "-56px 0px 0px 0px",
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, [loading]);

  const changeTab = (value: TabId) => {
    setTab(value);
    window.history.replaceState(null, "", `#${value}`);
  };
  const openTab = (value: TabId) => {
    changeTab(value);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([
      fetchApi(`/apps/${id}`, { cache: "no-store" }),
      fetchApi(`/apps/${id}/repository`, { cache: "no-store" }),
      fetchApi(`/apps/${id}/releases`, { cache: "no-store" }),
    ])
      .then(async ([appResponse, repoResponse, releaseResponse]) => {
        if (!active) return;
        if (!appResponse.ok) {
          setApp(null);
          return;
        }
        const data = await appResponse.json() as AppConfig;
        setApp(data);
        addRecentlyViewed({ id: data.id, name: data.name, icon: data.icon });
        const releaseData = releaseResponse.ok ? await releaseResponse.json() as AppRelease[] : [];
        setReleases(Array.isArray(releaseData) ? releaseData : []);
        const repoData = repoResponse.ok ? await repoResponse.json() as GitLabIntegrationState : null;
        setIntegration(repoData?.linked ? repoData : null);
      })
      .catch((error) => {
        console.error(error);
        if (active) setApp(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!user || !app?.id) return;
    const timeout = window.setTimeout(() => {
      void fetchApi("/user/recently-viewed", { method: "POST", body: JSON.stringify({ appId: app.id }) }).catch(() => {});
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [app?.id, user]);

  // Old links pointed at tabs that now live elsewhere on the page.
  useEffect(() => {
    if (loading || !app) return;
    const hash = window.location.hash.slice(1);
    if (hash === "related" || hash === "details") document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, [loading, app]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
        <Spinner />
        App wird geladen …
      </div>
    );
  }
  if (!app) return notFound();

  const isAdmin = user?.role === "admin";
  const canEditApps = hasPermission(user?.role, Permission.EditApps, user?.permissions);
  const isOwner = !!user?.id && (app.ownerId === user.id || app.owner?.id === user.id);
  if (isDraftStatus(app.status) && !isOwner && !hasPermission(user?.role, Permission.ViewAppDrafts, user?.permissions)) return notFound();

  const draft = isDraftStatus(app.status);
  const statusInfo = getAppStatusMeta(app.status);
  const hasRating = (app.ratingCount ?? 0) > 0;
  const probeEnabled = settings.enableLinkProbing && !app.skipLinkProbe;
  const editHref = isAdmin ? `/verwaltung/katalog/apps/${app.id}/edit` : `/meine-apps/${app.id}/edit`;

  // ── Links ──
  const demos = app.liveDemos?.length ? app.liveDemos : app.liveUrl ? [{ label: "Live-Zugang", url: app.liveUrl }] : [];
  const repositories = app.repositories?.length ? app.repositories : app.repoUrl ? [{ label: "Quellcode", url: app.repoUrl }] : [];
  const providerLabel = integration?.providerLabel || (integration?.providerType === "github" ? "GitHub" : integration?.providerType === "gitlab" ? "GitLab" : "Repository");
  const integrationUrl = integration?.projectWebUrl?.trim();
  const links: LinkItem[] = [
    ...repositories.map((repo) => ({ label: repo.label || "Quellcode", url: repo.url, icon: <GitHubIcon className="size-4" /> })),
    ...(integrationUrl && !repositories.some((repo) => repo.url === integrationUrl) ? [{ label: providerLabel, url: integrationUrl, icon: <GitBranch className="size-4" /> }] : []),
    ...(app.docsUrl ? [{ label: "Dokumentation", url: app.docsUrl, icon: <BookOpen className="size-4" /> }] : []),
    ...(app.customLinks || []).map((link) => ({ label: link.label || "Link", url: link.url, icon: <Link2 className="size-4" /> })),
  ];

  // ── Facts ──
  const fieldValues = new Map((app.customFields ?? []).map((field) => [field.key, field.value]));
  const detailFields = (settings.detailFields ?? [])
    .map((definition) => ({ label: definition.label, value: fieldValues.get(definition.key), icon: resolveIcon(definition.icon) }))
    .filter((field) => field.value);

  // ── Tabs ──
  const showDeployment = app.hasDeploymentAssistant !== false && (app.showHelm !== false || app.showCompose !== false || app.showDocker !== false);
  const showChangelog = releases.length > 0 || !!app.changelog;
  const available: Record<TabId, boolean> = { docs: true, deployment: showDeployment, ratings: true, faq: !!settings.faqEnabled, changelog: showChangelog };
  const currentTab = available[tab] ? tab : "docs";

  // ── Markdown links resolve against the linked repository ──
  const markdownRepositoryUrl = integrationUrl || integration?.snapshot?.projectWebUrl?.trim() || repositories.map((repo) => repo.url?.trim()).find(Boolean);
  const markdownRepository = {
    providerType: integration?.providerType || (markdownRepositoryUrl?.toLowerCase().includes("github.com") ? "github" : "gitlab"),
    projectWebUrl: markdownRepositoryUrl,
    branch: integration?.branch || integration?.snapshot?.defaultBranch,
    readmePath: integration?.readmePath || integration?.snapshot?.readmePath,
  };
  const markdownComponents = docComponents(markdownRepository);

  const share = () => {
    void navigator.clipboard.writeText(window.location.href);
    toast.success("Link kopiert.");
  };

  const openActions = (size: "sm" | "md") => (
    <>
      {demos.length === 1 && (
        <Button size={size} render={<a href={demos[0].url} target="_blank" rel="noreferrer noopener" />}>
          <ExternalLink />
          {demos[0].label || "Öffnen"}
          {probeEnabled && <LinkStatusDot status={app.linkProbeStatus} />}
        </Button>
      )}
      {demos.length > 1 && (
        <Menu>
          <Menu.Trigger render={<Button size={size} />}>
            <ExternalLink />
            Öffnen
            {probeEnabled && <LinkStatusDot status={app.linkProbeStatus} />}
            <ChevronDown />
          </Menu.Trigger>
          <Menu.Content align={size === "sm" ? "end" : "start"}>
            {demos.map((demo, index) => (
              <Menu.Item key={`${demo.url}-${index}`} onClick={() => window.open(demo.url, "_blank", "noopener,noreferrer")}>
                <ExternalLink />
                {demo.label || demo.url}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu>
      )}
      {showDeployment && (
        <Button size={size} variant={demos.length ? "outline" : "default"} className={size === "sm" && demos.length ? "max-sm:hidden" : undefined} onClick={() => openTab("deployment")}>
          <Server />
          Installieren
        </Button>
      )}
    </>
  );

  const showToc = currentTab === "docs" && headings.length >= 3;

  const tabItems: { id: TabId; label: string; icon: ReactNode; count?: number }[] = [
    { id: "docs", label: "Dokumentation", icon: <BookOpen /> },
    ...(showDeployment ? [{ id: "deployment" as const, label: "Installation", icon: <Server /> }] : []),
    { id: "ratings", label: "Bewertungen", icon: <Star />, count: hasRating ? app.ratingCount : undefined },
    ...(settings.faqEnabled ? [{ id: "faq" as const, label: "FAQ", icon: <MessageCircleQuestion /> }] : []),
    ...(showChangelog ? [{ id: "changelog" as const, label: "Änderungen", icon: <History />, count: releases.length || undefined }] : []),
  ];

  const banner = app.bannerText ? getAppBannerMeta((app.bannerType as "info" | "warning" | "danger" | "custom") || "info", app.bannerColor) : null;

  const glanceTop = (
    <>
      {probeEnabled && demos.length > 0 && (
        <Aside title="Live-Zugang">
          <p className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className={`size-2 rounded-full ${PROBE_TEXT[app.linkProbeStatus || "unknown"]?.dot ?? PROBE_TEXT.unknown.dot}`} />
            {PROBE_TEXT[app.linkProbeStatus || "unknown"]?.label ?? PROBE_TEXT.unknown.label}
            {demos.length > 1 && app.linkProbeStatus !== "unknown" && <span className="text-muted-foreground">· {demos.length} Endpunkte</span>}
          </p>
        </Aside>
      )}
      {links.length > 0 && (
        <Aside title="Links">
          <ul className="-mx-2 flex flex-col">
            {links.map((link, index) => (
              <li key={`${link.url}-${index}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <span className="text-muted-foreground">{link.icon}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{link.label}</span>
                    {hostOf(link.url) && <span className="truncate text-xs text-muted-foreground">{hostOf(link.url)}</span>}
                  </span>
                  <ExternalLink className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ul>
        </Aside>
      )}
    </>
  );
  const glanceRest = (
    <>
      <Aside title="Details">
        <dl id="details" className="flex scroll-mt-24 flex-col">
          {statusInfo && (draft ? <Fact label="Status">{statusInfo.label}</Fact> : <Maturity label={statusInfo.label} />)}
          {app.version && <Fact label="Version"><span className="font-mono">v{app.version}</span></Fact>}
          {app.license && <Fact label="Lizenz" long={isLong("Lizenz", licenseLabel(app.license))}>{licenseLabel(app.license)}</Fact>}
          {app.authority && <Fact label="Herausgeber" long={isLong("Herausgeber", app.authority)}>{app.authority}</Fact>}
          {detailFields.map((field) => (
            <Fact key={field.label} label={field.label} long={isLong(field.label, String(field.value))}>
              <FactValue value={String(field.value)} />
            </Fact>
          ))}
          {app.updatedAt && <Fact label="Aktualisiert">{new Date(app.updatedAt).toLocaleDateString("de-DE")}</Fact>}
        </dl>
      </Aside>

      {app.techStack && app.techStack.length > 0 && (
        <Aside title="Technik">
          <div className="flex flex-wrap gap-1.5">
            {app.techStack.map((tech) => <Badge key={tech} variant="outline">{tech}</Badge>)}
          </div>
        </Aside>
      )}

      {app.tags && app.tags.length > 0 && (
        <Aside title="Schlagwörter">
          <div className="flex flex-wrap gap-1.5">
            {app.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
          </div>
        </Aside>
      )}

      {app.appGroups && app.appGroups.length > 0 && (
        <Aside title="Gruppen">
          <div className="flex flex-wrap gap-1.5">
            {app.appGroups.map((group) => <Badge key={group.id} variant="secondary">{group.name}</Badge>)}
          </div>
        </Aside>
      )}

      {integration?.linked && (
        <Aside title="Quelle">
          <p className="text-sm break-words">
            {integration.providerLabel || integration.providerKey} · <span className="font-mono text-[0.8125rem]">{integration.projectPath}</span>
          </p>
          {integration.lastSyncedAt && (
            <p className="text-xs text-muted-foreground">
              Zuletzt synchronisiert am {new Date(integration.lastSyncedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
              {integration.lastSyncStatus === "warning" && " · mit Hinweisen"}
              {integration.lastSyncStatus === "pending_approval" && " · wartet auf Freigabe"}
              {integration.lastSyncStatus === "error" && " · fehlgeschlagen"}
            </p>
          )}
        </Aside>
      )}
    </>
  );
  const hasGlanceTop = (probeEnabled && demos.length > 0) || links.length > 0;

  return (
    <div className="flex w-full flex-col gap-8 pb-20">
      {/* ── Compact bar, once the header has scrolled away ── */}
      <div
        inert={!compact}
        aria-hidden={!compact}
        className={`fixed inset-x-0 top-14 z-30 border-b bg-background/85 backdrop-blur-md transition-[opacity,translate] duration-200 motion-reduce:transition-none ${compact ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <AppLogo icon={app.icon} name={app.name} small />
          <span className="min-w-0 truncate font-medium">{app.name}</span>
          {statusInfo && !draft && <Badge variant={STATUS_VARIANT[statusInfo.color] ?? "secondary"} size="sm" dot className="hidden sm:inline-flex xl:hidden">{statusInfo.label}</Badge>}
          <nav aria-label="Bereiche der App" className="ms-4 hidden items-center gap-0.5 lg:flex">
            {tabItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                aria-current={currentTab === item.id ? "page" : undefined}
                className={currentTab === item.id ? "bg-muted" : "text-muted-foreground"}
                onClick={() => openTab(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </nav>
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <FavoriteButton appId={app.id} className="max-sm:hidden" />
            {openActions("sm")}
          </div>
        </div>
      </div>

      {/* ── Top row ── */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="-ms-3" render={<NextLink href="/" />}>
          <ArrowLeft />
          Katalog
        </Button>
        <div className="flex items-center gap-2">
          <FavoriteButton appId={app.id} />
          <Button variant="ghost" size="sm" onClick={share}>
            <Share2 />
            <span className="hidden sm:inline">Teilen</span>
          </Button>
          {(isAdmin || canEditApps || isOwner) && (
            <Button variant="outline" size="sm" render={<NextLink href={editHref} />}>
              <Pencil />
              Bearbeiten
            </Button>
          )}
        </div>
      </div>

      {/* ── Header ── */}
      <header ref={headerRef} className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <AppLogo icon={app.icon} name={app.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">{app.name}</h1>
              {statusInfo && (
                <Badge variant={draft ? "secondary" : STATUS_VARIANT[statusInfo.color] ?? "secondary"} dot={!draft}>
                  {statusInfo.label}
                </Badge>
              )}
              {app.spaceId && <Badge variant="outline" render={<NextLink href="/spaces" />}>Privater Space</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {app.authority && <span>{app.authority}</span>}
              {app.authority && app.categories?.length ? <span aria-hidden="true">·</span> : null}
              {app.categories?.length ? <span>{app.categories.join(", ")}</span> : null}
              {(app.authority || app.categories?.length) ? <span aria-hidden="true">·</span> : null}
              {hasRating ? (
                <button type="button" onClick={() => openTab("ratings")} className="inline-flex cursor-pointer items-center gap-1 rounded hover:text-foreground">
                  <Star className="size-3.5 fill-gov-gold text-gov-gold" />
                  <span className="font-medium text-foreground tabular-nums">{(app.ratingAvg || 0).toFixed(1).replace(".", ",")}</span>
                  <span>({app.ratingCount})</span>
                </button>
              ) : (
                <span>Noch keine Bewertung</span>
              )}
              {user && (
                <button type="button" onClick={() => openTab("ratings")} className="cursor-pointer rounded font-medium text-foreground underline-offset-4 hover:underline">
                  Bewerten
                </button>
              )}
            </div>
          </div>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">{app.description}</p>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {openActions("md")}
            {app.isReuse && (
              <Badge variant="warning" size="lg">
                <Recycle />
                Nachnutzung möglich
              </Badge>
            )}
          </div>
        </div>
      </header>

      {banner && (
        banner.customStyle ? (
          <div className="flex items-start gap-3 rounded-xl border px-4 py-3" style={banner.customStyle}>
            <banner.Icon className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-0.5 text-sm">
              <p className="font-medium">{app.bannerTitle || banner.label}</p>
              <p className="opacity-80">{app.bannerText}</p>
            </div>
          </div>
        ) : (
          <Alert variant="plain" tone={app.bannerType === "danger" ? "destructive" : app.bannerType === "warning" ? "warning" : "info"}>
            <Alert.Icon />
            <Alert.Title>{app.bannerTitle || banner.label}</Alert.Title>
            <Alert.Description>{app.bannerText}</Alert.Description>
          </Alert>
        )
      )}

      {/* On small screens the links come before the content and the details after it. */}
      {hasGlanceTop && (
        <section aria-label="Zugang und Links" className="flex flex-col rounded-2xl border bg-card p-5 lg:hidden">
          {glanceTop}
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* ── Main ── */}
        <div ref={tabsRef} className="min-w-0 scroll-mt-24">
          <Tabs variant="segmented" value={currentTab} onValueChange={(value) => changeTab(value as TabId)}>
            <Tabs.List aria-label="Bereiche der App">
              {tabItems.map((item) => (
                <Tabs.Trigger key={item.id} value={item.id} className="max-sm:[&>svg]:hidden">
                  {item.icon}
                  {item.label}
                  {item.count ? <Tabs.Badge>{item.count}</Tabs.Badge> : null}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="docs" className="pt-2">
              {docs.trim() ? (
                <div className={showToc ? "grid gap-6 xl:grid-cols-[12rem_minmax(0,1fr)] xl:gap-10" : undefined}>
                  {showToc && (
                    <Menu>
                      <Menu.Trigger render={<Button variant="outline" size="sm" className="w-fit xl:hidden" />}>
                        <ListTree />
                        Inhalt
                        <ChevronDown />
                      </Menu.Trigger>
                      <Menu.Content align="start">
                        {headings.map((item) => (
                          <Menu.Item
                            key={item.id}
                            style={{ paddingInlineStart: `${0.5 + item.depth * 0.75}rem` }}
                            onClick={() => {
                              document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                              window.history.replaceState(null, "", `#${item.id}`);
                            }}
                          >
                            {item.text}
                          </Menu.Item>
                        ))}
                      </Menu.Content>
                    </Menu>
                  )}
                  {showToc && (
                    <TableOfContents offset={128} aria-label="Inhalt der Dokumentation" className="hidden xl:sticky xl:top-32 xl:block xl:max-h-[calc(100vh-9rem)] xl:self-start xl:overflow-y-auto">
                      <TableOfContents.Title>Inhalt</TableOfContents.Title>
                      <TableOfContents.List>
                        {headings.map((item) => (
                          <TableOfContents.Item key={item.id} value={item.id} depth={item.depth}>
                            <TableOfContents.Link href={`#${item.id}`}>{item.text}</TableOfContents.Link>
                          </TableOfContents.Item>
                        ))}
                      </TableOfContents.List>
                    </TableOfContents>
                  )}
                  <div className="prose prose-bund max-w-none min-w-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{docs}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
                  <BookOpen className="size-6 opacity-40" />
                  <p className="text-sm">Für diese App gibt es noch keine ausführliche Dokumentation.</p>
                </div>
              )}
            </Tabs.Content>

            {showDeployment && (
              <Tabs.Content value="deployment" className="flex flex-col gap-6 pt-2">
                {app.isReuse && (
                  <Alert variant="plain" tone="warning">
                    <Alert.Icon><Recycle /></Alert.Icon>
                    <Alert.Title>Nachnutzung einer bestehenden Installation möglich</Alert.Title>
                    <Alert.Description className="whitespace-pre-wrap">
                      {app.reuseRequirements || "Die App kann mitgenutzt werden, ein eigener Betrieb ist nicht nötig."}
                    </Alert.Description>
                  </Alert>
                )}
                <DeploymentAssistant app={app} />
              </Tabs.Content>
            )}

            <Tabs.Content value="ratings" className="pt-2">
              <RatingSection appId={app.id} appName={app.name} />
            </Tabs.Content>

            {settings.faqEnabled && (
              <Tabs.Content value="faq" className="pt-2">
                <FAQSection
                  appId={app.id}
                  canDeleteQuestions={isOwner || hasPermission(user?.role, Permission.DeleteFAQQuestions, user?.permissions)}
                  canDeleteAnswers={isOwner || hasPermission(user?.role, Permission.DeleteFAQAnswers, user?.permissions)}
                  canPinAnswers={isOwner || hasPermission(user?.role, Permission.PinFAQAnswers, user?.permissions)}
                  canRecommendAnswers={isOwner || hasPermission(user?.role, Permission.RecommendFAQAnswers, user?.permissions)}
                />
              </Tabs.Content>
            )}

            {showChangelog && (
              <Tabs.Content value="changelog" className="pt-2">
                {releases.length > 0 ? (
                  <ReleaseList releases={releases} />
                ) : (
                  <div className="prose prose-bund max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{app.changelog || ""}</ReactMarkdown>
                  </div>
                )}
              </Tabs.Content>
            )}
          </Tabs>
        </div>

        {/* ── At a glance (desktop) ── */}
        <aside aria-label="Auf einen Blick" className="hidden lg:sticky lg:top-32 lg:flex lg:max-h-[calc(100vh-9rem)] lg:flex-col lg:self-start lg:overflow-y-auto">
          <div className="flex flex-col rounded-2xl border bg-card p-5">
            {glanceTop}
            {glanceRest}
          </div>
        </aside>
      </div>

      <section aria-label="Details zur App" className="flex flex-col rounded-2xl border bg-card p-5 lg:hidden">
        {glanceRest}
      </section>

      {/* ── Related ── */}
      {app.relatedApps && app.relatedApps.length > 0 && (
        <section id="related" aria-labelledby="related-heading" className="flex scroll-mt-24 flex-col gap-4 border-t pt-8">
          <h2 id="related-heading" className="text-lg font-semibold tracking-tight">Verwandte Apps</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {app.relatedApps.map((related) => {
              const src = getImageAssetUrl(related.icon);
              return (
                <li key={related.id}>
                  <NextLink
                    href={`/apps/${related.id}`}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background text-xl">
                      {src ? <Image src={src} alt="" fill sizes="40px" className="object-contain p-1" unoptimized /> : related.icon || "🏛️"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{related.name}</span>
                  </NextLink>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
