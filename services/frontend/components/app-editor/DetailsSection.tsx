"use client";

import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Label } from "@/components/panelui/label";
import { RadioGroup } from "@/components/panelui/radio-group";
import { Textarea } from "@/components/panelui/textarea";
import type { AppField } from "@/config/apps";
import { type AppDraft, EditorCard, type UpdateApp } from "./shared";

interface DetailFieldDefinition {
  key: string;
  label: string;
}

/** Platform-defined fields, such as hosting or data protection, filled in per app. */
export function DetailsSection({ app, update, definitions }: { app: AppDraft; update: UpdateApp; definitions: DetailFieldDefinition[] }) {
  const value = (key: string) => app.customFields?.find((field) => field.key === key)?.value || "";
  const set = (key: string, next: string) =>
    update((previous) => {
      const fields: AppField[] = (previous.customFields || []).filter((field) => field.key !== key);
      if (next) fields.push({ key, value: next });
      return { ...previous, customFields: fields };
    });

  return (
    <EditorCard title="Fachliche Details" description="Leere Felder erscheinen nicht auf der Detailseite. Welche Felder es gibt, legt die Verwaltung fest.">
      {definitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Für diese Plattform sind keine fachlichen Felder eingerichtet.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {definitions.map((definition) => (
            <Field key={definition.key}>
              <Field.Label optional>{definition.label}</Field.Label>
              <Input value={value(definition.key)} onChange={(event) => set(definition.key, event.target.value)} />
            </Field>
          ))}
        </div>
      )}
    </EditorCard>
  );
}

const BANNER_TYPES = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warnung" },
  { value: "danger", label: "Kritisch" },
  { value: "custom", label: "Eigene Farbe" },
] as const;

/** A notice shown at the top of the app's page. */
export function BannerSection({ app, update }: { app: AppDraft; update: UpdateApp }) {
  const type = app.bannerType || "info";
  return (
    <EditorCard
      title="Hinweis auf der App-Seite"
      description="Zum Beispiel eine Wartung, eine Abkündigung oder ein bekanntes Problem. Ohne Text wird kein Hinweis angezeigt."
    >
      <RadioGroup
        orientation="horizontal"
        aria-label="Art des Hinweises"
        value={type}
        onValueChange={(value) => {
          const bannerType = value as NonNullable<AppDraft["bannerType"]>;
          update({ bannerType, ...(bannerType !== "custom" ? { bannerColor: "" } : {}) });
        }}
      >
        {BANNER_TYPES.map((option) => (
          <Label key={option.value}>
            <RadioGroup.Item value={option.value} />
            <Label.Text>{option.label}</Label.Text>
          </Label>
        ))}
      </RadioGroup>
      {type === "custom" && (
        <Field className="max-w-xs">
          <Field.Label>Farbe</Field.Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Farbe wählen"
              value={app.bannerColor || "#6366f1"}
              onChange={(event) => update({ bannerColor: event.target.value })}
              className="size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
            />
            <Input className="font-mono" value={app.bannerColor || ""} placeholder="#RRGGBB" onChange={(event) => update({ bannerColor: event.target.value })} />
          </div>
        </Field>
      )}
      <Field>
        <Field.Label optional>Überschrift</Field.Label>
        <Input value={app.bannerTitle || ""} onChange={(event) => update({ bannerTitle: event.target.value })} />
      </Field>
      <Field>
        <Field.Label>Hinweistext</Field.Label>
        <Textarea minRows={2} value={app.bannerText || ""} onChange={(event) => update({ bannerText: event.target.value })} />
      </Field>
    </EditorCard>
  );
}
