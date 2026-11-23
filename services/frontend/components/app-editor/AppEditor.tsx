"use client";

import { Alert } from "@/components/panelui/alert";
import { AlertDialog } from "@/components/panelui/alert-dialog";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Input } from "@/components/panelui/input";
import { NavRail } from "@/components/panelui/nav-rail";
import { Select } from "@/components/panelui/select";
import { Tooltip } from "@/components/panelui/tooltip";
import type { AppConfig, GitLabIntegrationState } from "@/config/apps";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { fetchApi as apiFetch } from "@/lib/api";
import { DRAFT_STATUS, getAppStatusLabel, isDraftStatus } from "@/lib/appStatus";
import { suggestChangelog } from "@/lib/ai";
import { toast } from "@/lib/toast";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ExternalLink, FolderGit2, LayoutDashboard, Link2, Megaphone, Network, PencilLine, Rocket, Save, ScrollText, Tags, Sparkles
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon, BasicsSection } from "./BasicsSection";
import { ClassificationSection } from "./ClassificationSection";
import { BannerSection, DetailsSection } from "./DetailsSection";
import { DeploymentSection } from "./DeploymentSection";
import { DocumentationSection } from "./DocumentationSection";
import { LinksSection } from "./LinksSection";
import { EditorSearch, EditorSearchInput, groupHits, useEditorSearch } from "./EditorSearch";
import { EditorTips } from "./EditorTips";
import { OverviewSection, PublishDialog } from "./OverviewSection";
import { getReadiness, type SectionId } from "./readiness";
import { type AppGroup, type RelatedApp, RelationsSection } from "./RelationsSection";
import { emptyRepositoryForm, normalizeRepositoryForm, type RepositoryForm, RepositorySection } from "./RepositorySection";
import type { AppDraft, UpdateApp } from "./shared";

// Editor failures stay in the form, so local work survives network errors.
const fetchApi: typeof apiFetch = (endpoint, options = {}) => apiFetch(endpoint, { ...options, suppressServerErrorReport: true });

const sanitizeLinks = (links?: { label?: string; url?: string }[]) =>
  (links || []).filter((link) => link.url?.trim()).map((link) => ({ label: link.label?.trim() || "Link", url: link.url!.trim() }));

interface SectionMeta {
  id: SectionId;
  label: string;
  title: string;
  description: string;
  icon: ReactNode;
  group: "start" | "content" | "connections" | "more";
}

const SECTIONS: SectionMeta[] = [
  { id: "overview", label: "Übersicht", title: "Übersicht", description: "Was noch fehlt, Veröffentlichung und Sichtbarkeit.", icon: <LayoutDashboard />, group: "start" },
  { id: "basics", label: "Grunddaten", title: "Grunddaten", description: "Name, Kurzbeschreibung und Logo.", icon: <PencilLine />, group: "content" },
  { id: "classification", label: "Einordnung", title: "Einordnung", description: "Kategorien, Herkunft, Technik und Nachnutzung.", icon: <Tags />, group: "content" },
  { id: "links", label: "Links", title: "Links", description: "Live-Zugänge, Quellcode und weitere Ressourcen.", icon: <Link2 />, group: "content" },
  { id: "documentation", label: "Dokumentation", title: "Dokumentation", description: "Ausführliche Beschreibung, Version und Änderungen.", icon: <BookOpen />, group: "content" },
  { id: "deployment", label: "Installation", title: "Installation", description: "Anleitungen für Helm, Docker Compose und Docker.", icon: <Rocket />, group: "content" },
  { id: "repository", label: "Repository", title: "Repository", description: "Inhalte aus GitLab oder GitHub übernehmen und aktuell halten.", icon: <FolderGit2 />, group: "connections" },
  { id: "relations", label: "Zuordnungen", title: "Zuordnungen", description: "Verwandte Apps und Gruppen.", icon: <Network />, group: "connections" },
  { id: "details", label: "Fachliche Details", title: "Fachliche Details", description: "Von der Plattform vorgegebene Angaben.", icon: <ScrollText />, group: "more" },
  { id: "banner", label: "Hinweis", title: "Hinweis", description: "Eine Meldung oben auf der App-Seite.", icon: <Megaphone />, group: "more" },
];

