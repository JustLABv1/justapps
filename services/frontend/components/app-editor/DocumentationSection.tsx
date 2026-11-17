"use client";

import { Alert } from "@/components/panelui/alert";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Textarea } from "@/components/panelui/textarea";
import { suggestChangelog, type ChangelogSuggestion } from "@/lib/ai";
import { toast } from "@/lib/toast";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { type AppDraft, EditorCard, type UpdateApp } from "./shared";

const sanitizeLinks = (links?: { label?: string; url?: string }[]) =>
  (links || []).filter((link) => link.url?.trim()).map((link) => ({ label: link.label || "Link", url: link.url! }));

export function DocumentationSection({ app, update, aiEnabled }: { app: AppDraft; update: UpdateApp; aiEnabled: boolean }) {
  const [generating, setGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<ChangelogSuggestion | null>(null);

  const generate = async () => {
    setGenerating(true);
    try {
      setSuggestion(await suggestChangelog({
        appId: app.id || undefined,
        name: app.name || "",
        version: app.version || "",
        currentChangelog: app.changelog || "",
        description: app.description || "",
        license: app.license || "",
        markdownContent: app.markdownContent || "",
        customHelmValues: app.customHelmValues || "",
        customComposeCommand: app.customComposeCommand || "",
        tags: app.tags || [],
        repositories: sanitizeLinks(app.repositories),
      }));
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "AI-Changelog konnte nicht erzeugt werden.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <EditorCard title="Dokumentation" description="Markdown, das auf der Detailseite der App erscheint. Überschriften, Listen, Code und Links sind möglich.">
        <Textarea
          aria-label="Dokumentation (Markdown)"
          className="font-mono"
          size="sm"
          minRows={16}
          maxRows={40}
          value={app.markdownContent || ""}
          onChange={(event) => update({ markdownContent: event.target.value })}
          placeholder={`# ${app.name || "App-Name"}\n\nBeschreibe die App im Detail …\n\n## Funktionen\n\n- …`}
        />
      </EditorCard>

      <EditorCard
        title="Version und Änderungen"
        description="Was sich in der aktuellen Version geändert hat."
        action={aiEnabled && (
          <Button variant="outline" size="sm" loading={generating} onClick={() => void generate()}>
            <Sparkles />
            Mit AI erstellen
          </Button>
        )}
      >
        <Field className="max-w-xs">
          <Field.Label optional>Version</Field.Label>
          <Input className="font-mono" value={app.version || ""} onChange={(event) => update({ version: event.target.value })} placeholder="z. B. 1.2.3" />
        </Field>
        <Field>
          <Field.Label optional>Änderungsprotokoll</Field.Label>
          <Textarea
            className="font-mono"
            size="sm"
            minRows={6}
            maxRows={24}
            value={app.changelog || ""}
            onChange={(event) => update({ changelog: event.target.value })}
            placeholder={"## 1.2.3\n- Neue Funktion …\n- Fehlerbehebung …"}
          />
        </Field>
      </EditorCard>

      <Dialog open={!!suggestion} onOpenChange={(open) => { if (!open) setSuggestion(null); }}>
        <Dialog.Content size="lg">
          <Dialog.Header title="AI-Changelog-Vorschlag" description="Der Vorschlag basiert auf den erkannten Änderungen. Prüfe und bearbeite ihn vor dem Übernehmen." />
          <Dialog.Body className="flex flex-col gap-5">
            <Alert variant="plain" tone="info">
              <Alert.Icon><Sparkles /></Alert.Icon>
              <Alert.Title>Wird erst mit „Speichern“ gespeichert</Alert.Title>
            </Alert>
            {suggestion && (
              <>
                <Field>
                  <Field.Label>Titel</Field.Label>
                  <Input value={suggestion.title} onChange={(event) => setSuggestion({ ...suggestion, title: event.target.value })} />
                </Field>
                <Field>
                  <Field.Label>Zusammenfassung</Field.Label>
                  <Textarea minRows={3} value={suggestion.summary} onChange={(event) => setSuggestion({ ...suggestion, summary: event.target.value })} />
                </Field>
                <Field>
                  <Field.Label>Änderungsprotokoll (Markdown)</Field.Label>
                  <Textarea className="font-mono" size="sm" minRows={10} value={suggestion.changelog} onChange={(event) => setSuggestion({ ...suggestion, changelog: event.target.value })} />
                </Field>
              </>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close render={<Button variant="secondary" />}>Abbrechen</Dialog.Close>
            <Button
              disabled={!suggestion?.changelog.trim()}
              onClick={() => {
                if (!suggestion) return;
                update({ changelog: suggestion.changelog });
                setSuggestion(null);
                toast.success("Änderungsprotokoll übernommen.");
              }}
            >
              Übernehmen
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
