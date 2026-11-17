"use client";

import { Button } from "@/components/panelui/button";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Menu } from "@/components/panelui/menu";
import { Textarea } from "@/components/panelui/textarea";
import { uploadFile } from "@/lib/api";
import { getImageAssetUrl, isImageAssetSource } from "@/lib/assets";
import { toast } from "@/lib/toast";
import { Smile, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { type AppDraft, EditorCard, type UpdateApp } from "./shared";

const EMOJIS = ["🏛️", "📊", "💬", "🔐", "📅", "🚀", "🛠️", "📱", "🛡️", "⚙️", "📦", "📈", "🔑", "🏙️", "👥", "🗺️", "💰", "📝", "🌐", "🤖", "📧", "🗂️", "🔍", "🎓"];

export function AppIcon({ icon, size = "md" }: { icon?: string; size?: "sm" | "md" | "lg" }) {
  const image = getImageAssetUrl(icon);
  const box = size === "lg" ? "size-20 text-4xl rounded-2xl" : size === "sm" ? "size-9 text-lg rounded-lg" : "size-12 text-2xl rounded-xl";
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden border bg-muted ${box}`}>
      {image ? <Image src={image} alt="" fill sizes="80px" className="object-contain p-1.5" unoptimized /> : icon || "🏛️"}
    </span>
  );
}

export function BasicsSection({ app, update, nameMissing }: { app: AppDraft; update: UpdateApp; nameMissing: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [iconUrl, setIconUrl] = useState(isImageAssetSource(app.icon) ? app.icon || "" : "");

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadFile("/upload/logo", file);
      update({ icon: url });
      setIconUrl(url);
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "Logo konnte nicht hochgeladen werden.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <EditorCard title="Name und Beschreibung" description="So erscheint die App im Katalog und in der Suche.">
        <Field invalid={nameMissing}>
          <Field.Label required>App-Name</Field.Label>
          <Input size="lg" value={app.name || ""} onChange={(event) => update({ name: event.target.value })} placeholder="App-Name" />
          <Field.Error>Gib einen App-Namen ein.</Field.Error>
          <Field.Description>
            Technische ID: <code className="font-mono text-foreground">{app.id}</code> (nicht änderbar)
          </Field.Description>
        </Field>
        <Field>
          <Field.Label>Kurzbeschreibung</Field.Label>
          <Textarea
            minRows={3}
            value={app.description || ""}
            onChange={(event) => update({ description: event.target.value })}
            placeholder="Wofür ist die App da, und was bringt sie im Alltag?"
          />
          <Field.Description>Erscheint auf der Karte im Katalog. Für die Veröffentlichung erforderlich.</Field.Description>
        </Field>
      </EditorCard>

      <EditorCard title="Logo" description="Ein Bild oder ein Symbol. Quadratische Bilder wirken am besten.">
        <div className="flex flex-wrap items-center gap-4">
          <AppIcon icon={app.icon} size="lg" />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" loading={uploading} onClick={() => fileInput.current?.click()}>
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
                  <Menu.Item key={emoji} aria-label={`Symbol ${emoji}`} className="justify-center text-lg" onClick={() => { update({ icon: emoji }); setIconUrl(""); }}>
                    {emoji}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu>
          </div>
        </div>
        <Field>
          <Field.Label optional>Oder Bild-URL</Field.Label>
          <Input
            type="url"
            className="font-mono"
            value={iconUrl}
            placeholder="https://…"
            onChange={(event) => {
              const value = event.target.value;
              setIconUrl(value);
              if (isImageAssetSource(value)) update({ icon: value });
            }}
          />
        </Field>
      </EditorCard>
    </>
  );
}