/** Which form fields each section edits, to mark sections with unsaved changes. */
const SECTION_FIELDS: Partial<Record<SectionId, string[]>> = {
  overview: ["status", "isHidden", "isFeatured"],
  basics: ["name", "description", "icon"],
  classification: ["categories", "tags", "techStack", "authority", "license", "isReuse", "reuseRequirements"],
  links: ["liveDemos", "skipLinkProbe", "repositories", "customLinks", "docsUrl"],
  documentation: ["markdownContent", "version", "changelog"],
  deployment: [
    "hasDeploymentAssistant", "showHelm", "showCompose", "showDocker", "helmRepo", "customHelmCommand", "customHelmValues", "customHelmNote",
    "customComposeCommand", "customComposeNote", "dockerRepo", "customDockerCommand", "customDockerNote",
  ],
  details: ["customFields"],
  banner: ["bannerType", "bannerColor", "bannerTitle", "bannerText"],
};

const GROUP_LABELS: Record<SectionMeta["group"], string | undefined> = {
  start: undefined,
  content: "Inhalte",
  connections: "Verknüpfungen",
  more: "Weiteres",
};

/** Back and forward between sections, so the editor can be worked through from top to bottom. */
function SectionPager({ previous, next, onOpen }: { previous?: SectionMeta; next?: SectionMeta; onOpen: (id: SectionId) => void }) {
  if (!previous && !next) return null;
  return (
    <nav aria-label="Bereiche durchblättern" className="mt-4 flex items-center justify-between gap-3 border-t pt-5">
      {previous ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(previous.id)}>
          <ArrowLeft />
          {previous.label}
        </Button>
      ) : <span />}
      {next && (
        <Button type="button" variant="outline" size="sm" onClick={() => onOpen(next.id)}>
          Weiter: {next.label}
          <ArrowRight />
        </Button>
      )}
    </nav>
  );
}

function buildSnapshot(app: AppDraft, relatedApps: RelatedApp[], groupIds: Set<string>) {
  return JSON.stringify({
    groupIds: Array.from(groupIds).sort(),
    relatedApps: relatedApps.map((item) => item.id).sort(),
    app: {
      ...app,
      categories: [...(app.categories || [])],
      customFields: [...(app.customFields || [])],
      customLinks: sanitizeLinks(app.customLinks),
      liveDemos: sanitizeLinks(app.liveDemos),
      repositories: sanitizeLinks(app.repositories),
      tags: [...(app.tags || [])],
      techStack: [...(app.techStack || [])],
    },
  });
}

