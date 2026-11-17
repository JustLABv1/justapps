"use client";

import { fetchApi } from "@/lib/api";
import { Alert } from "@/components/panelui/alert";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Checkbox } from "@/components/panelui/checkbox";
import { Dialog } from "@/components/panelui/dialog";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Switch } from "@/components/panelui/switch";
import { toast } from "@/lib/toast";
import { Archive, Download, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

type BackupMode = "safe" | "full";
type RestoreMode = "merge" | "replace";

type SectionOption = {
  id: string;
  label: string;
  description: string;
  sensitive?: boolean;
};

type ImportStats = {
  created: number;
  updated: number;
  skipped: number;
};

type ImportResult = {
  message: string;
  restoreMode: RestoreMode;
  appliedSections: string[];
  warnings?: string[];
  stats: Record<string, ImportStats>;
};

type PendingExportAction = {
  mode: BackupMode;
  presetId: string;
  sections: string[];
};

type BackupUpload = {
  uploadId: string;
  chunkSize: number;
};

type BackupImportJob = {
  jobId: string;
  status: "processing";
};

type BackupImportJobStatus = {
  status: "processing" | "completed" | "failed";
  result?: ImportResult;
  error?: {
    error?: string;
    detail?: string;
  };
};

const sectionOptions: SectionOption[] = [
  {
    id: "apps",
    label: "Apps",
    description: "App-Stammdaten, Inhalte und Metadaten.",
  },
  {
    id: "appGroups",
    label: "Gruppen",
    description: "Gruppen-Metadaten und Mitgliedschaften.",
  },
  {
    id: "appRelations",
    label: "Relationen",
    description: "Verwandte Apps und bidirektionale Verknüpfungen.",
  },
  {
    id: "users",
    label: "Benutzer",
    description: "Konten, Rollen und Sperrstatus.",
    sensitive: true,
  },
  {
    id: "settings",
    label: "Einstellungen",
    description: "Erscheinungsbild, Detailfelder und Store-Konfiguration.",
  },
  {
    id: "repositoryProviders",
    label: "Repository-Provider",
    description: "Persistierte Provider-Einstellungen.",
  },
  {
    id: "repositoryAppLinks",
    label: "Repository-Linkstatus",
    description: "App-Verknüpfungen, Snapshots und Sync-Status.",
  },
  {
    id: "aiProviders",
    label: "AI-Provider",
    description: "AI-Provider-Einstellungen und verschlüsselte API-Keys.",
  },
  {
    id: "aiConversations",
    label: "AI-Chats",
    description: "Chat-Verläufe und zitierte Quellen.",
    sensitive: true,
  },
  {
    id: "tokens",
    label: "Tokens",
    description: "API- und Zugriffstoken.",
    sensitive: true,
  },
  { id: "favorites", label: "Favoriten", description: "Benutzerfavoriten." },
  {
    id: "ratings",
    label: "Ratings",
    description: "Bewertungen und Kommentare.",
  },
  {
    id: "faq",
    label: "FAQ",
    description: "Fragen, Antworten und hilfreiche Stimmen.",
  },
  {
    id: "audit",
    label: "Audit",
    description: "Audit-Log und Operationen.",
    sensitive: true,
  },
  {
    id: "assets",
    label: "Uploads",
    description: "Hochgeladene App-Icons, Logos, Favicons und Gruppen-Icons.",
  },
];

const sectionPresets = [
  {
    id: "full-safe",
    title: "Sicherer Voll-Backup",
    description:
      "Exportiert alle aktuell angebundenen Datenbereiche als verschlüsselte Backup-Datei. Passwort-Hashes und Token-Secrets werden entfernt.",
    mode: "safe" as const,
  },
  {
    id: "full-fidelity",
    title: "Voll-Backup mit sensiblen Daten",
    description:
      "Enthält zusätzlich Passwort-Hashes und Token-Secrets und wird ebenfalls als verschlüsselte Backup-Datei exportiert.",
    mode: "full" as const,
  },
  {
    id: "apps-only",
    title: "Apps inklusive Uploads exportieren",
    description:
      "Kompatibler, verschlüsselter Abschnittsexport für Apps inklusive referenzierter Uploads, ohne Benutzer- oder Systemeinstellungen.",
    mode: "safe" as const,
    sections: ["apps", "assets"],
  },
];

const backupPassphraseMinLength = 12;
const allSectionIds = sectionOptions.map((section) => section.id);
const assetDependentSectionIds = ["apps", "appGroups", "settings"];

function normalizeSectionSelection(sections: string[]) {
  const uniqueSections = Array.from(new Set(sections));
  const requiresAssets = assetDependentSectionIds.some((sectionId) =>
    uniqueSections.includes(sectionId),
  );
  if (!requiresAssets) {
    return uniqueSections;
  }
  if (uniqueSections.includes("assets")) {
    return uniqueSections;
  }
  return [...uniqueSections, "assets"];
}

function parseDownloadFilename(headerValue: string | null, fallback: string) {
  if (!headerValue) {
    return fallback;
  }
  const match = headerValue.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

function getRequestError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const errorPayload = payload as { detail?: unknown; error?: unknown };
  if (typeof errorPayload.detail === "string") {
    return errorPayload.detail;
  }
  if (typeof errorPayload.error === "string") {
    return errorPayload.error;
  }
  return fallback;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export default function BackupsPage() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isFullMode, setIsFullMode] = useState(false);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("merge");
  const [selectedSections, setSelectedSections] =
    useState<string[]>(allSectionIds);
  const [importing, setImporting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportPassphraseConfirm, setExportPassphraseConfirm] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [pendingExport, setPendingExport] =
    useState<PendingExportAction | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importPhase, setImportPhase] = useState<"uploading" | "processing">(
    "uploading",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allSectionsSelected = selectedSections.length === sectionOptions.length;
  const selectedSectionsParam = useMemo(
    () => selectedSections.join(","),
    [selectedSections],
  );
  const replaceBlocked = restoreMode === "replace" && !allSectionsSelected;
  const exportPassphraseValid =
    exportPassphrase.length >= backupPassphraseMinLength;
  const exportPassphraseMatches = exportPassphrase === exportPassphraseConfirm;
  const exportReady = exportPassphraseValid && exportPassphraseMatches;
  const exportModalOpen = pendingExport !== null;
  const importModalOpen = pendingImportFile !== null;

  const closeExportModal = () => {
    if (downloadingId) {
      return;
    }
    setPendingExport(null);
    setExportPassphrase("");
    setExportPassphraseConfirm("");
  };

  const closeImportModal = () => {
    if (importing) {
      return;
    }
    setPendingImportFile(null);
    setImportPassphrase("");
    setImportProgress(0);
    setImportPhase("uploading");
  };

  const openExportModal = (
    mode: BackupMode,
    presetId: string,
    sections?: string[],
  ) => {
    setPendingExport({ mode, presetId, sections: sections ?? allSectionIds });
    setExportPassphrase("");
    setExportPassphraseConfirm("");
  };

  const submitExport = async () => {
    if (!pendingExport) {
      return;
    }
    if (!exportReady) {
      toast.warning(
        "Bitte geben Sie eine Backup-Passphrase mit mindestens 12 Zeichen ein und bestätigen Sie diese.",
      );
      return;
    }

    setDownloadingId(pendingExport.presetId);
    try {
      const response = await fetchApi("/admin/backups/export", {
        method: "POST",
        body: JSON.stringify({
          mode: pendingExport.mode,
          sections: pendingExport.sections,
          passphrase: exportPassphrase,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload.detail ||
            payload.error ||
            "Backup konnte nicht erstellt werden.",
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const suffix =
        pendingExport.sections.length === 1
          ? pendingExport.sections[0]
          : pendingExport.sections.length < sectionOptions.length
            ? "selected"
            : "instance";
      anchor.href = url;
      anchor.download = parseDownloadFilename(
        response.headers.get("Content-Disposition"),
        `justapps-backup-${suffix}-${pendingExport.mode}-${new Date().toISOString().split("T")[0]}.jabackup`,
      );
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success("Verschlüsseltes Backup wurde heruntergeladen.");
      closeExportModal();
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Backup konnte nicht erstellt werden.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const toggleSection = (sectionId: string) => {
    setSelectedSections((current) =>
      normalizeSectionSelection(
        current.includes(sectionId)
          ? current.filter((section) => section !== sectionId)
          : [...current, sectionId],
      ),
    );
  };

  const selectAllSections = () => {
    setSelectedSections(allSectionIds);
  };

  const clearSections = () => {
    setSelectedSections([]);
  };

  const handleAdvancedExport = () => {
    if (selectedSections.length === 0) {
      toast.warning("Mindestens ein Abschnitt muss ausgewählt sein.");
      return;
    }
    openExportModal(
      isFullMode ? "full" : "safe",
      "advanced-export",
      selectedSections,
    );
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setSelectedFileName(file.name);
    if (selectedSections.length === 0) {
      toast.warning(
        "Mindestens ein Abschnitt muss für den Import ausgewählt sein.",
      );
      return;
    }
    if (replaceBlocked) {
      toast.warning(
        "Replace-Import ist aktuell nur mit vollständiger Abschnittsauswahl möglich.",
      );
      return;
    }
    setPendingImportFile(file);
    setImportPassphrase("");
    setImportProgress(0);
    setImportPhase("uploading");
  };

  const submitImport = async () => {
    if (!pendingImportFile) {
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setImportPhase("uploading");
    let uploadId = "";
    try {
      const createResponse = await fetchApi("/admin/backups/import/uploads", {
        method: "POST",
        body: JSON.stringify({
          fileName: pendingImportFile.name,
          size: pendingImportFile.size,
        }),
      });
      const upload = (await createResponse
        .json()
        .catch(() => null)) as BackupUpload | null;
      if (!createResponse.ok || !upload?.uploadId || !upload.chunkSize) {
        throw new Error(
          getRequestError(
            upload,
            "Backup-Upload konnte nicht gestartet werden.",
          ),
        );
      }
      uploadId = upload.uploadId;

      let offset = 0;
      while (offset < pendingImportFile.size) {
        const chunk = pendingImportFile.slice(
          offset,
          offset + upload.chunkSize,
        );
        const chunkResponse = await fetchApi(
          `/admin/backups/import/uploads/${encodeURIComponent(uploadId)}?offset=${offset}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: chunk,
          },
        );
        const chunkResult = await chunkResponse.json().catch(() => null);
        if (!chunkResponse.ok) {
          throw new Error(
            chunkResult?.detail ||
              chunkResult?.error ||
              "Ein Backup-Teil konnte nicht hochgeladen werden.",
          );
        }
        offset += chunk.size;
        setImportProgress(
          Math.min(99, Math.round((offset / pendingImportFile.size) * 100)),
        );
      }

      const response = await fetchApi(
        `/admin/backups/import/uploads/${encodeURIComponent(uploadId)}/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            restoreMode,
            sections: selectedSectionsParam,
            passphrase: importPassphrase,
          }),
        },
      );
      const job = (await response
        .json()
        .catch(() => null)) as BackupImportJob | null;
      if (!response.ok || !job?.jobId) {
        throw new Error(
          getRequestError(job, "Backup konnte nicht gestartet werden."),
        );
      }
      uploadId = "";
      setImportPhase("processing");

      let result: ImportResult | undefined;
      while (!result) {
        await wait(1000);
        const statusResponse = await fetchApi(
          `/admin/backups/import/jobs/${encodeURIComponent(job.jobId)}`,
          {
            cache: "no-store",
          },
        );
        const status = (await statusResponse
          .json()
          .catch(() => null)) as BackupImportJobStatus | null;
        if (!statusResponse.ok || !status) {
          throw new Error(
            getRequestError(
              status,
              "Importstatus konnte nicht geladen werden.",
            ),
          );
        }
        if (status.status === "failed") {
          throw new Error(
            getRequestError(
              status.error,
              "Backup konnte nicht importiert werden.",
            ),
          );
        }
        if (status.status === "completed") {
          if (!status.result) {
            throw new Error("Der Import wurde ohne Ergebnis abgeschlossen.");
          }
          result = status.result;
        }
      }

      setImportProgress(100);
      setImportResult(result);
      toast.success("Backup wurde importiert.");
      setPendingImportFile(null);
      setImportPassphrase("");
    } catch (error) {
      if (uploadId) {
        await fetchApi(
          `/admin/backups/import/uploads/${encodeURIComponent(uploadId)}`,
          {
            method: "DELETE",
          },
        ).catch(() => undefined);
      }
      toast.danger(
        error instanceof Error
          ? error.message
          : "Backup konnte nicht importiert werden.",
      );
    } finally {
      setImporting(false);
    }
  };

  const passphraseHint = !exportPassphrase
    ? "Geben Sie eine Passphrase ein, um den Export zu starten."
    : !exportPassphraseValid
      ? "Die Passphrase muss mindestens 12 Zeichen lang sein."
      : !exportPassphraseMatches
        ? "Die Bestätigung stimmt noch nicht mit der Passphrase überein."
        : "Passphrase bestätigt. Der Export kann jetzt gestartet werden.";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sicherung &amp; Wiederherstellung</h1>
        <p className="max-w-3xl text-pretty text-muted-foreground">
          Verschlüsselte Sicherungsdateien mit klar markierten Datenabschnitten. Vollständige Sicherungen und selektive Wiederherstellungen laufen über dieselbe Oberfläche.
        </p>
      </header>

      <Alert variant="plain" tone="warning">
        <Alert.Icon />
        <Alert.Title>Was gesichert wird</Alert.Title>
        <Alert.Description>
          Der Export deckt Apps, Gruppen, Relationen, Benutzer, Einstellungen, Repository-Zustand, Tokens, Favoriten, Ratings, FAQ, Audit-Daten und hochgeladene Dateien ab. Jede Sicherung wird mit einer Passphrase verschlüsselt. Der sichere Modus entfernt Passwort-Hashes und Token-Secrets. Legacy-JSON-Backups lassen sich weiter importieren, werden aber mit einer Warnung versehen. Replace-Restores bleiben auf Vollsicherungen beschränkt.
        </Alert.Description>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        {sectionPresets.map((preset) => (
          <Card key={preset.id}>
            <Card.Header>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Archive className="size-5" />
                </div>
                <div className="flex min-w-0 flex-col items-start gap-1">
                  <Card.Title>{preset.title}</Card.Title>
                  <Badge variant={preset.mode === "safe" ? "success" : "warning"} size="sm">
                    {preset.mode === "safe" ? "Empfohlen" : "Sensitiv"}
                  </Badge>
                </div>
              </div>
            </Card.Header>
            <Card.Content className="flex-1">
              <p className="text-sm text-muted-foreground">{preset.description}</p>
            </Card.Content>
            <Card.Footer>
              <Button className="w-full" loading={downloadingId === preset.id} disabled={Boolean(downloadingId)} onClick={() => openExportModal(preset.mode, preset.id, preset.sections)}>
                <Download />
                Export herunterladen
              </Button>
            </Card.Footer>
          </Card>
        ))}
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Selektiver Export und Import</Card.Title>
          <Card.Description>
            Wählen Sie gezielt Abschnitte aus, exportieren Sie nur den benötigten Umfang oder spielen Sie eine bestehende Sicherung im Merge- oder Replace-Modus zurück.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={selectAllSections}>Alle auswählen</Button>
                <Button size="sm" variant="secondary" onClick={clearSections}>Auswahl leeren</Button>
                <p className="text-sm text-muted-foreground">
                  {selectedSections.length} von {sectionOptions.length} Abschnitten ausgewählt
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {sectionOptions.map((section) => {
                  const isSelected = selectedSections.includes(section.id);
                  return (
                    <label
                      key={section.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl p-3.5 ring-1 transition-colors ${isSelected ? "bg-primary/5 ring-primary/40" : "bg-muted/30 ring-foreground/10 hover:bg-muted/60"}`}
                    >
                      <Checkbox className="mt-0.5" label={section.label} checked={isSelected} onCheckedChange={() => toggleSection(section.id)} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {section.label}
                          {section.sensitive && <Badge variant="warning" size="sm">Sensitiv</Badge>}
                        </span>
                        <span className="text-xs text-muted-foreground">{section.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-5 rounded-xl bg-muted/30 p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Vollständiger Export</span>
                  <Switch label="Vollständiger Export mit sensiblen Secrets" checked={isFullMode} onCheckedChange={setIsFullMode} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isFullMode ? "Vollständiger Modus mit sensiblen Secrets." : "Sicherer Modus ohne Passwort-Hashes und Token-Secrets."}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Restore-Modus</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={restoreMode === "merge" ? "default" : "secondary"} aria-pressed={restoreMode === "merge"} onClick={() => setRestoreMode("merge")}>Merge</Button>
                  <Button variant={restoreMode === "replace" ? "destructive" : "secondary"} aria-pressed={restoreMode === "replace"} onClick={() => setRestoreMode("replace")}>Replace</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {restoreMode === "merge"
                    ? "Merge aktualisiert vorhandene Datensätze und ergänzt fehlende Einträge."
                    : "Replace löscht die aktuelle Instanz und stellt den Backup-Stand vollständig wieder her."}
                </p>
                {replaceBlocked && <p className="text-xs font-medium text-warning">Replace ist nur mit vollständiger Abschnittsauswahl verfügbar.</p>}
              </div>

              <div className="flex flex-col gap-2 border-t pt-5">
                <Button loading={downloadingId === "advanced-export"} disabled={Boolean(downloadingId) || selectedSections.length === 0} onClick={handleAdvancedExport}>
                  <Download />
                  Auswahl exportieren
                </Button>
                <input ref={fileInputRef} type="file" accept="application/json,.json,.jabackup" className="hidden" onChange={handleImportFile} />
                <Button variant="secondary" loading={importing} disabled={selectedSections.length === 0 || replaceBlocked} onClick={handleImportClick}>
                  <Upload />
                  Backup importieren
                </Button>
                <p className="text-xs text-muted-foreground">
                  {selectedFileName ? `Letzte Datei: ${selectedFileName}` : "Die Passphrase wird nach der Dateiauswahl in einem Dialog abgefragt."}
                </p>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      {importResult && (
        <Card>
          <Card.Header>
            <Card.Title>Letztes Import-Ergebnis</Card.Title>
            <Card.Description>{importResult.message} · Modus: {importResult.restoreMode}</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(importResult.stats).map(([section, stats]) => (
                <div key={section} className="rounded-xl bg-muted/40 p-4">
                  <p className="text-sm font-medium">{section}</p>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div><dd className="font-semibold">{stats.created}</dd><dt className="text-xs text-muted-foreground">neu</dt></div>
                    <div><dd className="font-semibold">{stats.updated}</dd><dt className="text-xs text-muted-foreground">aktualisiert</dt></div>
                    <div><dd className="font-semibold">{stats.skipped}</dd><dt className="text-xs text-muted-foreground">übersprungen</dt></div>
                  </dl>
                </div>
              ))}
            </div>
            {importResult.warnings && importResult.warnings.length > 0 && (
              <Alert variant="plain" tone="warning">
                <Alert.Icon />
                <Alert.Title>Warnungen</Alert.Title>
                <Alert.Description>
                  <ul className="list-disc ps-4">
                    {importResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </Alert.Description>
              </Alert>
            )}
          </Card.Content>
        </Card>
      )}

      <Dialog open={exportModalOpen} onOpenChange={(open) => { if (!open) closeExportModal(); }}>
        <Dialog.Content size="md">
          <form
            className="flex min-h-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (exportReady && !downloadingId) void submitExport();
            }}
          >
            <Dialog.Header
              title="Backup verschlüsseln"
              description="Die Sicherung wird erst nach Eingabe einer Passphrase exportiert. Ohne diese Passphrase kann das Backup später nicht wiederhergestellt werden."
            />
            <Dialog.Body className="flex flex-col gap-4">
              {pendingExport && (
                <p className="text-xs text-muted-foreground">
                  {pendingExport.sections.length} Abschnitt{pendingExport.sections.length !== 1 ? "e" : ""} · {pendingExport.mode === "safe" ? "Sicherer Modus" : "Vollmodus"}
                </p>
              )}
              <Field>
                <Field.Label>Passphrase</Field.Label>
                <Input type="password" autoComplete="new-password" placeholder="Mindestens 12 Zeichen" value={exportPassphrase} onChange={(event) => setExportPassphrase(event.target.value)} />
              </Field>
              <Field>
                <Field.Label>Passphrase bestätigen</Field.Label>
                <Input type="password" autoComplete="new-password" placeholder="Passphrase erneut eingeben" value={exportPassphraseConfirm} onChange={(event) => setExportPassphraseConfirm(event.target.value)} />
              </Field>
              <p role="status" className={`text-sm ${exportReady ? "text-success" : "text-muted-foreground"}`}>{passphraseHint}</p>
            </Dialog.Body>
            <Dialog.Footer>
              <Button type="button" variant="secondary" disabled={Boolean(downloadingId)} onClick={closeExportModal}>Abbrechen</Button>
              <Button type="submit" loading={Boolean(downloadingId)} disabled={!exportReady}>
                <Download />
                Export herunterladen
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog>

      <Dialog open={importModalOpen} onOpenChange={(open) => { if (!open) closeImportModal(); }}>
        <Dialog.Content size="md">
          <form
            className="flex min-h-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (!importing && pendingImportFile) void submitImport();
            }}
          >
            <Dialog.Header
              title="Backup importieren"
              description={pendingImportFile ? `Datei: ${pendingImportFile.name}` : "Nach der Dateiauswahl kann der Import hier gestartet werden."}
            />
            <Dialog.Body className="flex flex-col gap-4">
              {restoreMode === "replace" && (
                <Alert variant="plain" tone="destructive">
                  <Alert.Icon />
                  <Alert.Title>Replace löscht die aktuelle Instanz und ersetzt sie vollständig durch den Backup-Stand.</Alert.Title>
                </Alert>
              )}
              <Field>
                <Field.Label>Passphrase</Field.Label>
                <Input type="password" autoComplete="current-password" placeholder="Nur für verschlüsselte Backups erforderlich" value={importPassphrase} onChange={(event) => setImportPassphrase(event.target.value)} />
                <Field.Description>
                  Für .jabackup-Dateien ist die Passphrase erforderlich. Legacy-JSON-Backups können ohne Passphrase importiert werden und erzeugen einen Warnhinweis.
                </Field.Description>
              </Field>
              {importing && (
                <div className="flex flex-col gap-2" role="status">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{importPhase === "uploading" ? "Backup wird in kleinen Teilen übertragen" : "Backup wird wiederhergestellt"}</span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${importProgress}%` }} />
                  </div>
                </div>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Button type="button" variant="secondary" disabled={importing} onClick={closeImportModal}>Abbrechen</Button>
              <Button type="submit" variant={restoreMode === "replace" ? "destructive" : "default"} loading={importing} disabled={!pendingImportFile}>
                <Upload />
                Backup importieren
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog>
    </div>
  );
}
