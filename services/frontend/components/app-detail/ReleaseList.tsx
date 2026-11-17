"use client";

import { ReleaseDiffViewer } from "@/components/ReleaseDiffViewer";
import { Badge, type BadgeVariant } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import type { AppRelease } from "@/config/apps";
import { BookOpen, ChevronDown, Server, Tags } from "lucide-react";
import { type ReactNode, useState } from "react";

export const RELEASE_TYPE: Record<string, { label: string; variant: BadgeVariant }> = {
  major: { label: "Großes Update", variant: "info" },
  minor: { label: "Update", variant: "info" },
  patch: { label: "Kleine Änderung", variant: "secondary" },
};

export const AREAS: Record<string, { label: string; icon: ReactNode }> = {
  docs: { label: "Dokumentation", icon: <BookOpen /> },
  deployment: { label: "Installation", icon: <Server /> },
  metadata: { label: "Beschreibung und Angaben", icon: <Tags /> },
};
const areaLabel = (area: string) => AREAS[area]?.label ?? area;

/** "A, B und C" */
function joinGerman(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`;
}

function Release({ release, isNew, latest, last }: { release: AppRelease; isNew: boolean; latest: boolean; last: boolean }) {
  // Which change details are open; each opens on its own.
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (index: number) => setOpen((previous) => {
    const next = new Set(previous);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });
  const allOpen = release.changeDetails.length > 0 && open.size === release.changeDetails.length;
  const type = RELEASE_TYPE[release.releaseType] ?? { label: release.releaseType, variant: "secondary" as BadgeVariant };
  const changed = release.changeDetails.map((detail) => detail.label).filter(Boolean);

  return (
    <li className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 pb-10 last:pb-0">
      {!last && <span aria-hidden="true" className="absolute top-5 bottom-0 left-[0.5625rem] w-px bg-border" />}
      <span
        aria-hidden="true"
        className={`mt-1.5 size-3 justify-self-center rounded-full border-2 ${isNew ? "border-info bg-info" : latest ? "border-primary bg-primary" : "border-border bg-background"}`}
      />
      <article className="flex min-w-0 flex-col gap-2.5" aria-label={`Version ${release.version}`}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono font-medium">v{release.version}</span>
          <Badge variant={type.variant} size="sm">{type.label}</Badge>
          {isNew && <Badge variant="info" size="sm" dot>Neu für dich</Badge>}
          <time dateTime={release.publishedAt} className="text-muted-foreground">
            {new Date(release.publishedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
          </time>
        </div>
        <h3 className="font-medium">{release.title}</h3>
        {release.summary && <p className="text-sm text-muted-foreground">{release.summary}</p>}
        {release.diffPreview && <p className="text-sm">{release.diffPreview}</p>}

        {release.changedAreas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {release.changedAreas.map((area) => (
              <Badge key={area} variant="outline" size="sm">
                {AREAS[area]?.icon}
                {areaLabel(area)}
              </Badge>
            ))}
          </div>
        )}

        {release.changeDetails.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-sm text-muted-foreground">
              Geändert: <span className="text-foreground">{joinGerman(changed)}</span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {release.changeDetails.map((detail, index) => (
                <Button
                  key={`${detail.area}-${detail.field}`}
                  variant={open.has(index) ? "secondary" : "outline"}
                  size="sm"
                  shape="pill"
                  aria-expanded={open.has(index)}
                  aria-controls={`release-${release.id}-diff-${index}`}
                  onClick={() => toggle(index)}
                >
                  <ChevronDown className={`transition-transform ${open.has(index) ? "rotate-180" : ""}`} />
                  {detail.label}
                </Button>
              ))}
              {release.changeDetails.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(allOpen ? new Set() : new Set(release.changeDetails.map((_, index) => index)))}
                >
                  {allOpen ? "Alle schließen" : "Alle Änderungen zeigen"}
                </Button>
              )}
            </div>
            {release.changeDetails.map((detail, index) => open.has(index) && (
              <div key={`${detail.area}-${detail.field}`} id={`release-${release.id}-diff-${index}`}>
                <ReleaseDiffViewer detail={detail} />
              </div>
            ))}
          </div>
        )}
      </article>
    </li>
  );
}

/** Releases as a vertical timeline, newest first, each change detail opening on its own. */
export function ReleaseList({ releases, newReleaseIds }: { releases: AppRelease[]; newReleaseIds?: Set<string> }) {
  return (
    <ol className="relative flex flex-col">
      {releases.map((release, index) => (
        <Release
          key={release.id}
          release={release}
          isNew={!!newReleaseIds?.has(release.id)}
          latest={index === 0}
          last={index === releases.length - 1}
        />
      ))}
    </ol>
  );
}
