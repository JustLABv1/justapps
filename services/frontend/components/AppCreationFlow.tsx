"use client";

import { EditorStatusPicker } from "@/components/editor/EditorStatusPicker";
import { LinkListEditor } from "@/components/editor/LinkListEditor";
import { AppConfig, GitLabIntegrationState, GitLabProviderSummary, SystemUser } from "@/config/apps";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { fetchApi, uploadFile } from "@/lib/api";
import { DRAFT_STATUS, isDraftStatus } from "@/lib/appStatus";
import { getImageAssetUrl, isImageAssetSource } from "@/lib/assets";
import {
  Alert, Button, Chip, FieldError, Input as HeroInput, Label, ListBox, ProgressBar,
  Select, Switch, TextArea as HeroTextArea, TextField, ToggleButton, toast,
} from "@heroui/react";
import {
  ArrowLeft, ArrowRight, BookOpen, Boxes, Check, CircleHelp, FileText,
  FolderGit2, ImagePlus, Layers, Link2, PackageOpen, Pencil, Rocket,
  Sparkles, Tag, Upload, X,
  UserPlus, UsersRound,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ComponentProps, useEffect, useMemo, useRef, useState } from "react";

const CATEGORIES = ["Verwaltung", "Kommunikation", "Infrastruktur", "Sicherheit", "Datenanalyse", "Dokumentenmanagement", "Projektmanagement", "Bürgerdienste", "Geodaten", "Finanzen", "Personal", "Bildung", "Gesundheit", "Umwelt", "Verkehr", "KI & Automatisierung"];
const EMOJIS = ["🏛️", "📊", "💬", "🔐", "📅", "🚀", "🛠️", "📱", "🛡️", "⚙️", "📦", "📈", "🔑", "🏙️", "👥", "🗺️", "💰", "📝", "🌐", "🤖", "📧", "🗂️"];

type SectionId = "repository" | "deployment" | "resources" | "banner" | "documentation" | "related" | "editors";
type StepId = string;
type Branches = Record<SectionId, boolean>;
type Step = { id: StepId; title: string; description: string; section?: SectionId; optional?: boolean; icon: React.ReactNode };

export interface AppCreationFlowProps {
  existingApps: AppConfig[];
  initialFormData?: Partial<AppConfig> | null;
  copySource?: { id: string; name: string } | null;
}

const emptyApp = (): Partial<AppConfig> => ({
  categories: [], techStack: [], tags: [], liveDemos: [], repositories: [], customLinks: [], customFields: [],
  icon: "🏛️", license: "MIT", status: DRAFT_STATUS, hasDeploymentAssistant: true,
  showDocker: true, showCompose: true, showHelm: true,
});

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const links = (items?: { label?: string; url?: string }[]) => (items || []).filter((item) => item.url?.trim()).map((item) => ({ label: item.label?.trim() || "Link", url: item.url!.trim() }));

function Input({ className, ...props }: ComponentProps<typeof HeroInput>) {
  return <HeroInput {...props} className={`h-12 text-base ${className || ""}`} />;
}

function TextArea({ className, ...props }: ComponentProps<typeof HeroTextArea>) {
  return <HeroTextArea {...props} className={`min-h-32 text-base ${className || ""}`} />;
}

function SectionGate({ title, description, enabled, onChange, icon }: { title: string; description: string; enabled: boolean; onChange: (value: boolean) => void; icon: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <span className="sr-only">{title}</span>
    {[true, false].map((value) => <button key={String(value)} type="button" onClick={() => onChange(value)} className={`rounded-3xl border p-5 text-left transition-[border-color,background-color,transform] duration-180 ease-out active:scale-[0.98] ${enabled === value ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40"}`}>
      <div className="flex items-center justify-between gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${enabled === value ? "bg-accent text-accent-foreground" : "bg-surface-secondary text-muted"}`}>{value ? icon : <X className="h-5 w-5" />}</span>{enabled === value && <Check className="h-5 w-5 text-accent" />}</div>
      <p className="mt-5 text-lg font-semibold text-foreground">{value ? "Ja, einrichten" : "Jetzt überspringen"}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{value ? description : "Sie können dies später im erweiterten Editor ergänzen."}</p>
    </button>)}
  </div>;
}

function StepVisual({ step, formData }: { step: Step; formData: Partial<AppConfig> }) {
  const image = getImageAssetUrl(formData.icon);
  return <div aria-hidden="true" className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] border border-accent/20 bg-accent/10 text-accent shadow-sm transition-[transform,opacity] duration-200 ease-out sm:h-32 sm:w-32">
    {step.id === "logo" && image ? <Image src={image} alt="" width={112} height={112} className="h-full w-full object-contain p-3" unoptimized /> : step.id === "name" ? <span className="max-w-[7rem] truncate text-center text-lg font-bold">{formData.name || "App"}</span> : <span className="text-4xl">{step.id === "logo" ? (formData.icon || "🏛️") : step.icon}</span>}
  </div>;
}

