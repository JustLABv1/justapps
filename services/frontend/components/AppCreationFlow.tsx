"use client";

import { AppCard } from "@/components/AppCard";
import { Alert } from "@/components/panelui/alert";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { ChoiceCards } from "@/components/panelui/choice-cards";
import { Combobox } from "@/components/panelui/combobox";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Label } from "@/components/panelui/label";
import { Menu } from "@/components/panelui/menu";
import { Select } from "@/components/panelui/select";
import { Steps } from "@/components/panelui/steps";
import { Textarea } from "@/components/panelui/textarea";
import { AppConfig, GitLabIntegrationState, GitLabProviderSummary } from "@/config/apps";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { suggestAppCreation, type AppCreationSuggestionResponse } from "@/lib/ai";
import { fetchApi, uploadFile } from "@/lib/api";
import { DRAFT_STATUS } from "@/lib/appStatus";
import { getImageAssetUrl } from "@/lib/assets";
import { toast } from "@/lib/toast";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, FolderGit2, Globe2, LockKeyhole, PencilLine, Smile, Sparkles, Upload,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

const CATEGORIES = ["Verwaltung", "Kommunikation", "Infrastruktur", "Sicherheit", "Datenanalyse", "Dokumentenmanagement", "Projektmanagement", "Bürgerdienste", "Geodaten", "Finanzen", "Personal", "Bildung", "Gesundheit", "Umwelt", "Verkehr", "KI & Automatisierung"];
const EMOJIS = ["🏛️", "📊", "💬", "🔐", "📅", "🚀", "🛠️", "📱", "🛡️", "⚙️", "📦", "📈", "🔑", "🏙️", "👥", "🗺️", "💰", "📝", "🌐", "🤖", "📧", "🗂️", "🧭", "🧩"];

/** How the person starts: the first step's choice. */
type StartMethod = "repository" | "ai" | "manual";
type RepositoryInput = { providerKey: string; projectPath: string; branch: string; readmePath: string; helmValuesPath: string; composeFilePath: string };

const STEP_START = 0;
const STEP_BASICS = 1;
const STEP_REVIEW = 2;
const PUBLIC_SCOPE = "public";

export type AppCreationSpace = { id: string; name: string };

export interface AppCreationFlowProps {
  availableSpaces?: AppCreationSpace[];
  existingApps: AppConfig[];
  initialFormData?: Partial<AppConfig> | null;
  copySource?: { id: string; name: string } | null;
  /** Where the new draft is opened for the rest of its details. */
  editHref: (id: string) => string;
}

const emptyApp = (): Partial<AppConfig> => ({
  categories: [], techStack: [], tags: [], liveDemos: [], repositories: [], customLinks: [], customFields: [],
  icon: "🏛️", license: "MIT",
});

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const links = (items?: { label?: string; url?: string }[]) => (items || []).filter((item) => item.url?.trim()).map((item) => ({ label: item.label?.trim() || "Link", url: item.url!.trim() }));

const formatAIAssistantError = (error: unknown) => {
  const message = error instanceof Error ? error.message.trim() : "";
  const normalized = message.toLowerCase();
  if (!message || /failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return "Der AI-Service ist momentan nicht erreichbar. Prüfe die Verbindung und die AI-Provider-Konfiguration und versuche es erneut.";
  }
  if (normalized.includes("invalid structured payload") || normalized.includes("invalid changelog payload") || normalized.includes("app-vorschlag war unvollständig")) {
    return "Die KI hat eine unvollständige oder ungültige Antwort geliefert. Bitte starte die Analyse erneut.";
  }
  if (normalized.includes("kein aktiver ai-provider")) {
    return "Es ist kein aktiver AI-Provider konfiguriert. Bitte richte zuerst einen Provider in der Verwaltung ein.";
  }
  return message;
};

