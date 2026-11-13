"use client";

import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Label } from "@/components/panelui/label";
import { Switch } from "@/components/panelui/switch";
import { Textarea } from "@/components/panelui/textarea";
import type { AppConfig } from "@/config/apps";
import { useMemo } from "react";
import { type AppDraft, EditorCard, SettingRow, type UpdateApp, ValueListField } from "./shared";

const CATEGORIES = ["Verwaltung", "Kommunikation", "Infrastruktur", "Sicherheit", "Datenanalyse", "Dokumentenmanagement", "Projektmanagement", "Bürgerdienste", "Geodaten", "Finanzen", "Personal", "Bildung", "Gesundheit", "Umwelt", "Verkehr", "KI & Automatisierung"];

/** Values other apps already use, so the catalogue stays consistent. */
function collect(apps: AppConfig[], pick: (app: AppConfig) => string[] | undefined, base: string[] = []) {
  const values = new Set(base);
  apps.forEach((app) => pick(app)?.forEach((value) => value?.trim() && values.add(value.trim())));
  return Array.from(values);
}

export function ClassificationSection({ app, update, existingApps }: { app: AppDraft; update: UpdateApp; existingApps: AppConfig[] }) {
  const categorySuggestions = useMemo(() => collect(existingApps, (item) => item.categories, CATEGORIES), [existingApps]);
  const tagSuggestions = useMemo(() => collect(existingApps, (item) => item.tags), [existingApps]);
  const techSuggestions = useMemo(() => collect(existingApps, (item) => item.techStack), [existingApps]);

  return (
    <>
      <EditorCard title="Katalog" description="Kategorien und Schlagwörter bestimmen, wo die App gefunden wird.">
        <div className="flex flex-col gap-2">
          <Label>Kategorien</Label>
          <ValueListField
            label="Kategorien"
            values={app.categories || []}
            suggestions={categorySuggestions}
            onChange={(categories) => update({ categories })}
            placeholder="Kategorie suchen oder eigene eingeben"
          />
          <span className="text-sm text-muted-foreground">Für die Veröffentlichung ist mindestens eine Kategorie erforderlich.</span>
        </div>
        <div className="flex flex-col gap-2">
          <Label optional>Schlagwörter</Label>
          <ValueListField
            label="Schlagwörter"
            values={app.tags || []}
            suggestions={tagSuggestions}
            onChange={(tags) => update({ tags })}
            placeholder="Schlagwort eingeben"
          />
        </div>
      </EditorCard>

      <EditorCard title="Herkunft und Technik">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Field.Label>Herausgeber</Field.Label>
            <Input value={app.authority || ""} onChange={(event) => update({ authority: event.target.value })} placeholder="z. B. Stadtverwaltung Musterstadt" />
          </Field>
          <Field>
            <Field.Label optional>Lizenz</Field.Label>
            <Input value={app.license || ""} onChange={(event) => update({ license: event.target.value })} placeholder="z. B. MIT oder EUPL-1.2" />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <Label optional>Technologien</Label>
          <ValueListField
            label="Technologien"
            values={app.techStack || []}
            suggestions={techSuggestions}
            onChange={(techStack) => update({ techStack })}
            placeholder="z. B. React, PostgreSQL"
          />
        </div>
      </EditorCard>

      <EditorCard title="Nachnutzung" description="Andere Stellen können die App als bestehende Lösung mitnutzen, ohne sie selbst zu betreiben.">
        <SettingRow
          title="Zur Nachnutzung anbieten"
          description="Die App erscheint im Katalog mit dem Merkmal „Nachnutzung“."
          control={<Switch label="Zur Nachnutzung anbieten" checked={!!app.isReuse} onCheckedChange={(isReuse) => update({ isReuse })} />}
        />
        {app.isReuse && (
          <Field>
            <Field.Label>Voraussetzungen und Grenzen</Field.Label>
            <Textarea
              minRows={3}
              value={app.reuseRequirements || ""}
              onChange={(event) => update({ reuseRequirements: event.target.value })}
              placeholder="Welche Behörden können die App nachnutzen? Was wird dafür benötigt?"
            />
          </Field>
        )}
      </EditorCard>
    </>
  );
}
