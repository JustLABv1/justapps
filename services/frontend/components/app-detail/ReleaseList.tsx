"use client";

import { ReleaseDiffViewer } from "@/components/ReleaseDiffViewer";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import type { AppRelease } from "@/config/apps";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

/** Releases as a vertical timeline, newest first, each with its diff on demand. */
export function ReleaseList({ releases }: { releases: AppRelease[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <ol className="relative flex flex-col">
      {releases.map((release, index) => {
        const expanded = open.has(release.id);
        return (
          <li key={release.id} className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 pb-8 last:pb-0">
            {index < releases.length - 1 && <span aria-hidden="true" className="absolute top-5 bottom-0 left-[0.5625rem] w-px bg-border" />}
            <span aria-hidden="true" className={`mt-1.5 size-3 justify-self-center rounded-full border-2 ${index === 0 ? "border-primary bg-primary" : "border-border bg-background"}`} />
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono font-medium">v{release.version}</span>
                <Badge variant={release.releaseType === "minor" ? "info" : "secondary"} size="sm">{release.releaseType}</Badge>
                <time dateTime={release.publishedAt} className="text-muted-foreground">
                  {new Date(release.publishedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                </time>
              </div>
              <h3 className="font-medium">{release.title}</h3>
              {release.summary && <p className="text-sm text-muted-foreground">{release.summary}</p>}
              {release.diffPreview && <p className="text-sm">{release.diffPreview}</p>}
              {release.changedAreas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {release.changedAreas.map((area) => <Badge key={area} variant="outline" size="sm">{area}</Badge>)}
                </div>
              )}
              {release.changeDetails.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ms-3 w-fit"
                    aria-expanded={expanded}
                    aria-controls={`release-diff-${release.id}`}
                    onClick={() => toggle(release.id)}
                  >
                    <ChevronDown className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                    {expanded ? "Änderungen ausblenden" : `${release.changeDetails.length} ${release.changeDetails.length === 1 ? "Änderung" : "Änderungen"} im Detail`}
                  </Button>
                  {expanded && (
                    <div id={`release-diff-${release.id}`} className="flex flex-col gap-3">
                      {release.changeDetails.map((detail) => <ReleaseDiffViewer key={`${detail.area}-${detail.field}`} detail={detail} />)}
                    </div>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