export function AppEditor({ initialApp, existingApps }: { initialApp: AppConfig; existingApps: AppConfig[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profileReady, refreshUser } = useAuth();
  const { settings } = useSettings();
  const isAdmin = user?.role === "admin";
  const canManageGroups = isAdmin || !!user?.canSubmitApps;
  const canManageStructure = isAdmin || (!!user?.id && initialApp.ownerId === user.id);
  const backUrl = pathname.startsWith("/verwaltung") ? "/verwaltung/katalog/apps" : "/meine-apps";
  const appId = initialApp.id;

  const [app, setApp] = useState<AppDraft>(initialApp);
  // A link to `#section` opens that section. The editor only mounts in the browser, after the app has loaded.
  const [requestedSection, setSection] = useState<SectionId>(() => {
    const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return SECTIONS.some((item) => item.id === hash) ? hash as SectionId : "overview";
  });
  const [publishOpen, setPublishOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nameMissing, setNameMissing] = useState(false);

  // Related apps and groups are kept locally and written on save.
  const [relatedApps, setRelatedApps] = useState<RelatedApp[]>(initialApp.relatedApps || []);
  const [groups, setGroups] = useState<AppGroup[]>([]);
  const [groupIds, setGroupIds] = useState<Set<string>>(() => new Set((initialApp.appGroups || []).map((group) => group.id)));
  const persistedRelated = useRef(new Set((initialApp.relatedApps || []).map((item) => item.id)));
  const persistedGroups = useRef(new Set((initialApp.appGroups || []).map((group) => group.id)));
  const createdGroups = useRef(new Map<string, string>());

  // Repository: the link is written on save; sync and approval act at once.
  const [integration, setIntegration] = useState<GitLabIntegrationState | null>(null);
  const [repoForm, setRepoForm] = useState<RepositoryForm>(emptyRepositoryForm);
  const [savedRepoForm, setSavedRepoForm] = useState<string | null>(null);
  const [loadingRepo, setLoadingRepo] = useState(canManageStructure);
  const [syncing, setSyncing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [pendingUnlink, setPendingUnlink] = useState(false);
  const [repoAction, setRepoAction] = useState<"sync" | "approve" | null>(null);

  const [initialSnapshot, setInitialSnapshot] = useState(() => buildSnapshot(initialApp, initialApp.relatedApps || [], new Set((initialApp.appGroups || []).map((group) => group.id))));
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const skipUnsavedWarning = useRef(false);
  const saveInFlight = useRef(false);
  // An optional "what's new" line for the weekly summary, sent with the next save.
  const [changeNote, setChangeNote] = useState("");
  const [suggestingNote, setSuggestingNote] = useState(false);

  const update: UpdateApp = useCallback((patch) => {
    setApp((previous) => (typeof patch === "function" ? patch(previous) : { ...previous, ...patch }));
    setSaveError(null);
  }, []);

  const repoDirty = JSON.stringify(repoForm) !== (savedRepoForm ?? JSON.stringify(emptyRepositoryForm));
  const hasUnsavedChanges = buildSnapshot(app, relatedApps, groupIds) !== initialSnapshot || repoDirty || pendingUnlink;
  const busy = saving || syncing || approving;
  const readiness = useMemo(() => getReadiness(app), [app]);
  const draft = isDraftStatus(app.status || DRAFT_STATUS);
  const missingBySection = useMemo(() => {
    const counts = new Map<SectionId, number>();
    readiness.filter((item) => item.required && !item.done).forEach((item) => counts.set(item.section, (counts.get(item.section) || 0) + 1));
    return counts;
  }, [readiness]);
  const visibleSections = useMemo(
    () => SECTIONS.filter((item) => canManageStructure || (item.id !== "repository" && item.id !== "relations")),
    [canManageStructure],
  );
  // A section this user cannot see (from an old link) falls back to the overview.
  const section = visibleSections.some((item) => item.id === requestedSection) ? requestedSection : "overview";
  const dirtySections = useMemo(() => {
    const dirty = new Set<SectionId>();
    const before = JSON.parse(initialSnapshot) as { app: Record<string, unknown>; relatedApps: string[]; groupIds: string[] };
    const after = JSON.parse(buildSnapshot(app, relatedApps, groupIds)) as typeof before;
    for (const [id, fields] of Object.entries(SECTION_FIELDS) as [SectionId, string[]][]) {
      if (fields.some((field) => JSON.stringify(before.app[field] ?? null) !== JSON.stringify(after.app[field] ?? null))) dirty.add(id);
    }
    if (JSON.stringify(before.relatedApps) !== JSON.stringify(after.relatedApps) || JSON.stringify(before.groupIds) !== JSON.stringify(after.groupIds)) dirty.add("relations");
    if (repoDirty || pendingUnlink) dirty.add("repository");
    return dirty;
  }, [app, relatedApps, groupIds, initialSnapshot, repoDirty, pendingUnlink]);

  // One section at a time: the rail switches what is shown, the hash keeps it linkable.
  const openSection = (id: SectionId) => {
    setSection(id);
    window.history.replaceState(null, "", `#${id}`);
    // A section opened from further down starts at its top, not mid-way through.
    if (window.scrollY > 0) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }
  };

  useEffect(() => {
    if (!canManageGroups) return;
    fetchApi("/app-groups")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [canManageGroups]);

  useEffect(() => {
    if (!canManageStructure) return;
    let active = true;
    fetchApi(`/apps/${appId}/gitlab`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => ({})) as { message?: string };
          throw new Error(error.message || "Repository-Daten konnten nicht geladen werden.");
        }
        return response.json() as Promise<GitLabIntegrationState>;
      })
      .then((data) => {
        if (!active) return;
        const form = normalizeRepositoryForm(data);
        setIntegration(data);
        setRepoForm(form);
        setSavedRepoForm(JSON.stringify(form));
      })
      .catch((error) => active && setRepoError(error instanceof Error ? error.message : "Repository-Daten konnten nicht geladen werden."))
      .finally(() => active && setLoadingRepo(false));
    return () => {
      active = false;
    };
  }, [appId, canManageStructure]);

  const applyIntegration = (data: GitLabIntegrationState) => {
    const form = normalizeRepositoryForm(data);
    setIntegration(data);
    setRepoForm(form);
    setSavedRepoForm(JSON.stringify(form));
  };

  /** Writes the form, the repository link, related apps and groups. `patch` is applied first. */
  const save = async (patch: AppDraft = {}): Promise<boolean> => {
    if (saveInFlight.current || syncing || approving) return false;
    const next = { ...app, ...patch };
    if (!next.name?.trim()) {
      setNameMissing(true);
      setSaveError("Die App braucht einen Namen.");
      openSection("basics");
      return false;
    }
    if (!isDraftStatus(next.status || DRAFT_STATUS) && (!next.categories?.length || !next.description?.trim())) {
      setSaveError("Veröffentlichte Apps brauchen eine Kurzbeschreibung und mindestens eine Kategorie.");
      openSection("overview");
      return false;
    }
    if (repoDirty && !pendingUnlink && (!repoForm.providerKey || !repoForm.projectPath.trim())) {
      setSaveError("Für die Repository-Verknüpfung fehlen Provider oder Projektpfad.");
      openSection("repository");
      return false;
    }
    saveInFlight.current = true;
    if (!profileReady && !(await refreshUser().catch(() => null))) {
      setSaveError("Dein Benutzerprofil wird noch synchronisiert. Bitte versuche es gleich noch einmal.");
      saveInFlight.current = false;
      return false;
    }

    setSaving(true);
    setSaveError(null);
    setNameMissing(false);
    let completed = 0;
    let nextGroupIds = groupIds;
    try {
      const response = await fetchApi(`/apps/${appId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...next,
          categories: next.categories || [],
          techStack: next.techStack || [],
          repositories: sanitizeLinks(next.repositories),
          customLinks: sanitizeLinks(next.customLinks),
          liveDemos: sanitizeLinks(next.liveDemos),
          status: next.status?.trim() || DRAFT_STATUS,
          changeNote: changeNote.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(error.message || "Speichern fehlgeschlagen.");
      }
      setChangeNote("");
      completed++;

      // Each step advances its own baseline, so a retry after a partial
      // failure does not create a relation twice.
      const persist = async (path: string, method: string, body?: unknown) => {
        const result = await fetchApi(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
        if (!result.ok) {
          const error = await result.json().catch(() => ({})) as { message?: string };
          throw new Error(error.message || "Eine Verknüpfung konnte nicht gespeichert werden.");
        }
        completed++;
        return result;
      };

      if (canManageStructure) {
        if (pendingUnlink) {
          applyIntegration(await (await persist(`/apps/${appId}/repository`, "DELETE")).json());
          setPendingUnlink(false);
        } else if (repoDirty) {
          applyIntegration(await (await persist(`/apps/${appId}/repository`, "PUT", repoForm)).json());
        }
        const nextRelated = new Set(relatedApps.map((item) => item.id));
        for (const id of [...persistedRelated.current]) {
          if (!nextRelated.has(id)) {
            await persist(`/apps/${appId}/related/${id}`, "DELETE");
            persistedRelated.current.delete(id);
          }
        }
        for (const id of nextRelated) {
          if (!persistedRelated.current.has(id)) {
            await persist(`/apps/${appId}/related`, "POST", { relatedAppId: id });
            persistedRelated.current.add(id);
          }
        }
      }

      if (canManageGroups) {
        const resolved = new Set<string>();
        for (const localId of groupIds) {
          let id = createdGroups.current.get(localId) || localId;
          if (id.startsWith("pending:")) {
            const created = await (await persist("/app-groups", "POST", { name: groups.find((group) => group.id === localId)?.name })).json() as AppGroup;
            id = created.id;
            createdGroups.current.set(localId, id);
            setGroups((previous) => previous.map((group) => (group.id === localId ? created : group)));
          }
          resolved.add(id);
          if (!persistedGroups.current.has(id)) {
            await persist(`/app-groups/${id}/members`, "POST", { appId });
            persistedGroups.current.add(id);
          }
        }
        for (const id of [...persistedGroups.current]) {
          if (!resolved.has(id)) {
            await persist(`/app-groups/${id}/members/${appId}`, "DELETE");
            persistedGroups.current.delete(id);
          }
        }
        nextGroupIds = resolved;
        setGroupIds(resolved);
      }

      setApp(next);
      setInitialSnapshot(buildSnapshot(next, relatedApps, nextGroupIds));
      return true;
    } catch (error) {
      const message = (completed ? "Teilweise gespeichert. Die übrigen Änderungen bleiben im Formular, bitte erneut speichern. " : "") +
        (error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
      setSaveError(message);
      toast.danger(message);
      return false;
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  // The AI changelog draft compares the edit with the saved app; its summary is a good "what's new".
  const suggestNote = async () => {
    setSuggestingNote(true);
    try {
      const links = (app.repositories || []).filter((link) => link.url?.trim()).map((link) => ({ label: link.label || "Link", url: link.url! }));
      const suggestion = await suggestChangelog({
        appId,
        name: app.name || "",
        version: app.version || "",
        currentChangelog: app.changelog || "",
        description: app.description || "",
        license: app.license || "",
        markdownContent: app.markdownContent || "",
        customHelmValues: app.customHelmValues || "",
        customComposeCommand: app.customComposeCommand || "",
        tags: app.tags || [],
        repositories: links,
      });
      setChangeNote((suggestion.summary || suggestion.title || "").slice(0, 500));
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "Es konnte kein Vorschlag erzeugt werden.");
    } finally {
      setSuggestingNote(false);
    }
  };

  const saveChanges = async () => {
    if (await save()) toast.success(draft ? "Entwurf gespeichert." : "Änderungen gespeichert.");
  };

  const publish = async (status: string) => {
    const ok = await save({ status });
    if (ok) toast.success(`Die App ist jetzt veröffentlicht (${status}).`);
    return ok;
  };

  const unpublish = async () => {
    const ok = await save({ status: DRAFT_STATUS });
    if (ok) toast.success("Die App ist wieder ein Entwurf.");
    return ok;
  };

  // ⌘S / Ctrl+S saves.
  const saveRef = useRef(saveChanges);
  useEffect(() => {
    saveRef.current = saveChanges;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reloadApp = async () => {
    const response = await fetchApi(`/apps/${appId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Die App konnte nach der Synchronisation nicht neu geladen werden. Bitte lade die Seite neu, bevor du weiterarbeitest.");
    const data = await response.json() as AppConfig;
    setApp(data);
    setInitialSnapshot(buildSnapshot(data, relatedApps, groupIds));
  };

  const runRepositoryAction = async (action: "sync" | "approve") => {
    if (hasUnsavedChanges || saveInFlight.current) return;
    const setBusy = action === "sync" ? setSyncing : setApproving;
    setBusy(true);
    setRepoError(null);
    try {
      const response = await fetchApi(`/apps/${appId}/gitlab/${action}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { message?: string }).message || (action === "sync" ? "Repository-Synchronisation fehlgeschlagen." : "Repository-Änderung konnte nicht freigegeben werden."));
      }
      const result = data as GitLabIntegrationState;
      applyIntegration(result);
      if (action === "sync" && result.approvalRequired) {
        toast.info("Die Synchronisation wartet auf Freigabe.");
      } else {
        await reloadApp();
        toast.success(action === "approve" ? "Änderungen freigegeben und übernommen." : result.lastSyncStatus === "warning" ? "Synchronisiert, aber mit Hinweisen." : "Repository synchronisiert.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Die Repository-Aktion ist fehlgeschlagen.";
      setRepoError(message);
      toast.danger(message);
    } finally {
      setBusy(false);
    }
  };

  const snapshot = integration?.snapshot;
  const applyReadme = () => {
    if (!snapshot?.readmeContent?.trim()) return;
    update({ markdownContent: snapshot.readmeContent.trim() });
    toast.success("README als Dokumentation übernommen.");
  };
  const applyMetadata = () => {
    if (!snapshot) return;
    update((previous) => {
      const repositories = [...(previous.repositories || [])];
      if (snapshot.projectWebUrl && !repositories.some((link) => link.url === snapshot.projectWebUrl)) repositories.push({ label: "Repository", url: snapshot.projectWebUrl });
      return {
        ...previous,
        description: snapshot.description?.trim() || previous.description,
        license: snapshot.license?.trim() || previous.license,
        repositories,
        tags: Array.from(new Set([...(previous.tags || []), ...(snapshot.topics || []).map((topic) => topic.trim()).filter(Boolean)])),
      };
    });
    toast.success("Beschreibung, Lizenz und Schlagwörter übernommen.");
  };
  const applyDeployment = () => {
    if (!snapshot) return;
    update((previous) => ({
      ...previous,
      showHelm: snapshot.helmValuesContent?.trim() ? true : previous.showHelm,
      showCompose: snapshot.composeFileContent?.trim() ? true : previous.showCompose,
      customHelmValues: snapshot.helmValuesContent?.trim() || previous.customHelmValues,
      customComposeCommand: snapshot.composeFileContent?.trim() || previous.customComposeCommand,
    }));
    toast.success("Deployment-Dateien übernommen.");
  };

  // ── Leaving with unsaved changes ──
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (skipUnsavedWarning.current || !hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.origin === window.location.origin) return;
      if (!hasUnsavedChanges || skipUnsavedWarning.current) return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) setPendingNavigation(destination.href);
    };
    // The Navigation API can cancel browser Back/Forward before React unmounts.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const onNavigate = (event: Event) => {
      const navigationEvent = event as Event & { navigationType?: string; hashChange?: boolean };
      if (navigationEvent.navigationType !== "traverse" || navigationEvent.hashChange || !event.cancelable || skipUnsavedWarning.current || !hasUnsavedChanges) return;
      if (busy || !window.confirm("Ungespeicherte Änderungen verwerfen und die Seite verlassen?")) event.preventDefault();
    };
    document.addEventListener("click", onClick, true);
    navigation?.addEventListener("navigate", onNavigate);
    return () => {
      document.removeEventListener("click", onClick, true);
      navigation?.removeEventListener("navigate", onNavigate);
    };
  }, [hasUnsavedChanges, busy]);

  const requestNavigation = (path: string) => {
    if (busy) return;
    if (hasUnsavedChanges && !skipUnsavedWarning.current) setPendingNavigation(path);
    else router.push(path);
  };

  const leave = () => {
    if (!pendingNavigation) return;
    skipUnsavedWarning.current = true;
    const destination = new URL(pendingNavigation, window.location.href);
    if (destination.origin === window.location.origin) router.push(destination.pathname + destination.search + destination.hash);
    else window.location.assign(destination.href);
  };

  const renderSection = (id: SectionId) => {
    switch (id) {
      case "overview":
        return <OverviewSection app={app} update={update} readiness={readiness} isAdmin={isAdmin} busy={busy} onNavigate={openSection} onUnpublish={unpublish} />;
      case "basics":
        return <BasicsSection app={app} update={update} nameMissing={nameMissing && !app.name?.trim()} />;
      case "classification":
        return <ClassificationSection app={app} update={update} existingApps={existingApps} />;
      case "links":
        return <LinksSection app={app} update={update} />;
      case "documentation":
        return <DocumentationSection app={app} update={update} aiEnabled={settings.aiEnabled !== false} />;
      case "deployment":
        return <DeploymentSection app={app} update={update} />;
      case "repository":
        return (
          <RepositorySection
            app={app}
            integration={integration}
            form={repoForm}
            onFormChange={(form) => { setPendingUnlink(false); setRepoForm(form); }}
            loading={loadingRepo}
            busy={busy}
            syncing={syncing}
            approving={approving}
            error={repoError}
            pendingUnlink={pendingUnlink}
            hasUnsavedChanges={hasUnsavedChanges}
            onSync={() => setRepoAction("sync")}
            onApprove={() => setRepoAction("approve")}
            onUnlink={() => { setPendingUnlink(true); setRepoForm(emptyRepositoryForm); }}
            onApplyReadme={applyReadme}
            onApplyMetadata={applyMetadata}
            onApplyDeployment={applyDeployment}
          />
        );
      case "relations":
        return (
          <RelationsSection
            appId={appId}
            existingApps={existingApps}
            relatedApps={relatedApps}
            onRelatedChange={setRelatedApps}
            canManageGroups={canManageGroups}
            groups={groups}
            groupIds={groupIds}
            onToggleGroup={(id) => setGroupIds((previous) => {
              const next = new Set(previous);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            })}
            onCreateGroup={(name) => {
              const group = { id: `pending:${crypto.randomUUID()}`, name };
              setGroups((previous) => [...previous, group]);
              setGroupIds((previous) => new Set([...previous, group.id]));
            }}
          />
        );
      case "details":
        return <DetailsSection app={app} update={update} definitions={settings.detailFields ?? []} />;
      case "banner":
        return <BannerSection app={app} update={update} />;
    }
  };

  const missingRequired = readiness.filter((item) => item.required && !item.done).length;
  const search = useEditorSearch(visibleSections, openSection);

  const navGroups = (["start", "content", "connections", "more"] as const).map((group) => ({
    group,
    items: visibleSections.filter((item) => item.group === group),
  })).filter((entry) => entry.items.length);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      {/* Header: what is being edited, its state, and the one save. */}
      <header className="sticky top-14 z-30 -mx-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Tooltip>
          <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label="Zurück zur Übersicht" onClick={() => requestNavigation(backUrl)} />}>
            <ArrowLeft />
          </Tooltip.Trigger>
          <Tooltip.Content>Zurück zur Übersicht</Tooltip.Content>
        </Tooltip>
        <AppIcon icon={app.icon} size="sm" />
        <div className="flex min-w-[10rem] flex-1 items-center gap-2">
          <h1 className="min-w-0 truncate text-lg font-semibold">{app.name || "Ohne Namen"}</h1>
          {draft ? <Badge variant="secondary" className="shrink-0">Entwurf</Badge> : <Badge variant="success" dot className="shrink-0">{getAppStatusLabel(app.status) || app.status}</Badge>}
        </div>
        <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
          {hasUnsavedChanges && !saving && <span className="hidden text-sm text-muted-foreground md:inline" aria-live="polite">Ungespeicherte Änderungen</span>}
          <EditorTips section={section} sectionLabel={visibleSections.find((item) => item.id === section)?.label ?? ""} draft={draft} />
          <Button variant="ghost" size="sm" render={<a href={`/apps/${encodeURIComponent(appId)}`} />}>
            <ExternalLink />
            <span className="hidden sm:inline">Ansehen</span>
          </Button>
          <Tooltip>
            <Tooltip.Trigger
              render={
                <Button
                  size="sm"
                  variant={draft ? "outline" : "default"}
                  loading={saving}
                  disabled={!hasUnsavedChanges || busy}
                  onClick={() => void saveChanges()}
                />
              }
            >
              {hasUnsavedChanges || saving ? <Save /> : <Check />}
              {hasUnsavedChanges || saving ? "Speichern" : "Gespeichert"}
            </Tooltip.Trigger>
            <Tooltip.Content variant="shortcut">
              Speichern
              <Tooltip.Shortcut keys={["⌘", "S"]} />
            </Tooltip.Content>
          </Tooltip>
          {draft && (
            <Tooltip>
              <Tooltip.Trigger render={<span tabIndex={missingRequired ? 0 : -1} className="inline-flex" />}>
                <Button size="sm" disabled={missingRequired > 0 || busy} onClick={() => setPublishOpen(true)}>
                  <Rocket />
                  Veröffentlichen
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>
                {missingRequired ? `Noch ${missingRequired} ${missingRequired === 1 ? "Pflichtangabe fehlt" : "Pflichtangaben fehlen"}` : "Status wählen und veröffentlichen"}
              </Tooltip.Content>
            </Tooltip>
          )}
        </div>
      </header>

      {!draft && hasUnsavedChanges && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl bg-muted/40 p-3 sm:flex-row sm:items-center sm:gap-3">
          <label htmlFor="change-note" className="flex shrink-0 items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-muted-foreground" />
            Was ist neu?
          </label>
          <Input
            id="change-note"
            size="sm"
            maxLength={500}
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
            placeholder="Optional, z. B. „OIDC-Login für Teams ergänzt“ – erscheint im Wochenrückblick"
            className="min-w-0 flex-1"
          />
          {settings.aiEnabled !== false && (
            <Button variant="ghost" size="sm" className="shrink-0" loading={suggestingNote} onClick={() => void suggestNote()}>
              Vorschlag
            </Button>
          )}
        </div>
      )}

      {saveError && (
        <Alert variant="plain" tone="destructive" className="mb-6" aria-live="assertive">
          <Alert.Icon />
          <Alert.Title>{saveError}</Alert.Title>
        </Alert>
      )}

      {/* On small screens the sections are a select instead of a rail. */}
      <div className="mb-6 lg:hidden">
        <EditorSearch search={search}>
        <Select
          items={visibleSections.map((item) => ({ value: item.id, label: item.label }))}
          value={section}
          onValueChange={(value) => value && openSection(value as SectionId)}
        >
          <Select.Trigger aria-label="Bereich">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {visibleSections.map((item) => (
              <Select.Item key={item.id} value={item.id} icon={item.icon}>{item.label}</Select.Item>
            ))}
          </Select.Content>
        </Select>
        </EditorSearch>
      </div>

      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-32">
            <NavRail aria-label="Bereiche der App" collapsible="none" expandedWidth="15rem">
              <NavRail.Header>
                <EditorSearchInput search={search} className="w-full" />
              </NavRail.Header>
              <NavRail.Content>
                {search.searching ? (
                  search.hits.length > 0 ? (
                    groupHits(search.hits).map((group) => (
                      <NavRail.Group key={group.sectionId} label={group.label}>
                        {group.items.map((hit) => (
                          <NavRail.Item
                            key={hit.key}
                            href={`#${hit.sectionId}`}
                            icon={SECTIONS.find((item) => item.id === hit.sectionId)?.icon}
                            onClick={(event) => {
                              event.preventDefault();
                              search.open(hit);
                            }}
                          >
                            {hit.field ?? hit.sectionLabel}
                          </NavRail.Item>
                        ))}
                      </NavRail.Group>
                    ))
                  ) : (
                    <p className="px-2.5 py-2 text-sm text-muted-foreground">Kein Feld gefunden.</p>
                  )
                ) : (
                  <>
                    {navGroups.map(({ group, items }) => (
                      <NavRail.Group key={group} label={GROUP_LABELS[group]}>
                        {items.map((item) => {
                          const missing = missingBySection.get(item.id) || 0;
                          return (
                            <NavRail.Item
                              key={item.id}
                              href={`#${item.id}`}
                              icon={item.icon}
                              active={item.id === section}
                              onClick={(event) => {
                                event.preventDefault();
                                openSection(item.id);
                              }}
                            >
                              {item.label}
                              {dirtySections.has(item.id) && <NavRail.Badge aria-label="Ungespeicherte Änderungen">•</NavRail.Badge>}
                              {missing > 0 && <NavRail.Badge aria-label={`${missing} Pflichtangaben fehlen`}>{missing}</NavRail.Badge>}
                            </NavRail.Item>
                          );
                        })}
                      </NavRail.Group>
                    ))}
                  </>
                )}
              </NavRail.Content>
            </NavRail>
          </div>
        </aside>

        <main className="min-w-0">
          <fieldset disabled={busy} aria-busy={busy} className="flex min-w-0 flex-col">
            {visibleSections.map((item, index) => (
              // Every section stays mounted, so its inputs keep their state while another one is open.
              <section key={item.id} id={`section-${item.id}`} hidden={item.id !== section} aria-labelledby={`heading-${item.id}`} className="flex flex-col gap-4 [&[hidden]]:hidden">
                <div className={item.id === "overview" ? "sr-only" : "flex flex-col gap-0.5"}>
                  <h2 id={`heading-${item.id}`} className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                    {item.title}
                    {dirtySections.has(item.id) && <Badge variant="secondary" size="sm">Geändert</Badge>}
                  </h2>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                {renderSection(item.id)}
                <SectionPager previous={visibleSections[index - 1]} next={visibleSections[index + 1]} onOpen={openSection} />
              </section>
            ))}
          </fieldset>
        </main>
      </div>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} onPublish={publish} />

      <AlertDialog open={repoAction !== null} onOpenChange={(open) => { if (!open) setRepoAction(null); }}>
        <AlertDialog.Content tone="warning">
          <AlertDialog.Title>{repoAction === "approve" ? "Repository-Änderungen freigeben?" : "Repository jetzt synchronisieren?"}</AlertDialog.Title>
          <AlertDialog.Description>
            Dokumentation, Metadaten und Deployment-Angaben können dabei durch Inhalte aus dem Repository ersetzt werden. Die Aktion wird sofort ausgeführt.
          </AlertDialog.Description>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Abbrechen</AlertDialog.Cancel>
            <AlertDialog.Action onClick={() => { const action = repoAction; setRepoAction(null); if (action) void runRepositoryAction(action); }}>
              {repoAction === "approve" ? "Freigeben" : "Synchronisieren"}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>

      <AlertDialog open={!!pendingNavigation} onOpenChange={(open) => { if (!open) setPendingNavigation(null); }}>
        <AlertDialog.Content tone="destructive">
          <AlertDialog.Title>Ungespeicherte Änderungen verwerfen?</AlertDialog.Title>
          <AlertDialog.Description>Wenn du die Seite jetzt verlässt, gehen deine Anpassungen verloren.</AlertDialog.Description>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Weiter bearbeiten</AlertDialog.Cancel>
            <AlertDialog.Action onClick={leave}>Verwerfen und verlassen</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
}
