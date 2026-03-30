'use client';

import { AppConfig, GitLabIntegrationState, GitLabSyncSnapshot } from '@/config/apps';
import { BookOpen, Check, CloudDownload, ExternalLink, GitBranch, Loader2, Save, Server, Trash2 } from 'lucide-react';

export interface GitLabFormState {
  providerKey: string;
  projectPath: string;
  branch: string;
  readmePath: string;
  helmValuesPath: string;
  composeFilePath: string;
}

interface GitLabTabProps {
  initialApp: AppConfig | null;
  isNew: boolean;
  gitLabIntegration: GitLabIntegrationState | null;
  gitLabForm: GitLabFormState;
  setGitLabForm: React.Dispatch<React.SetStateAction<GitLabFormState>>;
  loadingGitLab: boolean;
  savingGitLab: boolean;
  syncingGitLab: boolean;
  gitLabError: string | null;
  hasGitLabProviders: boolean;
  gitLabStatus: { label: string; className: string };
  gitLabSnapshot: GitLabSyncSnapshot | undefined;
  onSave: () => void;
  onSync: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onApplyReadme: () => void;
  onApplyMetadata: () => void;
  onApplyDeployment: () => void;
}

export function GitLabTab({
  gitLabIntegration, gitLabForm, setGitLabForm,
  loadingGitLab, savingGitLab, syncingGitLab, gitLabError,
  hasGitLabProviders, gitLabStatus, gitLabSnapshot,
  onSave, onSync, onDelete, onApprove,
  onApplyReadme, onApplyMetadata, onApplyDeployment,
}: GitLabTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-secondary/40 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Repository-Import via GitLab</p>
            <p className="text-xs text-muted mt-1">
              README, Metadaten und ausgewählte Repository-Dateien werden als Import-Snapshot geladen und bei Bedarf in den Editor übernommen.
            </p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${gitLabStatus.className}`}>
            {gitLabStatus.label}
          </span>
        </div>
        {gitLabIntegration?.linked && (
          <div className="flex flex-col gap-1 text-xs text-muted md:flex-row md:items-center md:justify-between">
            <span>
              {gitLabIntegration.providerLabel || gitLabIntegration.providerKey} · {gitLabIntegration.projectPath}
            </span>
            <span>
              Letzte Synchronisation: {gitLabIntegration.lastSyncedAt ? new Date(gitLabIntegration.lastSyncedAt).toLocaleString('de-DE') : 'noch nie'}
            </span>
          </div>
        )}
        {gitLabIntegration?.approvalRequired && (
          <p className="text-xs text-warning">
            Für diese App gibt es manuelle Änderungen. Neue GitLab-Syncs werden als freizugebende Änderung vorgemerkt, bis ein Owner oder Admin sie bestätigt.
          </p>
        )}
      </div>

      {loadingGitLab ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          GitLab-Daten werden geladen...
        </div>
      ) : !hasGitLabProviders && !gitLabIntegration?.linked ? (
        <div className="rounded-2xl border border-warning/20 bg-warning/5 p-5 text-sm text-warning">
          Es ist noch kein nutzbarer GitLab-Provider im Backend konfiguriert.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">GitLab-Provider</label>
              <select
                value={gitLabForm.providerKey}
                onChange={(e) => setGitLabForm((p) => ({ ...p, providerKey: e.target.value }))}
                className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
              >
                {(gitLabIntegration?.availableProviders || []).map((provider) => (
                  <option key={provider.key} value={provider.key}>
                    {provider.label} ({provider.baseUrl})
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Projektpfad</label>
              <input
                value={gitLabForm.projectPath}
                onChange={(e) => setGitLabForm((p) => ({ ...p, projectPath: e.target.value }))}
                placeholder="gruppe/projekt"
                className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
              />
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Branch oder Ref</label>
              <input
                value={gitLabForm.branch}
                onChange={(e) => setGitLabForm((p) => ({ ...p, branch: e.target.value }))}
                placeholder="leer = Default Branch"
                className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
              />
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">README-Pfad</label>
              <input
                value={gitLabForm.readmePath}
                onChange={(e) => setGitLabForm((p) => ({ ...p, readmePath: e.target.value }))}
                placeholder="optional, z. B. docs/README.md"
                className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
              />
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Helm Values Pfad</label>
              <input
                value={gitLabForm.helmValuesPath}
                onChange={(e) => setGitLabForm((p) => ({ ...p, helmValuesPath: e.target.value }))}
                placeholder="optional, z. B. chart/values.yaml"
                className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
              />
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Compose-Datei Pfad</label>
              <input
                value={gitLabForm.composeFilePath}
                onChange={(e) => setGitLabForm((p) => ({ ...p, composeFilePath: e.target.value }))}
                placeholder="optional, z. B. docker-compose.yml"
                className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
              />
            </div>
          </div>

          {gitLabError && (
            <div className="rounded-2xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
              {gitLabError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={savingGitLab || !gitLabForm.providerKey || !gitLabForm.projectPath.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingGitLab ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Verknüpfung speichern
            </button>
            <button
              type="button"
              onClick={onSync}
              disabled={syncingGitLab || savingGitLab || !gitLabIntegration?.linked}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncingGitLab ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
              Jetzt synchronisieren
            </button>
            {gitLabIntegration?.approvalRequired && gitLabIntegration?.pendingSnapshot && (
              <button
                type="button"
                onClick={onApprove}
                disabled={savingGitLab || syncingGitLab}
                className="inline-flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 px-4 py-2 text-sm font-semibold text-success transition-colors hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Sync freigeben
              </button>
            )}
            {gitLabIntegration?.linked && (
              <button
                type="button"
                onClick={onDelete}
                disabled={savingGitLab || syncingGitLab}
                className="inline-flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Verknüpfung lösen
              </button>
            )}
            {gitLabIntegration?.projectWebUrl && (
              <a
                href={gitLabIntegration.projectWebUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary"
              >
                <ExternalLink className="h-4 w-4" />
                Projekt öffnen
              </a>
            )}
          </div>

          {gitLabSnapshot && (
            <div className="space-y-5 rounded-3xl border border-border bg-surface p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {gitLabIntegration?.approvalRequired ? 'Freizugebender GitLab-Snapshot' : 'Letzter Import-Snapshot'}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {gitLabIntegration?.approvalRequired
                      ? 'Dieser Snapshot wird erst nach Freigabe automatisch auf die App angewendet.'
                      : 'Der zuletzt angewendete Snapshot aus GitLab.'}
                  </p>
                </div>
                {gitLabSnapshot.syncedAt && (
                  <span className="text-xs text-muted">
                    Snapshot vom {new Date(gitLabSnapshot.syncedAt).toLocaleString('de-DE')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex flex-col rounded-2xl border border-border bg-surface-secondary/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">README</p>
                  <p className="mt-2 flex-1 text-sm text-foreground">
                    {gitLabSnapshot.readmeContent?.trim() ? 'README gefunden und bereit zum Übernehmen.' : 'Keine README im Snapshot.'}
                  </p>
                  {!gitLabIntegration?.approvalRequired && (
                    <button
                      type="button"
                      onClick={onApplyReadme}
                      disabled={!gitLabSnapshot.readmeContent?.trim()}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      In Dokumentation übernehmen
                    </button>
                  )}
                </div>
                <div className="flex flex-col rounded-2xl border border-border bg-surface-secondary/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Repository-Metadaten</p>
                  <p className="mt-2 flex-1 text-sm text-foreground">
                    Beschreibung, Lizenz, Topics und Repository-Link können in das Formular übernommen werden.
                  </p>
                  {!gitLabIntegration?.approvalRequired && (
                    <button
                      type="button"
                      onClick={onApplyMetadata}
                      disabled={!gitLabSnapshot.description?.trim() && !(gitLabSnapshot.topics?.length) && !gitLabSnapshot.license?.trim() && !gitLabSnapshot.projectWebUrl}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      In Metadaten übernehmen
                    </button>
                  )}
                </div>
                <div className="flex flex-col rounded-2xl border border-border bg-surface-secondary/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Deployment-Dateien</p>
                  <p className="mt-2 flex-1 text-sm text-foreground">
                    Helm Values und Compose-Datei werden in die Deployment-Felder des Editors übernommen.
                  </p>
                  {!gitLabIntegration?.approvalRequired && (
                    <button
                      type="button"
                      onClick={onApplyDeployment}
                      disabled={!gitLabSnapshot.helmValuesContent?.trim() && !gitLabSnapshot.composeFileContent?.trim()}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Server className="h-3.5 w-3.5" />
                      In Deployment übernehmen
                    </button>
                  )}
                </div>
              </div>

              {gitLabSnapshot.warnings && gitLabSnapshot.warnings.length > 0 && (
                <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm text-warning">
                  <p className="font-semibold">Hinweise aus dem letzten Import</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {gitLabSnapshot.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {gitLabSnapshot.readmeContent?.trim() && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">README Vorschau</p>
                  <textarea
                    readOnly
                    value={gitLabSnapshot.readmeContent}
                    className="min-h-[220px] w-full rounded-2xl border border-border bg-field-background px-4 py-3 font-mono text-xs text-foreground outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
