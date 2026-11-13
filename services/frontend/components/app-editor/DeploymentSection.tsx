"use client";

import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Switch } from "@/components/panelui/switch";
import { Textarea } from "@/components/panelui/textarea";
import { type AppDraft, EditorCard, SettingRow, type UpdateApp } from "./shared";

type MethodKey = "showHelm" | "showCompose" | "showDocker";

export function DeploymentSection({ app, update }: { app: AppDraft; update: UpdateApp }) {
  const enabled = app.hasDeploymentAssistant !== false;
  const shown = (key: MethodKey) => app[key] !== false;
  const id = app.id || "app";

  const methodSwitch = (key: MethodKey, label: string) => (
    <Switch label={`${label} anzeigen`} checked={shown(key)} onCheckedChange={(value) => update({ [key]: value })} />
  );

  return (
    <>
      <EditorCard title="Installationsanleitung" description="Zeigt auf der Detailseite fertige Befehle zum Selbstbetrieb der App.">
        <SettingRow
          title="Installationsanleitung anzeigen"
          description="Ausschalten, wenn die App nur genutzt, aber nicht selbst installiert werden kann."
          control={<Switch label="Installationsanleitung anzeigen" checked={enabled} onCheckedChange={(hasDeploymentAssistant) => update({ hasDeploymentAssistant })} />}
        />
      </EditorCard>

      {enabled && (
        <>
          <EditorCard title="Helm" description="Für Kubernetes-Umgebungen." action={methodSwitch("showHelm", "Helm")}>
            {shown("showHelm") && (
              <>
                <Field>
                  <Field.Label>Chart-Repository</Field.Label>
                  <Input className="font-mono" value={app.helmRepo || ""} onChange={(event) => update({ helmRepo: event.target.value })} placeholder="oci://…" />
                </Field>
                <Field>
                  <Field.Label optional>Eigenes Helm-Kommando</Field.Label>
                  <Textarea className="font-mono" size="sm" value={app.customHelmCommand || ""} onChange={(event) => update({ customHelmCommand: event.target.value })} placeholder={`helm repo add …\nhelm install ${id} …/${id}`} />
                </Field>
                <Field>
                  <Field.Label optional>values.yaml</Field.Label>
                  <Textarea className="font-mono" size="sm" minRows={4} maxRows={20} value={app.customHelmValues || ""} onChange={(event) => update({ customHelmValues: event.target.value })} placeholder={"image:\n  tag: latest\nreplicas: 1"} />
                </Field>
                <Field>
                  <Field.Label optional>Hinweis</Field.Label>
                  <Input value={app.customHelmNote || ""} onChange={(event) => update({ customHelmNote: event.target.value })} placeholder="z. B. benötigte Secrets" />
                </Field>
              </>
            )}
          </EditorCard>

          <EditorCard title="Docker Compose" description="Für einen einzelnen Server." action={methodSwitch("showCompose", "Docker Compose")}>
            {shown("showCompose") && (
              <>
                <Field>
                  <Field.Label>Compose-Datei</Field.Label>
                  <Textarea className="font-mono" size="sm" minRows={6} maxRows={24} value={app.customComposeCommand || ""} onChange={(event) => update({ customComposeCommand: event.target.value })} placeholder={`services:\n  ${id}:\n    image: …`} />
                </Field>
                <Field>
                  <Field.Label optional>Hinweis</Field.Label>
                  <Input value={app.customComposeNote || ""} onChange={(event) => update({ customComposeNote: event.target.value })} />
                </Field>
              </>
            )}
          </EditorCard>

          <EditorCard title="Docker" description="Für einen einzelnen Container." action={methodSwitch("showDocker", "Docker")}>
            {shown("showDocker") && (
              <>
                <Field>
                  <Field.Label>Image</Field.Label>
                  <Input className="font-mono" value={app.dockerRepo || ""} onChange={(event) => update({ dockerRepo: event.target.value })} placeholder="registry/image:latest" />
                </Field>
                <Field>
                  <Field.Label optional>Eigenes Docker-Kommando</Field.Label>
                  <Textarea className="font-mono" size="sm" value={app.customDockerCommand || ""} onChange={(event) => update({ customDockerCommand: event.target.value })} placeholder={`docker run -d --name ${id} -p 8080:80 …`} />
                </Field>
                <Field>
                  <Field.Label optional>Hinweis</Field.Label>
                  <Input value={app.customDockerNote || ""} onChange={(event) => update({ customDockerNote: event.target.value })} />
                </Field>
              </>
            )}
          </EditorCard>
        </>
      )}
    </>
  );
}
