"use client";

import { Alert } from "@/components/panelui/alert";
import { Badge, type BadgeVariant } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Select } from "@/components/panelui/select";
import { Spinner } from "@/components/panelui/spinner";
import type { AppLink, GitLabIntegrationState, GitLabSyncSnapshot } from "@/config/apps";
import { BookOpen, Check, CloudDownload, ExternalLink, GitBranch, Server, Unlink } from "lucide-react";
import { type AppDraft, EditorCard } from "./shared";

export interface RepositoryForm {
  providerKey: string;
  projectPath: string;
  branch: string;
  readmePath: string;
  helmValuesPath: string;
  composeFilePath: string;
}

export const emptyRepositoryForm: RepositoryForm = { providerKey: "", projectPath: "", branch: "", readmePath: "", helmValuesPath: "", composeFilePath: "" };

export function normalizeRepositoryForm(integration: GitLabIntegrationState | null): RepositoryForm {
  const providerKey = integration?.providerKey || integration?.availableProviders?.[0]?.key || "";
  const provider = integration?.availableProviders?.find((item) => item.key === providerKey);
  return {
    providerKey,
    projectPath: integration?.projectPath || "",
    branch: integration?.branch || "",
    readmePath: integration?.readmePath || provider?.defaultReadmePath || "",
    helmValuesPath: integration?.helmValuesPath || provider?.defaultHelmValuesPath || "",
    composeFilePath: integration?.composeFilePath || provider?.defaultComposeFilePath || "",
  };
}

const SYNC_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  success: { label: "Synchronisiert", variant: "success" },
  warning: { label: "Mit Hinweisen", variant: "warning" },
  pending_approval: { label: "Wartet auf Freigabe", variant: "warning" },
  error: { label: "Fehlgeschlagen", variant: "destructive" },
};

const clean = (value?: string | null) => value?.trim() || "";

function formatLinks(links?: AppLink[]) {
  return links?.length ? links.map((link) => `${clean(link.label) || "Link"}: ${clean(link.url)}`).join("\n") : "";
}

function mergeLinks(links: AppLink[] | undefined, url?: string, label?: string) {
  const next = [...(links || [])];
  if (!clean(url)) return next;
  const existing = next.find((link) => clean(link.url) === clean(url));
  if (existing) existing.label = clean(label) || "Repository";
  else next.push({ label: clean(label) || "Repository", url: clean(url) });
  return next;
}

/** What an approved sync would change, field by field. */
function approvalDiff(app: AppDraft, snapshot: GitLabSyncSnapshot, providerLabel?: string) {
  const tags = Array.from(new Set([...(app.tags || []).map(clean), ...(snapshot.topics || []).map(clean)].filter(Boolean)));
  return [
    { label: "Beschreibung", current: clean(app.description), next: clean(snapshot.description) || clean(app.description) },
    { label: "Lizenz", current: clean(app.license), next: clean(snapshot.license) || clean(app.license) },
    { label: "Schlagwörter", current: (app.tags || []).join(", "), next: tags.join(", ") },
    { label: "Repository-Links", current: formatLinks(app.repositories), next: formatLinks(mergeLinks(app.repositories, snapshot.projectWebUrl, providerLabel)), code: true },
    { label: "Dokumentation", current: clean(app.markdownContent), next: clean(snapshot.readmeContent) || clean(app.markdownContent), code: true },
    { label: "Helm values", current: clean(app.customHelmValues), next: clean(snapshot.helmValuesContent) || clean(app.customHelmValues), code: true },
    { label: "Compose-Datei", current: clean(app.customComposeCommand), next: clean(snapshot.composeFileContent) || clean(app.customComposeCommand), code: true },
  ].filter((item) => item.current !== item.next);
}

function DiffValue({ value, code }: { value: string; code?: boolean }) {
  return (
    <pre className={`max-h-56 overflow-auto rounded-lg border bg-muted/50 px-3 py-2 text-xs whitespace-pre-wrap ${code ? "font-mono" : "font-sans"}`}>
      {value || <span className="text-muted-foreground">Kein Wert</span>}
    </pre>
  );
}

