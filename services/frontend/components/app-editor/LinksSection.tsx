"use client";

import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Switch } from "@/components/panelui/switch";
import { type AppDraft, EditorCard, LinkListField, SettingRow, type UpdateApp } from "./shared";

export function LinksSection({ app, update }: { app: AppDraft; update: UpdateApp }) {
  return (
    <>
      <EditorCard title="Live-Zugänge" description="Wo die App genutzt oder ausprobiert werden kann.">
        <LinkListField
          title="Live-Zugänge"
          description="Produktivumgebung, Demo oder Testzugang."
          labelPlaceholder="z. B. Demo"
          items={(app.liveDemos || []).map((item) => ({ label: item.label || "", url: item.url || "" }))}
          onChange={(liveDemos) => update({ liveDemos })}
        />
        <SettingRow
          title="Erreichbarkeit nicht prüfen"
          description="Einschalten, wenn die Live-Zugänge hinter einer Anmeldung oder einem VPN liegen."
          control={<Switch label="Erreichbarkeit nicht prüfen" checked={!!app.skipLinkProbe} onCheckedChange={(skipLinkProbe) => update({ skipLinkProbe })} />}
        />
      </EditorCard>

      <EditorCard title="Quellcode und Ressourcen">
        <LinkListField
          title="Quellcode"
          description="Repositories der App."
          labelPlaceholder="z. B. GitLab"
          items={(app.repositories || []).map((item) => ({ label: item.label || "", url: item.url || "" }))}
          onChange={(repositories) => update({ repositories })}
        />
        <LinkListField
          title="Weitere Links"
          description="Handbücher, Ansprechpartner, Projektseiten."
          labelPlaceholder="z. B. Handbuch"
          items={(app.customLinks || []).map((item) => ({ label: item.label || "", url: item.url || "" }))}
          onChange={(customLinks) => update({ customLinks })}
        />
        <Field>
          <Field.Label optional>Externe Dokumentation</Field.Label>
          <Input type="url" className="font-mono" value={app.docsUrl || ""} onChange={(event) => update({ docsUrl: event.target.value })} placeholder="https://docs…" />
        </Field>
      </EditorCard>
    </>
  );
}
