"use client";

import { Button } from "@/components/panelui/button";
import { Tooltip } from "@/components/panelui/tooltip";
import { Popover } from "@base-ui/react/popover";
import { Lightbulb } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { SectionId } from "./readiness";

interface Tip {
  id: string;
  /** The section a tip belongs to; without one it applies to the whole editor. */
  section?: SectionId;
  /** Only shown while the app is a draft, or only once it is published. */
  when?: "draft" | "published";
  text: ReactNode;
}

const code = (text: string) => <code className="rounded bg-muted px-1 font-mono text-[0.8125rem]">{text}</code>;

/** Short hints for the places people tend to get stuck. */
const TIPS: Tip[] = [
  {
    id: "maturity-on-publish",
    when: "draft",
    text: <>Den Reifegrad, etwa PoC oder Etabliert, wählst du beim Veröffentlichen oben rechts. Danach kannst du ihn in der Übersicht jederzeit ändern.</>,
  },
  {
    id: "save-everything",
    text: <>Du kannst frei zwischen den Bereichen wechseln: „Speichern“ (oder {code("⌘S")} / {code("Strg+S")}) übernimmt die Änderungen aus allen Bereichen auf einmal.</>,
  },
  {
    id: "search-fields",
    text: <>Du weißt nicht, in welchem Bereich ein Feld steht? Die Feldsuche oben in der Seitenleiste findet es und springt direkt hin.</>,
  },
  {
    id: "square-logo",
    section: "basics",
    text: <>Ein quadratisches Logo mit transparentem Hintergrund wirkt im Katalog und auf der App-Seite am besten.</>,
  },
  {
    id: "link-probe",
    section: "links",
    text: <>Live-Zugänge werden automatisch auf Erreichbarkeit geprüft. Liegen sie hinter einer Anmeldung oder einem VPN, schalte „Erreichbarkeit nicht prüfen“ ein, sonst erscheinen sie als nicht erreichbar.</>,
  },
  {
    id: "markdown-notes",
    section: "documentation",
    text: <>Die Dokumentation ist Markdown. Überschriften ergeben das Inhaltsverzeichnis auf der App-Seite, und {code("> [!NOTE]")}, {code("> [!TIP]")} oder {code("> [!WARNING]")} werden zu Hinweisboxen.</>,
  },
  {
    id: "repository-overwrites",
    section: "repository",
    text: <>Bei einer Synchronisierung können Dokumentation, Metadaten und Installationsangaben durch Inhalte aus dem Repository ersetzt werden. Was du dort von Hand änderst, kann dabei verloren gehen.</>,
  },
];

const STORAGE_KEY = "justapps.editor.seenTips";

function readSeen(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Without storage the dot simply comes back next time.
  }
}

function TipList({ title, tips }: { title: string; tips: Tip[] }) {
  if (tips.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-xs font-medium text-muted-foreground">{title}</span>
      <ul className="flex flex-col gap-1.5">
        {tips.map((tip) => (
          <li key={tip.id} className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm leading-relaxed text-pretty">{tip.text}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The editor's tips behind a lightbulb in the header: those for the open section first, then the general ones.
 * A dot on the lightbulb says there is a tip here that has not been looked at yet.
 */
export function EditorTips({ section, sectionLabel, draft }: { section: SectionId; sectionLabel: string; draft: boolean }) {
  // The editor only mounts in the browser, so storage can be read straight away.
  const [seen, setSeen] = useState<string[]>(() => (typeof window === "undefined" ? [] : readSeen()));

  const applies = (tip: Tip) => !tip.when || tip.when === (draft ? "draft" : "published");
  const sectionTips = TIPS.filter((tip) => tip.section === section && applies(tip));
  const generalTips = TIPS.filter((tip) => !tip.section && applies(tip));
  const shown = [...sectionTips, ...generalTips];
  const unseen = shown.some((tip) => !seen.includes(tip.id));

  const markSeen = () => {
    const next = [...new Set([...readSeen(), ...shown.map((tip) => tip.id)])];
    writeSeen(next);
    setSeen(next);
  };

  return (
    <Popover.Root onOpenChange={(open) => { if (open) markSeen(); }}>
      <Tooltip>
        <Tooltip.Trigger
          render={
            <Popover.Trigger
              render={<Button variant="ghost" size="icon-sm" aria-label={unseen ? "Tipps (neu)" : "Tipps"} className="relative" />}
            />
          }
        >
          <Lightbulb />
          {unseen && <span aria-hidden="true" className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-info ring-2 ring-background" />}
        </Tooltip.Trigger>
        <Tooltip.Content>Tipps</Tooltip.Content>
      </Tooltip>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50 outline-none">
          <Popover.Popup
            className="flex max-h-(--available-height) w-[22rem] max-w-[calc(100vw-2rem)] origin-(--transform-origin) flex-col gap-4 overflow-y-auto rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg outline-none transition-[opacity,scale] duration-150 ease-out data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
          >
            <Popover.Title className="flex items-center gap-2 px-1 text-sm font-semibold">
              <Lightbulb className="size-4 text-info" />
              Tipps
            </Popover.Title>
            <TipList title={sectionLabel} tips={sectionTips} />
            <TipList title="Allgemein" tips={generalTips} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