export function RepositorySection({
  app,
  integration,
  form,
  onFormChange,
  loading,
  busy,
  syncing,
  approving,
  error,
  pendingUnlink,
  hasUnsavedChanges,
  onSync,
  onApprove,
  onUnlink,
  onApplyReadme,
  onApplyMetadata,
  onApplyDeployment,
}: {
  app: AppDraft;
  integration: GitLabIntegrationState | null;
  form: RepositoryForm;
  onFormChange: (form: RepositoryForm) => void;
  loading: boolean;
  busy: boolean;
  syncing: boolean;
  approving: boolean;
  error: string | null;
  pendingUnlink: boolean;
  hasUnsavedChanges: boolean;
  onSync: () => void;
  onApprove: () => void;
  onUnlink: () => void;
  onApplyReadme: () => void;
  onApplyMetadata: () => void;
  onApplyDeployment: () => void;
}) {
  if (loading) {
    return (
      <EditorCard title="Repository">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner label="Repository-Daten werden geladen" />
          Repository-Daten werden geladen …
        </div>
      </EditorCard>
    );
  }

  const providers = integration?.availableProviders || [];
  if (!providers.length && !integration?.linked) {
    return (
      <Alert tone="warning">
        <Alert.Icon />
        <Alert.Title>Kein Repository-Provider eingerichtet</Alert.Title>
        <Alert.Description>Ein Provider muss zuerst in der Verwaltung konfiguriert werden.</Alert.Description>
      </Alert>
    );
  }

  const status = integration?.approvalRequired ? SYNC_STATUS.pending_approval : SYNC_STATUS[integration?.lastSyncStatus || ""];
  const pending = integration?.approvalRequired ? integration.pendingSnapshot : undefined;
  const snapshot = pending || integration?.snapshot;
  const diff = pending ? approvalDiff(app, pending, integration?.providerLabel || integration?.providerKey) : [];
  const set = (patch: Partial<RepositoryForm>) => onFormChange({ ...form, ...patch });
  const selectProvider = (providerKey: string) => {
    const provider = providers.find((item) => item.key === providerKey);
    onFormChange({
      ...form,
      providerKey,
      readmePath: form.readmePath || provider?.defaultReadmePath || "",
      helmValuesPath: form.helmValuesPath || provider?.defaultHelmValuesPath || "",
      composeFilePath: form.composeFilePath || provider?.defaultComposeFilePath || "",
    });
  };
  const actionsBlocked = busy || hasUnsavedChanges;

  return (
    <>
      {pendingUnlink && (
        <Alert variant="plain" tone="warning">
          <Alert.Icon />
          <Alert.Title>Die Verknüpfung wird beim Speichern gelöst.</Alert.Title>
        </Alert>
      )}

      <EditorCard
        title="Verknüpfung"
        description="README, Metadaten und Deployment-Dateien werden aus dem Repository gelesen. Die Verknüpfung wird mit „Speichern“ übernommen."
        action={status ? <Badge variant={status.variant} dot={integration?.approvalRequired ? "pulse" : true}>{status.label}</Badge> : <Badge variant="secondary">Nicht synchronisiert</Badge>}
        footer={integration?.linked ? (
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" loading={syncing} disabled={actionsBlocked} onClick={onSync}>
              <CloudDownload />
              Jetzt synchronisieren
            </Button>
            {pending && (
              <Button size="sm" loading={approving} disabled={actionsBlocked} onClick={onApprove}>
                <Check />
                Änderungen freigeben
              </Button>
            )}
            {integration.projectWebUrl && (
              <Button variant="ghost" size="sm" render={<a href={integration.projectWebUrl} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink />
                Projekt öffnen
              </Button>
            )}
            <Button variant="ghost" size="sm" className="ms-auto text-destructive" disabled={busy || pendingUnlink} onClick={onUnlink}>
              <Unlink />
              Verknüpfung lösen
            </Button>
          </div>
        ) : undefined}
      >
        {integration?.linked && (
          <p className="text-sm text-muted-foreground">
            Letzte Synchronisation: {integration.lastSyncedAt ? new Date(integration.lastSyncedAt).toLocaleString("de-DE") : "noch nie"}
          </p>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Field.Label>Provider</Field.Label>
            <Select
              items={providers.map((provider) => ({ value: provider.key, label: provider.label }))}
              value={form.providerKey || null}
              onValueChange={(value) => value && selectProvider(value)}
            >
              <Select.Trigger>
                <Select.Value placeholder="Auswählen" />
              </Select.Trigger>
              <Select.Content>
                {providers.map((provider) => (
                  <Select.Item key={provider.key} value={provider.key} description={provider.baseUrl}>{provider.label}</Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>
          <Field>
            <Field.Label>Projektpfad oder Repository-URL</Field.Label>
            <Input className="font-mono" value={form.projectPath} onChange={(event) => set({ projectPath: event.target.value })} placeholder="gruppe/projekt" />
          </Field>
          <Field>
            <Field.Label optional>Branch oder Ref</Field.Label>
            <Input className="font-mono" value={form.branch} onChange={(event) => set({ branch: event.target.value })} placeholder="Standard-Branch" />
          </Field>
          <Field>
            <Field.Label optional>README-Pfad</Field.Label>
            <Input className="font-mono" value={form.readmePath} onChange={(event) => set({ readmePath: event.target.value })} placeholder="docs/README.md" />
          </Field>
          <Field>
            <Field.Label optional>Helm values</Field.Label>
            <Input className="font-mono" value={form.helmValuesPath} onChange={(event) => set({ helmValuesPath: event.target.value })} placeholder="chart/values.yaml" />
          </Field>
          <Field>
            <Field.Label optional>Compose-Datei</Field.Label>
            <Input className="font-mono" value={form.composeFilePath} onChange={(event) => set({ composeFilePath: event.target.value })} placeholder="docker-compose.yml" />
          </Field>
        </div>
        {hasUnsavedChanges && integration?.linked && (
          <p className="text-sm text-muted-foreground">Synchronisieren und Freigeben sind möglich, sobald alle Änderungen gespeichert sind.</p>
        )}
        {error && (
          <Alert variant="plain" tone="destructive">
            <Alert.Icon />
            <Alert.Title>{error}</Alert.Title>
          </Alert>
        )}
        {integration?.approvalRequired && (
          <Alert variant="plain" tone="warning">
            <Alert.Icon />
            <Alert.Title>Freigabe nötig</Alert.Title>
            <Alert.Description>Die App wurde von Hand bearbeitet. Neue Synchronisationen werden erst nach Freigabe übernommen.</Alert.Description>
          </Alert>
        )}
      </EditorCard>

      {pending && (
        <EditorCard title="Änderungen zur Freigabe" description="Links der aktuelle Stand, rechts der Stand nach der Freigabe.">
          {diff.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine inhaltlichen Unterschiede erkannt.</p>
          ) : (
            diff.map((item) => (
              <div key={item.label} className="flex flex-col gap-2">
                <span className="text-sm font-medium">{item.label}</span>
                <div className="grid gap-3 lg:grid-cols-2">
                  <DiffValue value={item.current} code={item.code} />
                  <DiffValue value={item.next} code={item.code} />
                </div>
              </div>
            ))
          )}
        </EditorCard>
      )}

      {snapshot && !pending && (
        <EditorCard
          title="Inhalte aus dem Repository"
          description={snapshot.syncedAt ? `Stand vom ${new Date(snapshot.syncedAt).toLocaleString("de-DE")}. Übernimmt die Inhalte ins Formular, gespeichert wird mit „Speichern“.` : undefined}
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!clean(snapshot.readmeContent)} onClick={onApplyReadme}>
              <BookOpen />
              README als Dokumentation
            </Button>
            <Button variant="outline" size="sm" disabled={!clean(snapshot.description) && !snapshot.topics?.length && !clean(snapshot.license) && !snapshot.projectWebUrl} onClick={onApplyMetadata}>
              <GitBranch />
              Beschreibung, Lizenz und Schlagwörter
            </Button>
            <Button variant="outline" size="sm" disabled={!clean(snapshot.helmValuesContent) && !clean(snapshot.composeFileContent)} onClick={onApplyDeployment}>
              <Server />
              Deployment-Dateien
            </Button>
          </div>
          {!!snapshot.warnings?.length && (
            <Alert variant="plain" tone="warning">
              <Alert.Icon />
              <Alert.Title>Hinweise aus dem letzten Import</Alert.Title>
              <Alert.Details label={`${snapshot.warnings.length} Hinweise anzeigen`}>
                {snapshot.warnings.map((warning) => <Alert.Item key={warning}>{warning}</Alert.Item>)}
              </Alert.Details>
            </Alert>
          )}
        </EditorCard>
      )}
    </>
  );
}
