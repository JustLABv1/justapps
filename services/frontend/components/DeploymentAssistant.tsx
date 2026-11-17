"use client";

import { CodeBlock } from "@/components/CodeBlock";
import { Select } from "@/components/panelui/select";
import { Tabs } from "@/components/panelui/tabs";
import { AppConfig, DeploymentVariant } from "@/config/apps";
import { Code2, Ship, Terminal } from "lucide-react";
import { useState } from "react";

interface InstallStep {
  title: string;
  description?: string;
  code: string;
  filename: string;
  language: string;
}

const lines = (text: string) => text.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim());
const looksLikeCommands = (text: string) => lines(text).every((line) => /^(\$\s*)?(helm|docker|kubectl|oc|curl|export|cd|git|podman|sudo)\b/.test(line.trim()) || /\\$/.test(line) || /^\s+-/.test(line));

/** Splits a method's commands into numbered steps where their shape allows it, and keeps them as one step where it does not. */
function helmSteps(command: string, values?: string): InstallStep[] {
  const all = lines(command);
  const repo = all.filter((line) => /^\s*helm repo (add|update)\b/.test(line));
  const rest = all.filter((line) => !repo.includes(line));
  const steps: InstallStep[] = [];
  if (repo.length && rest.length) steps.push({ title: "Chart-Repository hinzufügen", code: repo.join("\n"), filename: "Terminal", language: "bash" });
  if (values) steps.push({ title: "Konfiguration anlegen", description: "Diesen Inhalt als values.yaml speichern.", code: values, filename: "values.yaml", language: "yaml" });
  steps.push({ title: repo.length && rest.length ? "Installieren" : "Befehl ausführen", code: (repo.length && rest.length ? rest : all).join("\n"), filename: "Terminal", language: "bash" });
  return steps;
}

function composeSteps(compose: string): InstallStep[] {
  if (looksLikeCommands(compose)) return [{ title: "Befehl ausführen", code: compose, filename: "Terminal", language: "bash" }];
  return [
    { title: "Compose-Datei anlegen", description: "Diesen Inhalt als compose.yaml speichern.", code: compose, filename: "compose.yaml", language: "yaml" },
    { title: "Starten", code: "docker compose up -d", filename: "Terminal", language: "bash" },
  ];
}

function dockerSteps(command: string): InstallStep[] {
  const all = lines(command);
  const pull = all.filter((line) => /^\s*docker pull\b/.test(line));
  const rest = all.filter((line) => !pull.includes(line));
  if (!pull.length || !rest.length) return [{ title: "Befehl ausführen", code: command, filename: "Terminal", language: "bash" }];
  return [
    { title: "Image laden", code: pull.join("\n"), filename: "Terminal", language: "bash" },
    { title: "Container starten", code: rest.join("\n"), filename: "Terminal", language: "bash" },
  ];
}

function StepList({ steps }: { steps: InstallStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li key={step.title} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4 pb-6 last:pb-0">
          {index < steps.length - 1 && <span aria-hidden="true" className="absolute top-8 bottom-1 left-[0.875rem] w-px bg-border" />}
          <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full border bg-background text-xs font-medium tabular-nums">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-2 pt-0.5">
            <div className="flex flex-col gap-0.5">
              <h4 className="text-sm font-medium"><span className="sr-only">Schritt {index + 1}: </span>{step.title}</h4>
              {step.description && <p className="text-sm text-muted-foreground">{step.description}</p>}
            </div>
            <CodeBlock code={step.code} label={step.title} filename={step.filename} language={step.language} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DeploymentAssistant({ app }: { app: AppConfig }) {
  const [variantIndex, setVariantIndex] = useState<string>("base");

  const variants = app.deploymentVariants ?? [];
  const activeVariant: DeploymentVariant | null = variantIndex === "base" ? null : variants[Number(variantIndex)] ?? null;

  const helmValues = activeVariant?.helmValues || app.customHelmValues;
  const image = app.dockerRepo || `ghcr.io/bund/${app.id}:latest`;

  const helmCommand = activeVariant?.helmCommand || app.customHelmCommand ||
    `helm repo add bund ${app.helmRepo || "https://charts.bund.de"}
helm install ${app.id} bund/${app.id}${helmValues ? " -f values.yaml" : ""}`;
  const dockerCommand = activeVariant?.dockerCommand || app.customDockerCommand ||
    `docker pull ${image}
docker run -d --name ${app.id} -p 8080:80 ${image}`;
  const composeCommand = activeVariant?.composeCommand || app.customComposeCommand ||
    `services:
  ${app.id}:
    image: ${image}
    ports:
      - "8080:80"
    restart: always`;

  const methods = [
    app.showHelm !== false && {
      id: "helm",
      label: "Helm",
      icon: <Ship />,
      hint: "Empfohlen für Kubernetes.",
      note: activeVariant?.helmNote || app.customHelmNote,
    },
    app.showCompose !== false && {
      id: "compose",
      label: "Docker Compose",
      icon: <Terminal />,
      hint: "Für lokale Erprobung und kleine Installationen.",
      note: activeVariant?.composeNote || app.customComposeNote,
    },
    app.showDocker !== false && {
      id: "docker",
      label: "Docker",
      icon: <Code2 />,
      hint: "Direkter Start eines Containers, etwa zum Testen.",
      note: activeVariant?.dockerNote || app.customDockerNote,
    },
  ].filter((method): method is Exclude<typeof method, false> => !!method);

  if (methods.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      {variants.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-sm font-medium">Variante</span>
          <Select
            items={[{ value: "base", label: "Standard" }, ...variants.map((variant, index) => ({ value: String(index), label: variant.name }))]}
            value={variantIndex}
            onValueChange={(value) => value && setVariantIndex(value)}
          >
            <Select.Trigger aria-label="Deployment-Variante" className="sm:w-64">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="base">Standard</Select.Item>
              {variants.map((variant, index) => (
                <Select.Item key={index} value={String(index)} description={variant.description}>{variant.name}</Select.Item>
              ))}
            </Select.Content>
          </Select>
          {activeVariant?.description && <p className="text-sm text-muted-foreground">{activeVariant.description}</p>}
        </div>
      )}

      <Tabs defaultValue={methods[0].id}>
        <Tabs.List aria-label="Installationsmethode" className={methods.length === 1 ? "hidden" : undefined}>
          {methods.map((method) => (
            <Tabs.Trigger key={method.id} value={method.id}>
              {method.icon}
              {method.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {methods.map((method) => (
          <Tabs.Content key={method.id} value={method.id} className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">{method.note || method.hint}</p>
            <StepList
              steps={method.id === "helm" ? helmSteps(helmCommand, helmValues) : method.id === "compose" ? composeSteps(composeCommand) : dockerSteps(dockerCommand)}
            />
          </Tabs.Content>
        ))}
      </Tabs>
    </div>
  );
}