export function AppCreationFlow({ existingApps, initialFormData = null, copySource = null }: AppCreationFlowProps) {
  const router = useRouter();
  const { user, profileReady, refreshUser } = useAuth();
  const { settings } = useSettings();
  const isAdmin = user?.role === "admin";
  const backUrl = isAdmin ? "/verwaltung/katalog/apps" : "/meine-apps";
  const [formData, setFormData] = useState<Partial<AppConfig>>(() => {
    const initial = { ...emptyApp(), ...(initialFormData || {}) };
    return { ...initial, id: initial.id || (initial.name ? slugify(initial.name) : "") };
  });
  const [branches, setBranches] = useState<Branches>(() => ({
    repository: !!initialFormData?.repositories?.length, deployment: !!initialFormData?.hasDeploymentAssistant,
    resources: !!(initialFormData?.liveDemos?.length || initialFormData?.repositories?.length || initialFormData?.customLinks?.length || initialFormData?.docsUrl),
    banner: !!initialFormData?.bannerText, documentation: !!initialFormData?.markdownContent, related: false, editors: false,
  }));
  const [currentId, setCurrentId] = useState<StepId>("name");
  const [attemptedNext, setAttemptedNext] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
  const [idEditing, setIdEditing] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [providers, setProviders] = useState<GitLabProviderSummary[]>([]);
  const [repo, setRepo] = useState({ providerKey: "", projectPath: "", branch: "", readmePath: "", helmValuesPath: "", composeFilePath: "" });
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [iconUrl, setIconUrl] = useState(isImageAssetSource(initialFormData?.icon) ? initialFormData?.icon || "" : "");
  const [showEmojis, setShowEmojis] = useState(false);
  const [relatedApps, setRelatedApps] = useState<{ id: string; name: string; icon?: string }[]>([]);
  const [relatedSearch, setRelatedSearch] = useState("");
  const [groups, setGroups] = useState<{ id: string; name: string; description?: string }[]>([]);
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set());
  const [availableUsers, setAvailableUsers] = useState<SystemUser[]>([]);
  const [editorIds, setEditorIds] = useState<Set<string>>(new Set(initialFormData?.editors?.map((editor) => editor.id) || []));
  const [editorSearch, setEditorSearch] = useState("");
  const [editorsWereSaved, setEditorsWereSaved] = useState(false);
  const iconInput = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const idTaken = !!formData.id?.trim() && existingApps.some((app) => app.id === formData.id && app.id !== draftId);
  const canCreateDraft = !!formData.name?.trim() && !!formData.id?.trim() && !idTaken;
  const nonDraft = !isDraftStatus(formData.status);
  const fieldPairs = useMemo(() => {
    const fields = settings.detailFields || [];
    return Array.from({ length: Math.ceil(fields.length / 2) }, (_, index) => fields.slice(index * 2, index * 2 + 2));
  }, [settings.detailFields]);
  const selectedMethods = [formData.showDocker !== false && "docker", formData.showCompose !== false && "compose", formData.showHelm !== false && "helm"].filter(Boolean) as string[];

  const steps: Step[] = (() => {
    const next: Step[] = [
      { id: "name", title: "Wie heißt deine App?", description: "Wir erzeugen daraus eine technische ID, die du bei Bedarf anpassen kannst.", icon: <Pencil /> },
      { id: "logo", title: "Logo auswählen", description: "Lade ein Logo hoch oder wähle ein passendes Symbol für deine App.", icon: <ImagePlus /> },
      { id: "categories", title: "Wo gehört sie hin?", description: "Wähle mindestens eine Kategorie für die spätere Auffindbarkeit.", icon: <Tag /> },
      { id: "status", title: "Wie weit ist die App?", description: "Der Status steuert, welche Angaben für die Veröffentlichung benötigt werden.", icon: <Sparkles /> },
      { id: "description", title: "Was macht die App?", description: "Beschreibe ihren Nutzen in wenigen klaren Sätzen.", icon: <FileText /> },
      { id: "metadata", title: "Lizenz und Schlagwörter", description: "Zwei kleine Angaben, damit andere die App besser einordnen können.", icon: <Tag /> },
      { id: "repository", title: "Ein Repository verbinden?", description: "README, Metadaten und Deployment-Dateien können direkt übernommen werden.", section: "repository", optional: true, icon: <FolderGit2 /> },
    ];
    if (branches.repository) next.push(
      { id: "repo-project", title: "Wo liegt der Quellcode?", description: "Wähle den Provider und trage den Projektpfad ein.", icon: <FolderGit2 /> },
      { id: "repo-paths", title: "Import-Einstellungen", description: "Branch und optionale Datei-Pfade für den Import.", icon: <FolderGit2 /> },
    );
    next.push({ id: "reuse", title: "Ist die Lösung nachnutzbar?", description: "Beschreibe bei Bedarf Voraussetzungen oder Grenzen.", icon: <Layers /> }, { id: "deployment", title: "Installationshilfe anbieten?", description: "Lege fest, ob und wie die App bereitgestellt werden kann.", section: "deployment", optional: true, icon: <Rocket /> });
    if (branches.deployment) {
      next.push({ id: "deployment-methods", title: "Welche Wege sind verfügbar?", description: "Wähle die Installationswege aus, die in der App angezeigt werden sollen.", icon: <PackageOpen /> });
      selectedMethods.forEach((method) => next.push({ id: `deployment-${method}`, title: `${method === "helm" ? "Helm" : method === "compose" ? "Docker Compose" : "Docker"} konfigurieren`, description: "Ergänze die Informationen für diesen Installationsweg.", icon: <Rocket /> }));
    }
    next.push({ id: "resources", title: "Wichtige Links ergänzen?", description: "Live-Zugänge, Quellcode und Dokumentation können separat gepflegt werden.", section: "resources", optional: true, icon: <Link2 /> });
    if (branches.resources) next.push({ id: "live-links", title: "Live-Zugänge", description: "Füge produktive oder Demo-Einstiege hinzu.", icon: <Link2 /> }, { id: "source-links", title: "Code und weitere Ressourcen", description: "Verlinke Quellcode, Ressourcen und externe Dokumentation.", icon: <Link2 /> });
    next.push({ id: "presentation", title: "Herausgeber und Technologien", description: "Hilf anderen, den Kontext und die technische Basis einzuordnen.", icon: <Boxes /> }, { id: "banner", title: "Soll ein Hinweis erscheinen?", description: "Optionaler Status- oder Warnhinweis auf der App-Seite.", section: "banner", optional: true, icon: <CircleHelp /> });
    if (branches.banner) next.push({ id: "banner-content", title: "Hinweis gestalten", description: "Wähle die Art und formuliere den Hinweis.", icon: <CircleHelp /> });
    fieldPairs.forEach((_, index) => next.push({ id: `details-${index}`, title: "Fachliche Details", description: "Ergänze nur die Angaben, die für diese App wichtig sind.", icon: <Layers /> }));
    next.push({ id: "editors", title: "Weitere Bearbeiter hinzufügen?", description: "Du kannst anderen Personen die Bearbeitung dieser App erlauben.", section: "editors", optional: true, icon: <UsersRound /> });
    if (branches.editors) next.push({ id: "editors-select", title: "Wer darf mitarbeiten?", description: "Wähle Personen aus, die diese App bearbeiten dürfen.", icon: <UserPlus /> });
    next.push({ id: "related", title: "Andere Apps verknüpfen?", description: "Optional kannst du passende Lösungen miteinander verbinden.", section: "related", optional: true, icon: <Link2 /> });
    if (branches.related) next.push({ id: "related-apps", title: "Verwandte Apps", description: "Wähle bestehende Apps aus dem Katalog aus.", icon: <Link2 /> });
    if (isAdmin) next.push({ id: "admin", title: "Sichtbarkeit verwalten", description: "Ordne die App Gruppen zu oder hebe sie hervor.", icon: <Sparkles /> });
    next.push({ id: "documentation", title: "Dokumentation ergänzen?", description: "Eine ausführliche Markdown-Beschreibung ist optional.", section: "documentation", optional: true, icon: <BookOpen /> });
    if (branches.documentation) next.push({ id: "markdown", title: "Dokumentation schreiben", description: "Diese Inhalte erscheinen in der Detailansicht der App.", icon: <BookOpen /> });
    next.push({ id: "review", title: "Alles bereit?", description: "Prüfe deine Angaben und erstelle die App.", icon: <Check /> });
    return next;
  })();

  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === currentId));
  const current = steps[currentIndex] || steps[0];
  const currentFields = fieldPairs[Number(current.id.replace("details-", ""))] || [];
  const previewIcon = getImageAssetUrl(formData.icon);

  useEffect(() => { headingRef.current?.focus(); }, [currentId]);
  useEffect(() => { if (branches.repository) fetchApi("/settings/repository-providers/available").then((response) => response.ok ? response.json() : []).then((value) => setProviders(Array.isArray(value) ? value : [])).catch(() => {}); }, [branches.repository]);
  useEffect(() => { if (isAdmin) fetchApi("/app-groups").then((response) => response.ok ? response.json() : []).then((value) => setGroups(Array.isArray(value) ? value : [])).catch(() => {}); }, [isAdmin]);
  useEffect(() => { if (branches.editors) fetchApi("/users").then((response) => response.ok ? response.json() : []).then((value) => { const users = Array.isArray(value) ? value : value.users || []; setAvailableUsers(users.filter((candidate: SystemUser) => !candidate.disabled && candidate.id !== user?.id)); }).catch(() => {}); }, [branches.editors, user?.id]);

  const payload = () => ({ ...formData, categories: formData.categories || [], techStack: formData.techStack || [], tags: formData.tags || [], customFields: formData.customFields || [], liveDemos: branches.resources ? links(formData.liveDemos) : [], repositories: (branches.resources || branches.repository) ? links(formData.repositories) : [], customLinks: branches.resources ? links(formData.customLinks) : [], markdownContent: branches.documentation ? formData.markdownContent || "" : "", bannerText: branches.banner ? formData.bannerText || "" : "", bannerType: branches.banner ? formData.bannerType : undefined, bannerTitle: branches.banner ? formData.bannerTitle || "" : "", bannerColor: branches.banner ? formData.bannerColor || "" : "", hasDeploymentAssistant: branches.deployment, showDocker: branches.deployment && formData.showDocker !== false, showCompose: branches.deployment && formData.showCompose !== false, showHelm: branches.deployment && formData.showHelm !== false, status: formData.status || DRAFT_STATUS });

  const save = async (final = false) => {
    if (!canCreateDraft) throw new Error("Bitte gib einen verfügbaren Namen und eine technische ID an.");
    if (final && nonDraft && (!(formData.categories?.length) || !formData.description?.trim())) throw new Error("Für diesen Status sind Kategorie und Kurzbeschreibung erforderlich.");
    if (!profileReady && !(await refreshUser())) throw new Error("Das Benutzerprofil ist noch nicht bereit.");
    setSaveState("saving"); setSaveError(null);
    const response = await fetchApi(draftId ? `/apps/${draftId}` : "/apps", { method: draftId ? "PUT" : "POST", body: JSON.stringify(payload()) });
    if (!response.ok) { const error = await response.json().catch(() => ({})); const message = (error as { message?: string }).message || "Speichern fehlgeschlagen."; setSaveState("error"); setSaveError(message); throw new Error(message); }
    const created = draftId ? null : await response.json() as AppConfig;
    const id = draftId || created?.id || formData.id!;
    if (!draftId) setDraftId(id);
    setSaveState("saved");
    if (final) { toast.success("Die App wurde erstellt."); router.push(`/apps/${id}`); }
    return id;
  };

  useEffect(() => {
    if (!draftId || !canCreateDraft || saveState === "saving") return;
    const timeout = window.setTimeout(() => { void save().catch(() => {}); }, 1000);
    return () => window.clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, branches]);

  const syncRepository = async () => {
    if (!repo.providerKey || !repo.projectPath) return;
    setSyncing(true);
    try {
      const id = await save();
      await saveRepositoryConnection(id);
      const response = await fetchApi(`/apps/${id}/repository/sync`, { method: "POST" });
      if (!response.ok) throw new Error("Repository-Synchronisation fehlgeschlagen.");
      const integration = await response.json() as GitLabIntegrationState;
      const snapshot = integration.snapshot;
      if (snapshot) setFormData((previous) => ({ ...previous, markdownContent: snapshot.readmeContent?.trim() || previous.markdownContent, description: snapshot.description?.trim() || previous.description, license: snapshot.license?.trim() || previous.license, tags: Array.from(new Set([...(previous.tags || []), ...(snapshot.topics || []).filter(Boolean)])), repositories: snapshot.projectWebUrl ? [...(previous.repositories || []).filter((item) => item.url !== snapshot.projectWebUrl), { label: "Repository", url: snapshot.projectWebUrl }] : previous.repositories, customHelmValues: snapshot.helmValuesContent?.trim() || previous.customHelmValues, customComposeCommand: snapshot.composeFileContent?.trim() || previous.customComposeCommand }));
      toast.success("Repositorydaten wurden übernommen.");
    } catch (error) { const message = error instanceof Error ? error.message : "Repository-Synchronisation fehlgeschlagen."; setSaveError(message); toast.danger(message); } finally { setSyncing(false); }
  };

  const saveRepositoryConnection = async (id: string) => {
    const linked = await fetchApi(`/apps/${id}/repository`, { method: "PUT", body: JSON.stringify(repo) });
    if (!linked.ok) throw new Error("Repository-Verknüpfung konnte nicht gespeichert werden.");
  };
  const saveEditors = async (id: string, userIds = Array.from(editorIds)) => {
    const response = await fetchApi(`/apps/${id}/editors`, { method: "PUT", body: JSON.stringify({ userIds }) });
    if (!response.ok) throw new Error("Bearbeiter konnten nicht gespeichert werden.");
  };
  const hasResource = !!(formData.liveDemos?.some((item) => item.url?.trim()) || formData.repositories?.some((item) => item.url?.trim()) || formData.customLinks?.some((item) => item.url?.trim()) || formData.docsUrl?.trim());
  const hasDockerSetup = !!(formData.dockerRepo?.trim() || formData.customDockerCommand?.trim());
  const hasHelmSetup = !!(formData.helmRepo?.trim() || formData.customHelmCommand?.trim());
  const validCurrent = () => {
    if (current.id === "name") return canCreateDraft;
    if (current.id === "categories") return !nonDraft || !!formData.categories?.length;
    if (current.id === "description") return !nonDraft || !!formData.description?.trim();
    if (current.id === "repo-project") return !!repo.providerKey && !!repo.projectPath.trim();
    if (current.id === "reuse") return !formData.isReuse || !!formData.reuseRequirements?.trim();
    if (current.id === "deployment-methods") return selectedMethods.length > 0;
    if (current.id === "deployment-docker") return hasDockerSetup;
    if (current.id === "deployment-compose") return !!formData.customComposeCommand?.trim();
    if (current.id === "deployment-helm") return hasHelmSetup;
    if (current.id === "source-links") return hasResource;
    if (current.id === "banner-content") return !!formData.bannerText?.trim();
    if (current.id === "markdown") return !!formData.markdownContent?.trim();
    return true;
  };
  const validationMessage = () => {
    if (current.id === "name") return idTaken ? "Die technische ID ist bereits vergeben." : "Gib einen App-Namen ein.";
    if (current.id === "categories") return "Wähle mindestens eine Kategorie, um die App zu veröffentlichen.";
    if (current.id === "description") return "Für den gewählten Status ist eine Kurzbeschreibung erforderlich.";
    if (current.id === "repo-project") return !repo.providerKey ? "Wähle einen Provider aus." : "Gib den Projektpfad an.";
    if (current.id === "reuse") return "Beschreibe die Voraussetzungen oder Grenzen für die Nachnutzung.";
    if (current.id === "deployment-methods") return "Wähle mindestens einen Installationsweg aus.";
    if (current.id === "deployment-docker") return "Gib ein Docker Image oder ein Docker-Kommando an.";
    if (current.id === "deployment-compose") return "Gib das Compose-Setup an.";
    if (current.id === "deployment-helm") return "Gib ein Helm Repository oder ein Helm-Kommando an.";
    if (current.id === "source-links") return "Füge mindestens einen Link oder eine Dokumentations-URL hinzu.";
    if (current.id === "banner-content") return "Gib einen Hinweistext ein.";
    if (current.id === "markdown") return "Schreibe eine kurze Dokumentation.";
    return null;
  };
  const validationIssues = () => {
    const issues: { id: StepId; label: string; message: string }[] = [];
    if (!canCreateDraft) issues.push({ id: "name", label: "Name und technische ID", message: idTaken ? "Die technische ID ist bereits vergeben." : "Name und technische ID fehlen." });
    if (nonDraft && !formData.categories?.length) issues.push({ id: "categories", label: "Kategorien", message: "Mindestens eine Kategorie fehlt." });
    if (nonDraft && !formData.description?.trim()) issues.push({ id: "description", label: "Kurzbeschreibung", message: "Für diesen Status erforderlich." });
    if (branches.repository && (!repo.providerKey || !repo.projectPath.trim())) issues.push({ id: "repo-project", label: "Repository", message: "Provider und Projektpfad sind erforderlich." });
    if (formData.isReuse && !formData.reuseRequirements?.trim()) issues.push({ id: "reuse", label: "Nachnutzung", message: "Voraussetzungen oder Grenzen fehlen." });
    if (branches.deployment && !selectedMethods.length) issues.push({ id: "deployment-methods", label: "Installationswege", message: "Wähle mindestens einen Weg." });
    if (branches.deployment && formData.showDocker !== false && !hasDockerSetup) issues.push({ id: "deployment-docker", label: "Docker", message: "Image oder Kommando fehlt." });
    if (branches.deployment && formData.showCompose !== false && !formData.customComposeCommand?.trim()) issues.push({ id: "deployment-compose", label: "Docker Compose", message: "Compose-Setup fehlt." });
    if (branches.deployment && formData.showHelm !== false && !hasHelmSetup) issues.push({ id: "deployment-helm", label: "Helm", message: "Repository oder Kommando fehlt." });
    if (branches.resources && !hasResource) issues.push({ id: "source-links", label: "Links", message: "Mindestens ein Link fehlt." });
    if (branches.banner && !formData.bannerText?.trim()) issues.push({ id: "banner-content", label: "Hinweis", message: "Hinweistext fehlt." });
    if (branches.documentation && !formData.markdownContent?.trim()) issues.push({ id: "markdown", label: "Dokumentation", message: "Dokumentation fehlt." });
    return issues;
  };
  const move = async (direction: 1 | -1) => {
    if (direction === 1 && !validCurrent()) { setAttemptedNext(true); return; }
    if (direction === 1 && current.id === "status" && nonDraft && !formData.categories?.length) { setCurrentId("categories"); setAttemptedNext(true); return; }
    if (direction === 1 && current.id === "name") { try { await save(); } catch { return; } }
    if (direction === 1 && current.id === "editors-select") { try { await saveEditors(await save()); setEditorsWereSaved(true); } catch (error) { setSaveError(error instanceof Error ? error.message : "Bearbeiter konnten nicht gespeichert werden."); return; } }
    const target = steps[currentIndex + direction];
    if (target) { setCurrentId(target.id); setAttemptedNext(false); if (direction === 1 && returnToReview) { setReturnToReview(false); } }
  };
  const edit = (id: StepId) => { setReturnToReview(true); setCurrentId(id); };
  const toggleList = (key: "tags" | "techStack", value: string) => { if (!value.trim()) return; setFormData((previous) => ({ ...previous, [key]: Array.from(new Set([...(previous[key] || []), value.trim()])) })); };
  const addRelated = async (app: AppConfig) => { try { const id = await save(); const response = await fetchApi(`/apps/${id}/related`, { method: "POST", body: JSON.stringify({ relatedAppId: app.id }) }); if (!response.ok) throw new Error(); setRelatedApps((value) => [...value, { id: app.id, name: app.name, icon: app.icon }]); setRelatedSearch(""); } catch { toast.danger("Verknüpfung konnte nicht gespeichert werden."); } };
  const removeRelated = async (relatedId: string) => { if (!draftId) return; try { const response = await fetchApi(`/apps/${draftId}/related/${relatedId}`, { method: "DELETE" }); if (!response.ok) throw new Error(); setRelatedApps((value) => value.filter((app) => app.id !== relatedId)); } catch { toast.danger("Verknüpfung konnte nicht entfernt werden."); } };
  const updateField = (key: string, value: string) => setFormData((previous) => { const next = [...(previous.customFields || [])].filter((field) => field.key !== key); if (value.trim()) next.push({ key, value }); return { ...previous, customFields: next }; });
  const fieldValue = (key: string) => formData.customFields?.find((field) => field.key === key)?.value || "";
  const reviewValue = (step: Step) => {
    if (step.id.startsWith("details-")) { const fields = fieldPairs[Number(step.id.replace("details-", ""))] || []; return fields.map((field) => fieldValue(field.key)).filter(Boolean).join(" · ") || "Nicht ergänzt"; }
    switch (step.id) {
      case "name": return formData.name || "Nicht ergänzt";
      case "logo": return formData.icon ? "Gewählt" : "Nicht ergänzt";
      case "categories": return formData.categories?.join(", ") || "Nicht ergänzt";
      case "status": return formData.status || DRAFT_STATUS;
      case "description": return formData.description || "Nicht ergänzt";
      case "metadata": return [formData.license, formData.tags?.join(", ")].filter(Boolean).join(" · ") || "Nicht ergänzt";
      case "repository": return branches.repository ? "Wird verbunden" : "Übersprungen";
      case "repo-project": return [providers.find((provider) => provider.key === repo.providerKey)?.label, repo.projectPath].filter(Boolean).join(" · ") || "Nicht ergänzt";
      case "repo-paths": return [repo.branch, repo.readmePath, repo.helmValuesPath, repo.composeFilePath].filter(Boolean).join(" · ") || "Standardwerte";
      case "reuse": return formData.isReuse ? "Ja" : "Nein";
      case "deployment": return branches.deployment ? "Ja" : "Nein";
      case "deployment-methods": return selectedMethods.join(", ") || "Nicht ergänzt";
      case "deployment-docker": return [formData.dockerRepo, formData.customDockerCommand].filter(Boolean).join(" · ") || "Nicht ergänzt";
      case "deployment-compose": return formData.customComposeCommand || "Nicht ergänzt";
      case "deployment-helm": return [formData.helmRepo, formData.customHelmCommand].filter(Boolean).join(" · ") || "Nicht ergänzt";
      case "resources": return branches.resources ? "Ja" : "Nein";
      case "live-links": return formData.liveDemos?.filter((item) => item.url?.trim()).length ? "Ergänzt" : "Nicht ergänzt";
      case "source-links": return hasResource ? "Ergänzt" : "Nicht ergänzt";
      case "presentation": return [formData.authority, formData.techStack?.join(", ")].filter(Boolean).join(" · ") || "Nicht ergänzt";
      case "banner": return branches.banner ? "Ja" : "Nein";
      case "banner-content": return formData.bannerText || "Nicht ergänzt";
      case "editors": return branches.editors ? "Ja" : "Nein";
      case "editors-select": return availableUsers.filter((candidate) => editorIds.has(candidate.id)).map((candidate) => candidate.username).join(", ") || "Keine ausgewählt";
      case "related": return branches.related ? "Ja" : "Nein";
      case "related-apps": return relatedApps.map((app) => app.name).join(", ") || "Nicht ergänzt";
      case "admin": return [groupIds.size ? `${groupIds.size} Gruppen` : "", formData.isFeatured ? "Ausgezeichnet" : ""].filter(Boolean).join(" · ") || "Nicht ergänzt";
      case "documentation": return branches.documentation ? "Ja" : "Nein";
      case "markdown": return formData.markdownContent ? "Ergänzt" : "Nicht ergänzt";
      default: return "Prüfen";
    }
  };

  const stage = () => {
    switch (current.id) {
      case "name": return <div className="space-y-5"><TextField isRequired isInvalid={idTaken || (attemptedNext && !formData.name?.trim())} onChange={(name) => setFormData((previous) => ({ ...previous, name, id: idEditing ? previous.id : slugify(name) }))}><Label>App-Name</Label><Input autoFocus value={formData.name || ""} placeholder="z. B. Digi-Sign Pro" /><FieldError>{idTaken ? "Diese technische ID wird bereits verwendet." : attemptedNext && !formData.name?.trim() ? "Gib einen App-Namen ein." : undefined}</FieldError></TextField><button type="button" onClick={() => setIdEditing((value) => !value)} className="flex items-center gap-2 text-sm font-semibold text-accent"><Pencil className="h-4 w-4" />Technische ID {idEditing ? "ausblenden" : "bearbeiten"}</button>{idEditing && <TextField isRequired onChange={(id) => setFormData((previous) => ({ ...previous, id: slugify(id) }))}><Label>Technische ID</Label><Input value={formData.id || ""} className="font-mono" /></TextField>}<p className="text-sm text-muted">{formData.id ? `Wird gespeichert als ${formData.id}` : "Die ID wird aus dem Namen erzeugt."}</p></div>;
      case "logo": return <div className="space-y-5"><button type="button" onClick={() => iconInput.current?.click()} className="group mx-auto flex h-44 w-44 items-center justify-center overflow-hidden rounded-[2rem] border-2 border-dashed border-accent/40 bg-surface-secondary text-6xl transition-[border-color,transform] duration-180 ease-out hover:border-accent active:scale-[0.98]">{previewIcon ? <Image src={previewIcon} alt="Logo-Vorschau" width={176} height={176} className="h-full w-full object-contain p-5" unoptimized /> : formData.icon || "🏛️"}</button><input ref={iconInput} type="file" accept="image/*" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { const url = await uploadFile("/upload/logo", file); setFormData((previous) => ({ ...previous, icon: url })); setIconUrl(url); } catch { toast.danger("Logo konnte nicht hochgeladen werden."); } finally { setUploading(false); event.target.value = ""; } }} /><div className="flex flex-wrap justify-center gap-2"><Button onPress={() => iconInput.current?.click()} isPending={uploading}><Upload className="h-4 w-4" />Logo hochladen</Button><Button variant="secondary" onPress={() => setShowEmojis((value) => !value)}>Symbol wählen</Button></div>{showEmojis && <div className="grid grid-cols-6 gap-2 rounded-2xl border border-border bg-surface-secondary p-3">{EMOJIS.map((emoji) => <Button key={emoji} isIconOnly variant={formData.icon === emoji ? "primary" : "ghost"} onPress={() => { setFormData((previous) => ({ ...previous, icon: emoji })); setShowEmojis(false); }} aria-label={`Symbol ${emoji}`}>{emoji}</Button>)}</div>}<TextField onChange={(value) => { setIconUrl(value); if (isImageAssetSource(value)) setFormData((previous) => ({ ...previous, icon: value })); }}><Label>Oder Bild-URL</Label><Input value={iconUrl} placeholder="https://…" /></TextField></div>;
      case "categories": return <div className="space-y-4"><p id="category-requirement" className="text-sm font-semibold text-foreground">Kategorien {nonDraft && <span className="text-danger">*</span>}</p><p className="text-sm text-muted">{nonDraft ? "Für diesen Status erforderlich." : "Für Entwürfe optional; vor der Veröffentlichung erforderlich."}</p><div role="group" aria-labelledby="category-requirement" className="flex flex-wrap gap-2">{CATEGORIES.map((category) => { const selected = formData.categories?.includes(category); return <Button key={category} variant={selected ? "primary" : "secondary"} size="sm" onPress={() => setFormData((previous) => ({ ...previous, categories: selected ? previous.categories?.filter((item) => item !== category) : [...(previous.categories || []), category] }))}>{category}</Button>; })}</div><div className="flex gap-2"><Input value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)} placeholder="Eigene Kategorie" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setFormData((previous) => ({ ...previous, categories: Array.from(new Set([...(previous.categories || []), categoryInput.trim()])).filter(Boolean) })); setCategoryInput(""); } }} /><Button variant="secondary" onPress={() => { setFormData((previous) => ({ ...previous, categories: Array.from(new Set([...(previous.categories || []), categoryInput.trim()])).filter(Boolean) })); setCategoryInput(""); }}>Hinzufügen</Button></div></div>;
      case "status": return <EditorStatusPicker value={formData.status} onChange={(status) => setFormData((previous) => ({ ...previous, status }))} />;
      case "description": return <TextField isRequired={nonDraft} isInvalid={attemptedNext && nonDraft && !formData.description?.trim()} onChange={(description) => setFormData((previous) => ({ ...previous, description }))}><Label>Kurzbeschreibung</Label><TextArea autoFocus value={formData.description || ""} placeholder="Wofür steht die App? Welche Wirkung hat sie im Alltag?" className="min-h-52" /><FieldError>{attemptedNext && nonDraft && !formData.description?.trim() ? "Für diesen Status ist eine Kurzbeschreibung erforderlich." : undefined}</FieldError></TextField>;
      case "metadata": return <div className="space-y-5"><TextField onChange={(license) => setFormData((previous) => ({ ...previous, license }))}><Label>Lizenz</Label><Input value={formData.license || ""} placeholder="z. B. MIT oder EUPL" /></TextField><Label>Schlagwörter</Label><div className="flex flex-wrap gap-2">{(formData.tags || []).map((tag) => <Chip key={tag} variant="soft">{tag}<button type="button" onClick={() => setFormData((previous) => ({ ...previous, tags: previous.tags?.filter((value) => value !== tag) }))}><X className="ml-1 h-3 w-3" /></button></Chip>)}</div><div className="flex gap-2"><Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="Schlagwort" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); toggleList("tags", tagInput); setTagInput(""); } }} /><Button variant="secondary" onPress={() => { toggleList("tags", tagInput); setTagInput(""); }}>Hinzufügen</Button></div></div>;
      case "repository": return <SectionGate title="Repository" description="Wir übernehmen auf Wunsch Beschreibung, Tags, Dokumentation und verfügbare Deployment-Dateien." enabled={branches.repository} onChange={(value) => setBranches((previous) => ({ ...previous, repository: value }))} icon={<FolderGit2 className="h-5 w-5" />} />;
      case "repo-project": return <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label>Provider <span className="text-danger">*</span></Label><Select aria-label="Repository-Provider auswählen" selectedKey={repo.providerKey || null} onSelectionChange={(key) => setRepo((previous) => ({ ...previous, providerKey: String(key) }))} isDisabled={!providers.length} isInvalid={attemptedNext && !repo.providerKey}><Select.Trigger className="h-12"><Select.Value>{({ selectedText }) => selectedText || (providers.length ? "Provider auswählen" : "Keine Provider verfügbar")}</Select.Value><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{providers.map((provider) => <ListBox.Item key={provider.key} id={provider.key} textValue={provider.label}>{provider.label}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover></Select></div><TextField isRequired isInvalid={attemptedNext && !repo.projectPath.trim()} onChange={(projectPath) => setRepo((previous) => ({ ...previous, projectPath }))}><Label>Projektpfad</Label><Input value={repo.projectPath} placeholder="gruppe/projekt" /></TextField></div>;
      case "repo-paths": return <div className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><TextField onChange={(branch) => setRepo((previous) => ({ ...previous, branch }))}><Label>Branch oder Ref</Label><Input value={repo.branch} placeholder="Standard-Branch" /></TextField><TextField onChange={(readmePath) => setRepo((previous) => ({ ...previous, readmePath }))}><Label>README-Pfad</Label><Input value={repo.readmePath} placeholder="README.md" /></TextField><TextField onChange={(helmValuesPath) => setRepo((previous) => ({ ...previous, helmValuesPath }))}><Label>Helm Values</Label><Input value={repo.helmValuesPath} placeholder="chart/values.yaml" /></TextField><TextField onChange={(composeFilePath) => setRepo((previous) => ({ ...previous, composeFilePath }))}><Label>Compose-Datei</Label><Input value={repo.composeFilePath} placeholder="docker-compose.yml" /></TextField></div><Button variant="secondary" isDisabled={!repo.providerKey || !repo.projectPath} isPending={syncing} onPress={syncRepository}><FolderGit2 className="h-4 w-4" />Jetzt importieren</Button></div>;
      case "reuse": return <div className="space-y-5"><SectionGate title="Nachnutzung" description="Andere Stellen können die App als bestehende Lösung verwenden." enabled={!!formData.isReuse} onChange={(value) => setFormData((previous) => ({ ...previous, isReuse: value }))} icon={<Layers className="h-5 w-5" />} />{formData.isReuse && <TextField isRequired isInvalid={attemptedNext && !formData.reuseRequirements?.trim()} onChange={(reuseRequirements) => setFormData((previous) => ({ ...previous, reuseRequirements }))}><Label>Voraussetzungen und Grenzen</Label><TextArea value={formData.reuseRequirements || ""} placeholder="Welche Stellen können die App nachnutzen?" /><FieldError>{attemptedNext && !formData.reuseRequirements?.trim() ? "Bitte beschreibe die Voraussetzungen oder Grenzen." : undefined}</FieldError></TextField>}</div>;
      case "deployment": return <SectionGate title="Installationshilfe" description="Lege Installationswege und die dazugehörigen Informationen fest." enabled={branches.deployment} onChange={(value) => setBranches((previous) => ({ ...previous, deployment: value }))} icon={<Rocket className="h-5 w-5" />} />;
      case "deployment-methods": return <div className="space-y-4"><p className="text-sm text-muted">Wähle mindestens einen Installationsweg. <span className="text-danger">*</span></p><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{(["Docker", "Docker Compose", "Helm"] as const).map((label, index) => { const key = index === 0 ? "showDocker" : index === 1 ? "showCompose" : "showHelm"; const selected = formData[key] !== false; return <ToggleButton key={key} isSelected={selected} onChange={(isSelected) => setFormData((previous) => ({ ...previous, [key]: isSelected }))} className="h-12 justify-center">{selected && <Check className="h-4 w-4" />}{label}</ToggleButton>; })}</div></div>;
      case "deployment-docker": return <div className="space-y-5"><p className="text-sm text-muted">Gib ein Docker Image oder ein Docker-Kommando an. <span className="text-danger">*</span></p><TextField isInvalid={attemptedNext && !hasDockerSetup} onChange={(dockerRepo) => setFormData((previous) => ({ ...previous, dockerRepo }))}><Label>Docker Image</Label><Input value={formData.dockerRepo || ""} placeholder="image:latest" /></TextField><TextField isInvalid={attemptedNext && !hasDockerSetup} onChange={(customDockerCommand) => setFormData((previous) => ({ ...previous, customDockerCommand }))}><Label>Docker-Kommando</Label><TextArea value={formData.customDockerCommand || ""} placeholder="docker run …" /></TextField><TextField onChange={(customDockerNote) => setFormData((previous) => ({ ...previous, customDockerNote }))}><Label>Hinweis</Label><Input value={formData.customDockerNote || ""} placeholder="Ports, Secrets oder Startparameter" /></TextField></div>;
      case "deployment-compose": return <div className="space-y-5"><TextField isRequired isInvalid={attemptedNext && !formData.customComposeCommand?.trim()} onChange={(customComposeCommand) => setFormData((previous) => ({ ...previous, customComposeCommand }))}><Label>Compose-Setup</Label><TextArea value={formData.customComposeCommand || ""} placeholder="services:\n  app: …" /><FieldError>{attemptedNext && !formData.customComposeCommand?.trim() ? "Das Compose-Setup ist erforderlich." : undefined}</FieldError></TextField><TextField onChange={(customComposeNote) => setFormData((previous) => ({ ...previous, customComposeNote }))}><Label>Hinweis</Label><Input value={formData.customComposeNote || ""} /></TextField></div>;
      case "deployment-helm": return <div className="space-y-5"><p className="text-sm text-muted">Gib ein Helm Repository oder ein Helm-Kommando an. <span className="text-danger">*</span></p><TextField isInvalid={attemptedNext && !hasHelmSetup} onChange={(helmRepo) => setFormData((previous) => ({ ...previous, helmRepo }))}><Label>Helm Repository</Label><Input value={formData.helmRepo || ""} placeholder="oci://…" /></TextField><TextField isInvalid={attemptedNext && !hasHelmSetup} onChange={(customHelmCommand) => setFormData((previous) => ({ ...previous, customHelmCommand }))}><Label>Helm-Kommando</Label><TextArea value={formData.customHelmCommand || ""} placeholder="helm install …" /></TextField><TextField onChange={(customHelmValues) => setFormData((previous) => ({ ...previous, customHelmValues }))}><Label>Values.yaml</Label><TextArea value={formData.customHelmValues || ""} /></TextField><TextField onChange={(customHelmNote) => setFormData((previous) => ({ ...previous, customHelmNote }))}><Label>Hinweis</Label><Input value={formData.customHelmNote || ""} placeholder="Zusatz für die Einführung" /></TextField></div>;
      case "resources": return <SectionGate title="Links" description="Sammle die wichtigsten Einstiege, Ressourcen und Dokumentationslinks." enabled={branches.resources} onChange={(value) => setBranches((previous) => ({ ...previous, resources: value }))} icon={<Link2 className="h-5 w-5" />} />;
      case "live-links": return <LinkListEditor title="Live-Zugänge" icon={<Link2 className="h-4 w-4" />} items={formData.liveDemos || []} onChange={(liveDemos) => setFormData((previous) => ({ ...previous, liveDemos }))} addLabel="Hinzufügen" placeholderLabel="Produktivumgebung" placeholderUrl="https://…" />;
      case "source-links": return <div className="space-y-8"><p className="text-sm text-muted">Füge mindestens einen Quellcode-, Ressourcen- oder Dokumentationslink hinzu. <span className="text-danger">*</span></p><LinkListEditor title="Quellcode" icon={<FolderGit2 className="h-4 w-4" />} items={formData.repositories || []} onChange={(repositories) => setFormData((previous) => ({ ...previous, repositories }))} addLabel="Hinzufügen" placeholderLabel="Repository" placeholderUrl="https://…" /><LinkListEditor title="Weitere Ressourcen" icon={<Link2 className="h-4 w-4" />} items={formData.customLinks || []} onChange={(customLinks) => setFormData((previous) => ({ ...previous, customLinks }))} addLabel="Hinzufügen" placeholderLabel="Ressource" placeholderUrl="https://…" /><TextField onChange={(docsUrl) => setFormData((previous) => ({ ...previous, docsUrl }))}><Label>Dokumentations-URL</Label><Input value={formData.docsUrl || ""} placeholder="https://…" /></TextField></div>;
      case "presentation": return <div className="space-y-5"><TextField onChange={(authority) => setFormData((previous) => ({ ...previous, authority }))}><Label>Herausgeber</Label><Input value={formData.authority || ""} placeholder="z. B. Stadtverwaltung" /></TextField><Label>Technologien</Label><div className="flex flex-wrap gap-2">{(formData.techStack || []).map((technology) => <Chip key={technology} variant="soft">{technology}<button type="button" onClick={() => setFormData((previous) => ({ ...previous, techStack: previous.techStack?.filter((value) => value !== technology) }))}><X className="ml-1 h-3 w-3" /></button></Chip>)}</div><div className="flex gap-2"><Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="z. B. React" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); toggleList("techStack", tagInput); setTagInput(""); } }} /><Button variant="secondary" onPress={() => { toggleList("techStack", tagInput); setTagInput(""); }}>Hinzufügen</Button></div></div>;
      case "banner": return <SectionGate title="Hinweis" description="Zeige bei Bedarf einen Status-, Warn- oder Informationshinweis." enabled={branches.banner} onChange={(value) => setBranches((previous) => ({ ...previous, banner: value }))} icon={<CircleHelp className="h-5 w-5" />} />;
      case "banner-content": return <div className="space-y-5"><div className="space-y-2"><Label>Art des Hinweises</Label><Select aria-label="Art des Hinweises" selectedKey={formData.bannerType || "info"} onSelectionChange={(key) => setFormData((previous) => ({ ...previous, bannerType: String(key) as AppConfig["bannerType"] }))}><Select.Trigger className="h-12"><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox><ListBox.Item id="info" textValue="Info">Info<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="warning" textValue="Warnung">Warnung<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="danger" textValue="Kritisch">Kritisch<ListBox.ItemIndicator /></ListBox.Item></ListBox></Select.Popover></Select></div><TextField onChange={(bannerTitle) => setFormData((previous) => ({ ...previous, bannerTitle }))}><Label>Überschrift</Label><Input value={formData.bannerTitle || ""} placeholder="Optional" /></TextField><TextField isRequired isInvalid={attemptedNext && !formData.bannerText?.trim()} onChange={(bannerText) => setFormData((previous) => ({ ...previous, bannerText }))}><Label>Hinweistext</Label><TextArea value={formData.bannerText || ""} /><FieldError>{attemptedNext && !formData.bannerText?.trim() ? "Der Hinweistext ist erforderlich." : undefined}</FieldError></TextField></div>;
      case "editors": return <SectionGate title="Bearbeiter" description="Ausgewählte Personen können diese App bearbeiten, ohne die Eigentümerschaft zu übernehmen." enabled={branches.editors} onChange={(value) => setBranches((previous) => ({ ...previous, editors: value }))} icon={<UsersRound className="h-5 w-5" />} />;
      case "editors-select": { const filteredUsers = availableUsers.filter((candidate) => !editorSearch.trim() || [candidate.username, candidate.email, candidate.role].filter(Boolean).some((value) => value!.toLowerCase().includes(editorSearch.trim().toLowerCase()))); const selectedUsers = availableUsers.filter((candidate) => editorIds.has(candidate.id)); const toggleEditor = (id: string) => setEditorIds((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); return <div className="space-y-5">{selectedUsers.length > 0 && <div className="space-y-2"><Label>Ausgewählt</Label><div className="flex flex-wrap gap-2">{selectedUsers.map((candidate) => <Chip key={candidate.id} variant="soft" color="accent" className="gap-1">{candidate.username}<button type="button" aria-label={`${candidate.username} entfernen`} onClick={() => toggleEditor(candidate.id)}><X className="h-3 w-3" /></button></Chip>)}</div></div>}<div className="space-y-2"><Label>Personen suchen</Label><Input className="w-full" value={editorSearch} onChange={(event) => setEditorSearch(event.target.value)} placeholder="Name oder E-Mail-Adresse" /></div><div className="overflow-hidden rounded-xl border border-border">{filteredUsers.slice(0, 10).map((candidate) => { const selected = editorIds.has(candidate.id); return <button key={candidate.id} type="button" onClick={() => toggleEditor(candidate.id)} className={`flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left last:border-b-0 ${selected ? "bg-accent/10" : "hover:bg-surface-secondary"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${selected ? "bg-accent text-accent-foreground" : "bg-surface-secondary text-muted"}`}>{candidate.username[0]?.toUpperCase() || "?"}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{candidate.username}</span><span className="block truncate text-xs text-muted">{candidate.email}</span></span>{selected ? <Check className="h-4 w-4 text-accent" /> : <UserPlus className="h-4 w-4 text-muted" />}</button>; })}{filteredUsers.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">Keine passenden Personen gefunden.</p>}</div></div>; }
      case "related": return <SectionGate title="Verwandte Apps" description="Verknüpfe die App mit bestehenden Lösungen im Katalog." enabled={branches.related} onChange={(value) => setBranches((previous) => ({ ...previous, related: value }))} icon={<Link2 className="h-5 w-5" />} />;
      case "related-apps": { const available = existingApps.filter((app) => !relatedApps.some((related) => related.id === app.id) && app.id !== draftId && (!relatedSearch || app.name.toLowerCase().includes(relatedSearch.toLowerCase()) || app.id.includes(relatedSearch))); return <div className="space-y-5">{relatedApps.length > 0 && <div className="space-y-2"><Label>Ausgewählte Apps</Label><div className="grid gap-2 sm:grid-cols-2">{relatedApps.map((app) => { const icon = getImageAssetUrl(app.icon); return <div key={app.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface-secondary px-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-sm">{icon ? <Image src={icon} alt="" width={28} height={28} className="h-full w-full object-contain p-0.5" unoptimized /> : app.icon || "🏛️"}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{app.name}</span><Button isIconOnly size="sm" variant="secondary" aria-label={`${app.name} entfernen`} onPress={() => removeRelated(app.id)}><X className="h-4 w-4" /></Button></div>; })}</div></div>}<div className="space-y-2"><Label>App suchen und verknüpfen</Label><Input className="w-full" value={relatedSearch} onChange={(event) => setRelatedSearch(event.target.value)} placeholder="App-Name oder technische ID suchen" />{relatedSearch && <div className="overflow-hidden rounded-xl border border-border">{available.slice(0, 8).map((app) => <Button key={app.id} variant="ghost" fullWidth className="h-12 justify-between rounded-none border-b border-border last:border-b-0" onPress={() => addRelated(app)}>{app.name}<ArrowRight className="h-4 w-4" /></Button>)}{available.length === 0 && <p className="px-3 py-3 text-sm text-muted">Keine passende App gefunden.</p>}</div>}</div></div>; }
      case "admin": return <div className="space-y-5"><div className="space-y-2">{groups.map((group) => <div key={group.id} className="flex items-center justify-between rounded-2xl border border-border p-4"><div><p className="font-semibold">{group.name}</p><p className="text-xs text-muted">{group.description}</p></div><Switch isSelected={groupIds.has(group.id)} onChange={(value) => setGroupIds((previous) => { const next = new Set(previous); if (value) next.add(group.id); else next.delete(group.id); return next; })}><Switch.Control><Switch.Thumb /></Switch.Control></Switch></div>)}</div><div className="flex items-center justify-between rounded-2xl border border-border p-4"><div><p className="font-semibold">Ausgezeichnet</p><p className="text-sm text-muted">Auf der Startseite hervorheben.</p></div><Switch isSelected={!!formData.isFeatured} onChange={(isFeatured) => setFormData((previous) => ({ ...previous, isFeatured }))}><Switch.Control><Switch.Thumb /></Switch.Control></Switch></div></div>;
      case "documentation": return <SectionGate title="Markdown-Dokumentation" description="Beschreibe die App für die spätere Detailansicht ausführlicher." enabled={branches.documentation} onChange={(value) => setBranches((previous) => ({ ...previous, documentation: value }))} icon={<BookOpen className="h-5 w-5" />} />;
      case "markdown": return <TextField isRequired isInvalid={attemptedNext && !formData.markdownContent?.trim()} onChange={(markdownContent) => setFormData((previous) => ({ ...previous, markdownContent }))}><Label>Dokumentation</Label><TextArea value={formData.markdownContent || ""} placeholder={`# ${formData.name || "App"}\n\nBeschreibe die App …`} className="min-h-[28rem] font-mono" /><FieldError>{attemptedNext && !formData.markdownContent?.trim() ? "Die Dokumentation ist erforderlich." : undefined}</FieldError></TextField>;
      case "review": { const issues = validationIssues(); const reviewSteps = steps.filter((step) => step.id !== "review"); return <div className="space-y-4">{issues.length ? <Alert color="danger"><Alert.Content><Alert.Title>Noch {issues.length} {issues.length === 1 ? "Angabe" : "Angaben"} offen</Alert.Title><Alert.Description><div className="mt-2 space-y-2">{issues.map((issue) => <button key={issue.id} type="button" onClick={() => edit(issue.id)} className="block text-left underline underline-offset-2">{issue.label}: {issue.message}</button>)}</div></Alert.Description></Alert.Content></Alert> : <Alert color="accent"><Alert.Content><Alert.Title>Bereit zum Erstellen</Alert.Title><Alert.Description>Alle {reviewSteps.length} durchlaufenen Schritte sind hier aufgeführt und direkt bearbeitbar.</Alert.Description></Alert.Content></Alert>}<div className="grid gap-3 sm:grid-cols-2">{reviewSteps.map((step) => <button key={step.id} type="button" onClick={() => edit(step.id)} className="rounded-2xl border border-border bg-surface p-4 text-left hover:border-accent/40"><p className="text-xs font-bold uppercase tracking-wider text-muted">{step.title}</p><p className="mt-1 truncate font-semibold text-foreground">{reviewValue(step)}</p></button>)}</div></div>; }
      default: if (current.id.startsWith("details-")) return <div className="grid gap-5 sm:grid-cols-2">{currentFields.map((field) => <TextField key={field.key} onChange={(value) => updateField(field.key, value)}><Label>{field.label}</Label><Input value={fieldValue(field.key)} placeholder={field.label} /></TextField>)}</div>;
    }
  };

  const finish = async () => { if (validationIssues().length) { setAttemptedNext(true); return; } try { const id = await save(); if (branches.repository) await saveRepositoryConnection(id); if (branches.editors || editorsWereSaved) await saveEditors(id, branches.editors ? Array.from(editorIds) : []); for (const groupId of groupIds) await fetchApi(`/app-groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ appId: id }) }); await save(true); } catch (error) { const message = error instanceof Error ? error.message : "Die App konnte nicht erstellt werden."; setSaveError(message); toast.danger(message); } };
  const requestExit = () => {
    if ((saveState === "saving" || saveState === "error") && !window.confirm("Der Entwurf wird noch gespeichert. Möchtest du die Erstellung wirklich verlassen?")) return;
    router.push(backUrl);
  };
  const handleStageKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (event.defaultPrevented || event.key !== "Enter" || target.tagName === "TEXTAREA" || target.closest("button")) return;
    event.preventDefault();
    if (current.id === "review") void finish();
    else if (returnToReview) { if (!validCurrent()) setAttemptedNext(true); else setCurrentId("review"); }
    else void move(1);
  };

  return <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl flex-col px-4 pb-28 pt-6 sm:px-6">
    <header className="sticky top-14 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6"><div className="flex items-center justify-between gap-4"><Button variant="ghost" size="sm" onPress={requestExit}><ArrowLeft className="h-4 w-4" />Verlassen</Button><div className="text-right" aria-live="polite"><p className="text-xs font-semibold text-muted">{saveState === "saving" ? "Speichert …" : saveState === "saved" ? "Entwurf gespeichert" : saveState === "error" ? "Speichern fehlgeschlagen" : copySource ? "Kopie wird erstellt" : "Neue App"}</p><p className="text-sm font-semibold text-foreground">Schritt {currentIndex + 1} von {steps.length}</p></div></div><ProgressBar aria-label="Fortschritt der App-Erstellung" value={((currentIndex + 1) / steps.length) * 100} className="mt-3"><ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track></ProgressBar></header>
    <main onKeyDown={handleStageKeyDown} className="flex flex-1 items-center justify-center py-8"><section className="w-full max-w-2xl px-2 py-6 sm:px-8 sm:py-10"><StepVisual step={current} formData={formData} /><p className="mt-7 text-center text-xs font-bold uppercase tracking-[0.2em] text-accent">{current.optional ? "Optional" : "App erstellen"}</p><h1 ref={headingRef} tabIndex={-1} className="mt-2 text-center text-2xl font-bold tracking-tight text-foreground outline-none sm:text-3xl">{current.title}</h1><p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-muted">{current.description}</p><div className="mt-8">{stage()}</div>{attemptedNext && !validCurrent() && current.id !== "name" && current.id !== "description" && <p className="mt-4 text-sm font-medium text-danger" role="status">{validationMessage()}</p>}{saveError && <Alert color="danger" className="mt-5"><Alert.Content><Alert.Description>{saveError}</Alert.Description></Alert.Content></Alert>}</section></main>
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3"><Button variant="secondary" isDisabled={currentIndex === 0} onPress={() => move(-1)}><ArrowLeft className="h-4 w-4" />Zurück</Button>{current.id === "review" ? <Button isPending={saveState === "saving"} onPress={finish}>App erstellen<Check className="h-4 w-4" /></Button> : <Button onPress={() => returnToReview ? (validCurrent() ? setCurrentId("review") : setAttemptedNext(true)) : move(1)}>{returnToReview ? "Zur Übersicht" : "Weiter"}<ArrowRight className="h-4 w-4" /></Button>}</div></footer>
  </div>;
}