/** Fields a repository import fills in, merged over what is already there. */
function mergeRepositorySnapshot(app: Partial<AppConfig>, snapshot: GitLabIntegrationState["snapshot"]): Partial<AppConfig> {
  if (!snapshot) return app;
  return {
    ...app,
    markdownContent: snapshot.readmeContent?.trim() || app.markdownContent,
    description: app.description?.trim() || snapshot.description?.trim() || app.description,
    license: snapshot.license?.trim() || app.license,
    tags: Array.from(new Set([...(app.tags || []), ...(snapshot.topics || []).filter(Boolean)])),
    repositories: snapshot.projectWebUrl
      ? [...(app.repositories || []).filter((item) => item.url !== snapshot.projectWebUrl), { label: "Repository", url: snapshot.projectWebUrl }]
      : app.repositories,
    customHelmValues: snapshot.helmValuesContent?.trim() || app.customHelmValues,
    customComposeCommand: snapshot.composeFileContent?.trim() || app.customComposeCommand,
  };
}

/** What a create request sends: always a draft, with the install paths the data supports. */
function toPayload(app: Partial<AppConfig>) {
  const docker = !!(app.dockerRepo?.trim() || app.customDockerCommand?.trim());
  const compose = !!app.customComposeCommand?.trim();
  const helm = !!(app.helmRepo?.trim() || app.customHelmCommand?.trim());
  return {
    ...app,
    name: app.name?.trim(),
    description: app.description?.trim() || "",
    status: DRAFT_STATUS,
    categories: app.categories || [],
    techStack: app.techStack || [],
    tags: app.tags || [],
    customFields: app.customFields || [],
    liveDemos: links(app.liveDemos),
    repositories: links(app.repositories),
    customLinks: links(app.customLinks),
    hasDeploymentAssistant: docker || compose || helm,
    showDocker: docker,
    showCompose: compose,
    showHelm: helm,
  };
}

export function AppCreationFlow({ existingApps, initialFormData = null, copySource = null, availableSpaces = [], editHref }: AppCreationFlowProps) {
  const router = useRouter();
  const { user, profileReady, refreshUser } = useAuth();
  const { settings } = useSettings();
  const isAdmin = user?.role === "admin";
  const aiAvailable = settings.aiEnabled;
  const backUrl = initialFormData?.spaceId ? "/spaces" : isAdmin ? "/verwaltung/katalog/apps" : "/meine-apps";

  const [step, setStep] = useState(copySource ? STEP_BASICS : STEP_START);
  const [method, setMethod] = useState<StartMethod>(aiAvailable ? "repository" : "manual");
  const [formData, setFormData] = useState<Partial<AppConfig>>(() => {
    const initial = { ...emptyApp(), ...(initialFormData || {}) };
    return { ...initial, id: initial.id || (initial.name ? slugify(initial.name) : "") };
  });
  const [idEditing, setIdEditing] = useState(false);
  const [providers, setProviders] = useState<GitLabProviderSummary[]>([]);
  const [repo, setRepo] = useState<RepositoryInput>({ providerKey: "", projectPath: "", branch: "", readmePath: "", helmValuesPath: "", composeFilePath: "" });
  const [repoOptionsOpen, setRepoOptionsOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<AppCreationSuggestionResponse | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const iconInput = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const name = formData.name?.trim() || "";
  const idTaken = !!formData.id?.trim() && existingApps.some((app) => app.id === formData.id);
  const basicsValid = !!name && !!formData.id?.trim() && !idTaken;
  const repositoryReady = !!repo.providerKey && !!repo.projectPath.trim();
  const connectRepository = method === "repository" && repositoryReady;
  const space = availableSpaces.find((item) => item.id === formData.spaceId);

  const categoryOptions = useMemo(() => {
    const known = new Set(CATEGORIES);
    existingApps.forEach((app) => app.categories?.forEach((category) => category && known.add(category)));
    formData.categories?.forEach((category) => known.add(category));
    return Array.from(known).sort((a, b) => a.localeCompare(b, "de"));
  }, [existingApps, formData.categories]);

  useEffect(() => {
    if (method !== "repository" || providers.length) return;
    fetchApi("/settings/repository-providers/available")
      .then((response) => (response.ok ? response.json() : []))
      .then((value) => {
        const list: GitLabProviderSummary[] = Array.isArray(value) ? value : [];
        setProviders(list);
        if (list.length === 1) setRepo((previous) => ({ ...previous, providerKey: previous.providerKey || list[0].key }));
      })
      .catch(() => {});
  }, [method, providers.length]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const update = (patch: Partial<AppConfig>) => setFormData((previous) => ({ ...previous, ...patch }));

  /** Applies an AI suggestion to the form; nothing is saved yet. */
  const applySuggestion = (result: AppCreationSuggestionResponse) => {
    const snapshot = result.repositorySnapshot;
    const readme = snapshot?.readmeContent?.trim();
    setFormData((previous) => ({
      ...previous,
      name: result.name || previous.name,
      id: result.id || slugify(result.name) || previous.id,
      description: result.description || snapshot?.description || previous.description,
      categories: result.categories.length ? result.categories : previous.categories,
      tags: Array.from(new Set([...(result.tags.length ? result.tags : previous.tags || []), ...(snapshot?.topics || [])])),
      techStack: result.techStack.length ? result.techStack : previous.techStack,
      license: result.license || snapshot?.license || previous.license,
      isReuse: previous.isReuse || result.isReuse,
      reuseRequirements: result.reuseRequirements || previous.reuseRequirements,
      // A repository README is the canonical documentation; keep it verbatim.
      markdownContent: readme || result.markdownContent || previous.markdownContent,
      repositories: snapshot?.projectWebUrl
        ? [...(previous.repositories || []).filter((item) => item.url !== snapshot.projectWebUrl), { label: "Repository", url: snapshot.projectWebUrl }]
        : previous.repositories,
      dockerRepo: result.dockerRepo || previous.dockerRepo,
      customDockerCommand: result.customDockerCommand || previous.customDockerCommand,
      customComposeCommand: result.customComposeCommand || snapshot?.composeFileContent || previous.customComposeCommand,
      helmRepo: result.helmRepo || previous.helmRepo,
      customHelmCommand: result.customHelmCommand || previous.customHelmCommand,
      customHelmValues: result.customHelmValues || snapshot?.helmValuesContent || previous.customHelmValues,
    }));
    if (result.repositoryScan) {
      const scan = result.repositoryScan;
      setRepo((previous) => ({
        ...previous,
        providerKey: scan.providerKey || previous.providerKey,
        projectPath: scan.projectPath || previous.projectPath,
        branch: scan.branch || previous.branch,
        readmePath: scan.readmePath || previous.readmePath,
        helmValuesPath: scan.helmValuesPath || previous.helmValuesPath,
        composeFilePath: scan.composeFilePath || previous.composeFilePath,
      }));
    }
    setSuggestion(result);
  };

  /** Step 1: import or generate, then move on to the basics. */
  const submitStart = async (event?: FormEvent) => {
    event?.preventDefault();
    setStartError(null);
    if (method === "manual") {
      setStep(STEP_BASICS);
      return;
    }
    if (method === "ai" && !aiBrief.trim()) {
      setStartError("Beschreibe kurz, was die App leisten soll.");
      return;
    }
    if (method === "repository" && !repositoryReady) {
      setStartError(repo.providerKey ? "Gib den Projektpfad oder die Repository-URL an." : "Wähle einen Repository-Provider.");
      return;
    }
    // Without AI, a repository is connected and imported when the draft is created.
    if (method === "repository" && !aiAvailable) {
      setStep(STEP_BASICS);
      return;
    }
    setAnalyzing(true);
    try {
      const scanRepository = method === "repository";
      const result = await suggestAppCreation({
        brief: aiBrief.trim(),
        name: formData.name || "",
        description: formData.description || "",
        markdownContent: formData.markdownContent || "",
        scanRepository,
        repository: scanRepository ? { ...repo, readmeContent: "", topics: [], helmValuesContent: "", composeFileContent: "" } : undefined,
      });
      applySuggestion(result);
      setAttempted(false);
      setStep(STEP_BASICS);
    } catch (error) {
      setStartError(formatAIAssistantError(error));
    } finally {
      setAnalyzing(false);
    }
  };

  const submitBasics = (event?: FormEvent) => {
    event?.preventDefault();
    if (!basicsValid) {
      setAttempted(true);
      return;
    }
    setStep(STEP_REVIEW);
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      update({ icon: await uploadFile("/upload/logo", file) });
    } catch {
      toast.danger("Logo konnte nicht hochgeladen werden.");
    } finally {
      setUploading(false);
    }
  };

  /** Step 3: create the draft, connect the repository, and open it in the editor. */
  const create = async () => {
    if (!basicsValid) {
      setAttempted(true);
      setStep(STEP_BASICS);
      return;
    }
    if (!isAdmin && !user?.canSubmitApps) {
      setCreateError("Sie dürfen keine Apps erstellen.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      if (!profileReady && !(await refreshUser())) throw new Error("Das Benutzerprofil ist noch nicht bereit.");
      const response = await fetchApi("/apps", { method: "POST", body: JSON.stringify(toPayload(formData)) });
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(error.message || "Die App konnte nicht angelegt werden.");
      }
      const created = await response.json().catch(() => null) as AppConfig | null;
      const id = created?.id || formData.id!;

      if (connectRepository) {
        try {
          const linked = await fetchApi(`/apps/${id}/repository`, { method: "PUT", body: JSON.stringify(repo) });
          if (!linked.ok) throw new Error();
          const synced = await fetchApi(`/apps/${id}/repository/sync`, { method: "POST" });
          if (!synced.ok) throw new Error();
          // An AI scan already put the repository's data into the form.
          if (!suggestion?.repositoryScan) {
            const integration = await synced.json() as GitLabIntegrationState;
            if (integration.snapshot) {
              await fetchApi(`/apps/${id}`, { method: "PUT", body: JSON.stringify(toPayload(mergeRepositorySnapshot({ ...formData, id }, integration.snapshot))) });
            }
          }
        } catch {
          toast.warning("Der Entwurf wurde angelegt, das Repository konnte aber nicht verbunden werden. Du kannst es im Editor erneut versuchen.");
        }
      }

      toast.success("Entwurf angelegt. Ergänze jetzt die Details.");
      router.push(editHref(id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Die App konnte nicht angelegt werden.";
      setCreateError(message);
      setCreating(false);
    }
  };

  const previewApp = {
    id: formData.id || "neue-app",
    name: name || "Deine App",
    description: formData.description?.trim() || "Hier steht die Kurzbeschreibung deiner App.",
    icon: formData.icon,
    categories: formData.categories || [],
    status: DRAFT_STATUS,
    authority: formData.authority,
  } as AppConfig;

  const heading = [
    { title: copySource ? "Vorlage" : "Wie möchtest du starten?", description: "Importiere ein Repository, lass die AI einen Entwurf schreiben oder fülle selbst aus." },
    { title: "Die Grunddaten", description: "So erscheint deine App im Katalog. Alles Weitere ergänzt du danach im Editor." },
    { title: "Alles bereit?", description: "Die App wird als Entwurf angelegt und ist erst nach der Veröffentlichung für andere sichtbar." },
  ][step];

  const importedExtras = [
    formData.markdownContent?.trim() && "Dokumentation",
    (formData.dockerRepo || formData.customDockerCommand) && "Docker",
    formData.customComposeCommand && "Docker Compose",
    (formData.helmRepo || formData.customHelmCommand) && "Helm",
    formData.license && `Lizenz ${formData.license}`,
    formData.tags?.length && `${formData.tags.length} Schlagwörter`,
    formData.techStack?.length && `${formData.techStack.length} Technologien`,
    links(formData.repositories).length && "Repository-Link",
    formData.isReuse && "Nachnutzung",
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-6 pb-16 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(backUrl)}>
            <ArrowLeft />
            Abbrechen
          </Button>
          {copySource && <Badge variant="info">Kopie von {copySource.name}</Badge>}
        </div>

        <Steps value={step} onValueChange={(next) => !creating && !analyzing && setStep(next)} aria-label="Fortschritt der App-Erstellung">
          <Steps.Item step={STEP_START} completed={!!copySource} disabled={!!copySource}>
            <Steps.Trigger>
              <Steps.Indicator />
              <Steps.Title>Start</Steps.Title>
              <Steps.Description>{copySource ? "Vorlage" : "Import oder manuell"}</Steps.Description>
            </Steps.Trigger>
          </Steps.Item>
          <Steps.Item step={STEP_BASICS} loading={analyzing}>
            <Steps.Trigger>
              <Steps.Indicator />
              <Steps.Title>Grunddaten</Steps.Title>
              <Steps.Description>Name, Logo, Beschreibung</Steps.Description>
            </Steps.Trigger>
          </Steps.Item>
          <Steps.Item step={STEP_REVIEW} loading={creating}>
            <Steps.Trigger>
              <Steps.Indicator />
              <Steps.Title>Prüfen</Steps.Title>
              <Steps.Description>Als Entwurf anlegen</Steps.Description>
            </Steps.Trigger>
          </Steps.Item>
        </Steps>
      </div>

      <div className="flex flex-col gap-1.5">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none sm:text-3xl">
          {heading.title}
        </h1>
        <p className="text-muted-foreground">{heading.description}</p>
      </div>

      {step === STEP_START && (
        <form onSubmit={submitStart} className="flex flex-col gap-6">
          <ChoiceCards
            value={method}
            onValueChange={(value) => { setMethod(value as StartMethod); setStartError(null); }}
            columns={3}
            aspect="5 / 2"
            aria-label="Wie möchtest du starten?"
          >
            <ChoiceCards.Item value="repository">
              <ChoiceCards.Media><FolderGit2 className="size-7" /></ChoiceCards.Media>
              <ChoiceCards.Label>Aus Repository</ChoiceCards.Label>
              <ChoiceCards.Description>
                {aiAvailable ? "README, Metadaten und Deployment-Dateien werden übernommen." : "Daten werden beim Anlegen aus dem Repository importiert."}
              </ChoiceCards.Description>
            </ChoiceCards.Item>
            <ChoiceCards.Item value="ai" disabled={!aiAvailable}>
              <ChoiceCards.Media><Sparkles className="size-7" /></ChoiceCards.Media>
              <ChoiceCards.Label>Beschreiben</ChoiceCards.Label>
              <ChoiceCards.Description>
                {aiAvailable ? "Die AI erstellt aus ein paar Sätzen einen Entwurf." : "AI ist auf dieser Plattform nicht eingerichtet."}
              </ChoiceCards.Description>
            </ChoiceCards.Item>
            <ChoiceCards.Item value="manual">
              <ChoiceCards.Media><PencilLine className="size-7" /></ChoiceCards.Media>
              <ChoiceCards.Label>Manuell</ChoiceCards.Label>
              <ChoiceCards.Description>Ohne Import selbst ausfüllen.</ChoiceCards.Description>
            </ChoiceCards.Item>
          </ChoiceCards>

          {method === "repository" && (
            <Card>
              <Card.Content className="flex flex-col gap-5">
                {providers.length === 0 ? (
                  <Alert variant="plain" tone="warning">
                    <Alert.Icon />
                    <Alert.Title>Kein Repository-Provider verfügbar</Alert.Title>
                    <Alert.Description>Ein Provider muss zuerst in der Verwaltung eingerichtet werden. Du kannst die App bis dahin manuell anlegen.</Alert.Description>
                  </Alert>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                    <Field>
                      <Field.Label>Provider</Field.Label>
                      <Select
                        items={providers.map((provider) => ({ value: provider.key, label: provider.label }))}
                        value={repo.providerKey || null}
                        onValueChange={(value) => setRepo((previous) => ({ ...previous, providerKey: value || "" }))}
                      >
                        <Select.Trigger>
                          <Select.Value placeholder="Auswählen" />
                        </Select.Trigger>
                        <Select.Content>
                          {providers.map((provider) => (
                            <Select.Item key={provider.key} value={provider.key}>{provider.label}</Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </Field>
                    <Field>
                      <Field.Label required>Projektpfad oder Repository-URL</Field.Label>
                      <Input
                        autoFocus
                        value={repo.projectPath}
                        onChange={(event) => setRepo((previous) => ({ ...previous, projectPath: event.target.value }))}
                        placeholder="gruppe/projekt oder https://…"
                      />
                    </Field>
                  </div>
                )}

                {providers.length > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      aria-expanded={repoOptionsOpen}
                      onClick={() => setRepoOptionsOpen((open) => !open)}
                    >
                      <ChevronDown className={repoOptionsOpen ? "rotate-180" : undefined} />
                      Weitere Import-Optionen
                    </Button>
                    {repoOptionsOpen && (
                      <div className="grid gap-5 sm:grid-cols-2">
                        {([
                          ["branch", "Branch oder Ref", "Standard-Branch"],
                          ["readmePath", "README-Pfad", "README.md"],
                          ["helmValuesPath", "Helm Values", "chart/values.yaml"],
                          ["composeFilePath", "Compose-Datei", "docker-compose.yml"],
                        ] as const).map(([key, label, placeholder]) => (
                          <Field key={key}>
                            <Field.Label optional>{label}</Field.Label>
                            <Input
                              value={repo[key]}
                              onChange={(event) => setRepo((previous) => ({ ...previous, [key]: event.target.value }))}
                              placeholder={placeholder}
                            />
                          </Field>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {aiAvailable && providers.length > 0 && (
                  <Field>
                    <Field.Label optional>Zusätzlicher Kontext für die AI</Field.Label>
                    <Textarea value={aiBrief} onChange={(event) => setAiBrief(event.target.value)} placeholder="z. B. Zielgruppe oder wofür die App in deiner Behörde genutzt wird" />
                  </Field>
                )}
              </Card.Content>
            </Card>
          )}

          {method === "ai" && (
            <Card>
              <Card.Content>
                <Field>
                  <Field.Label required>Was soll die App leisten?</Field.Label>
                  <Textarea
                    autoFocus
                    minRows={4}
                    value={aiBrief}
                    onChange={(event) => setAiBrief(event.target.value)}
                    placeholder="z. B. Eine Anwendung, mit der Kommunen Anträge digital erfassen und den Bearbeitungsstand verfolgen können."
                  />
                  <Field.Description>Die AI schlägt Name, Beschreibung, Kategorien und mehr vor. Gespeichert wird erst nach deiner Prüfung.</Field.Description>
                </Field>
              </Card.Content>
            </Card>
          )}

          {availableSpaces.length > 0 && (
            <Field className="max-w-sm">
              <Field.Label>Sichtbarkeit</Field.Label>
              <Select
                items={[{ value: PUBLIC_SCOPE, label: "Öffentlicher Katalog" }, ...availableSpaces.map((item) => ({ value: item.id, label: `Space: ${item.name}` }))]}
                value={formData.spaceId || PUBLIC_SCOPE}
                onValueChange={(value) => update({ spaceId: !value || value === PUBLIC_SCOPE ? null : value })}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={PUBLIC_SCOPE} icon={<Globe2 />}>Öffentlicher Katalog</Select.Item>
                  {availableSpaces.map((item) => (
                    <Select.Item key={item.id} value={item.id} icon={<LockKeyhole />}>Space: {item.name}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
              <Field.Description>
                {formData.spaceId ? "Nur Mitglieder dieses Spaces sehen die App. Veröffentlichen kannst du sie später." : "Der Entwurf ist zunächst nur für dich und berechtigte Bearbeiter sichtbar."}
              </Field.Description>
            </Field>
          )}

          {startError && (
            <Alert variant="plain" tone="destructive" aria-live="assertive">
              <Alert.Icon />
              <Alert.Title>{method === "manual" ? "Das hat nicht geklappt" : "Analyse fehlgeschlagen"}</Alert.Title>
              <Alert.Description>{startError} Deine Eingaben bleiben erhalten.</Alert.Description>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-6">
            {method !== "manual" && (
              <Button variant="ghost" disabled={analyzing} onClick={() => { setMethod("manual"); setStep(STEP_BASICS); }}>
                Ohne Import weiter
              </Button>
            )}
            <Button type="submit" loading={analyzing} disabled={method === "repository" && providers.length === 0}>
              {method === "manual" ? "Weiter" : aiAvailable ? (method === "repository" ? "Repository analysieren" : "Entwurf erstellen") : "Weiter"}
              {method === "manual" || !aiAvailable ? <ArrowRight /> : <Sparkles />}
            </Button>
          </div>
        </form>
      )}

      {step === STEP_BASICS && (
        <form onSubmit={submitBasics} className="flex flex-col gap-6">
          {suggestion && (
            <Alert tone="info" variant="plain">
              <Alert.Icon><Sparkles /></Alert.Icon>
              <Alert.Title>Vorschlag übernommen</Alert.Title>
              <Alert.Description>
                {suggestion.repositoryScan
                  ? `Aus ${suggestion.repositoryScan.projectPath} gelesen. Bitte prüfe die Angaben.`
                  : "Bitte prüfe die Angaben, bevor du weitermachst."}
              </Alert.Description>
              {(suggestion.missingFields.length > 0 || suggestion.notes.length > 0 || (suggestion.repositoryScan?.warnings.length ?? 0) > 0) && (
                <Alert.Details label="Hinweise der AI anzeigen">
                  {suggestion.missingFields.length > 0 && <Alert.Item>Fehlende Angaben: {suggestion.missingFields.join(", ")}</Alert.Item>}
                  {[...suggestion.notes, ...(suggestion.repositoryScan?.warnings || [])].map((note) => <Alert.Item key={note}>{note}</Alert.Item>)}
                </Alert.Details>
              )}
            </Alert>
          )}

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Card>
              <Card.Content className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Field invalid={(attempted && !name) || idTaken}>
                    <Field.Label required>App-Name</Field.Label>
                    <Input
                      autoFocus
                      size="lg"
                      value={formData.name || ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setFormData((previous) => ({ ...previous, name: value, id: idEditing ? previous.id : slugify(value) }));
                      }}
                      placeholder="z. B. Digi-Sign Pro"
                    />
                    <Field.Error>{idTaken ? "Diese technische ID ist bereits vergeben. Ändere den Namen oder die ID." : "Gib einen App-Namen ein."}</Field.Error>
                  </Field>
                  {idEditing ? (
                    <Field>
                      <Field.Label>Technische ID</Field.Label>
                      <Input value={formData.id || ""} onChange={(event) => update({ id: slugify(event.target.value) })} className="font-mono" />
                    </Field>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Technische ID: <code className="font-mono text-foreground">{formData.id || "…"}</code>{" "}
                      <Button variant="link" size="sm" className="h-auto px-1" onClick={() => setIdEditing(true)}>Ändern</Button>
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Logo</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <AppIcon icon={formData.icon} />
                    <input
                      ref={iconInput}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadLogo(file);
                        event.target.value = "";
                      }}
                    />
                    <Button variant="outline" size="sm" loading={uploading} onClick={() => iconInput.current?.click()}>
                      <Upload />
                      Bild hochladen
                    </Button>
                    <Menu>
                      <Menu.Trigger render={<Button variant="outline" size="sm" />}>
                        <Smile />
                        Symbol wählen
                      </Menu.Trigger>
                      <Menu.Content className="grid min-w-0 grid-cols-6 gap-0.5">
                        {EMOJIS.map((emoji) => (
                          <Menu.Item key={emoji} aria-label={`Symbol ${emoji}`} className="justify-center text-lg" onClick={() => update({ icon: emoji })}>
                            {emoji}
                          </Menu.Item>
                        ))}
                      </Menu.Content>
                    </Menu>
                  </div>
                </div>

                <Field>
                  <Field.Label optional>Kurzbeschreibung</Field.Label>
                  <Textarea
                    minRows={3}
                    value={formData.description || ""}
                    onChange={(event) => update({ description: event.target.value })}
                    placeholder="Wofür ist die App da, und was bringt sie im Alltag?"
                  />
                  <Field.Description>Erscheint auf der Karte im Katalog. Vor der Veröffentlichung erforderlich.</Field.Description>
                </Field>

                <Field>
                  <Field.Label optional>Kategorien</Field.Label>
                  <Combobox
                    mode="multiple"
                    value={formData.categories || []}
                    onValueChange={(categories) => update({ categories })}
                    allowCustomValue
                    openOnFocus
                    placeholder="Kategorie suchen oder eigene eingeben"
                    accessibilityLabel="Kategorien"
                  >
                    {categoryOptions.map((category) => (
                      <Combobox.Item key={category} value={category} label={category} />
                    ))}
                  </Combobox>
                  <Field.Description>Hilft anderen, die App zu finden. Vor der Veröffentlichung erforderlich.</Field.Description>
                </Field>
              </Card.Content>
            </Card>

            <aside className="flex flex-col gap-3 lg:sticky lg:top-20" aria-label="Vorschau">
              <p className="text-sm font-medium text-muted-foreground">Vorschau im Katalog</p>
              {/* The real catalogue card, inert so it cannot be clicked from here. */}
              <div inert className="select-none">
                <AppCard app={previewApp} />
              </div>
            </aside>
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-6">
            <Button variant="ghost" disabled={!!copySource} onClick={() => setStep(STEP_START)}>
              <ArrowLeft />
              Zurück
            </Button>
            <Button type="submit">
              Weiter
              <ArrowRight />
            </Button>
          </div>
        </form>
      )}

      {step === STEP_REVIEW && (
        <div className="flex flex-col gap-6">
          <Card>
            <Card.Content className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <AppIcon icon={formData.icon} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-lg font-semibold">{name}</p>
                  <p className="font-mono text-sm text-muted-foreground">{formData.id}</p>
                </div>
                <Badge variant="secondary">{DRAFT_STATUS}</Badge>
              </div>

              <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                <ReviewRow label="Sichtbarkeit" onEdit={availableSpaces.length && !copySource ? () => setStep(STEP_START) : undefined}>
                  {space ? `Space: ${space.name}` : "Öffentlicher Katalog"}
                </ReviewRow>
                <ReviewRow label="Kurzbeschreibung" onEdit={() => setStep(STEP_BASICS)}>
                  {formData.description?.trim() || <span className="text-muted-foreground">Noch nicht ergänzt</span>}
                </ReviewRow>
                <ReviewRow label="Kategorien" onEdit={() => setStep(STEP_BASICS)}>
                  {formData.categories?.length ? (
                    <span className="flex flex-wrap gap-1.5">{formData.categories.map((category) => <Badge key={category} variant="outline">{category}</Badge>)}</span>
                  ) : (
                    <span className="text-muted-foreground">Noch nicht ergänzt</span>
                  )}
                </ReviewRow>
                {connectRepository && (
                  <ReviewRow label="Repository">
                    {providers.find((provider) => provider.key === repo.providerKey)?.label} · <span className="font-mono">{repo.projectPath}</span>
                  </ReviewRow>
                )}
                {importedExtras.length > 0 && (
                  <ReviewRow label="Bereits übernommen">
                    <span className="flex flex-wrap gap-1.5">{importedExtras.map((item) => <Badge key={item} variant="success">{item}</Badge>)}</span>
                  </ReviewRow>
                )}
              </dl>
            </Card.Content>
          </Card>

          <Alert tone="info" variant="plain">
            <Alert.Icon />
            <Alert.Title>Danach geht es im Editor weiter</Alert.Title>
            <Alert.Description>
              Dort ergänzt du Installation, Links, Dokumentation, Bearbeiter, verwandte Apps und Gruppen, und veröffentlichst die App, wenn sie fertig ist.
            </Alert.Description>
          </Alert>

          {createError && (
            <Alert variant="plain" tone="destructive" aria-live="assertive">
              <Alert.Icon />
              <Alert.Title>Die App konnte nicht angelegt werden</Alert.Title>
              <Alert.Description>{createError}</Alert.Description>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-2 border-t pt-6">
            <Button variant="ghost" disabled={creating} onClick={() => setStep(STEP_BASICS)}>
              <ArrowLeft />
              Zurück
            </Button>
            <Button loading={creating} onClick={() => void create()}>
              <Check />
              Entwurf anlegen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AppIcon({ icon }: { icon?: string }) {
  const image = getImageAssetUrl(icon);
  return (
    <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted text-2xl">
      {image ? <Image src={image} alt="" fill sizes="56px" className="object-contain p-2" unoptimized /> : icon || "🏛️"}
    </span>
  );
}

function ReviewRow({ label, onEdit, children }: { label: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 break-words">{children}</span>
        {onEdit && (
          <Button variant="link" size="sm" className="h-auto shrink-0 px-0" onClick={onEdit}>
            Ändern
          </Button>
        )}
      </dd>
    </>
  );
}
