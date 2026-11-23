'use client';

import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import type { AppConfig } from '@/config/apps';
import { getRelativeTimeMeta } from '@/lib/appFreshness';
import { getImageAssetUrl } from '@/lib/assets';
import { Tooltip } from '@/components/panelui/tooltip';
import type { RecentApp } from '@/lib/recentlyViewed';
import { ArrowRight, X } from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';

const WINDOW_DAYS = 14;
const LIMIT = 3;
const RECENT_LIMIT = 5;
/** An edit within the first hour after creation still counts as part of creating it. */
const UPDATE_GRACE_MS = 60 * 60 * 1000;

const LAST_VISIT_KEY = 'justapps:changes:last-visit';
const DISMISSED_KEY = 'justapps:changes:dismissed-at';
const SESSION_BASELINE_KEY = 'justapps:changes:baseline';

interface Change {
  app: AppConfig;
  kind: 'new' | 'updated';
  at: string;
}

function readNumber(storage: Storage | undefined, key: string): number {
  try {
    const value = Number(storage?.getItem(key));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Anything older than this has already been seen. It is the later of the previous
 * visit and the last dismissal; the previous visit is pinned per tab session so a
 * reload does not make the section vanish.
 */
function readSeenUntil(now: number): { baseline: number; dismissedAt: number } {
  let baseline = readNumber(window.sessionStorage, SESSION_BASELINE_KEY);
  if (!baseline) {
    baseline = readNumber(window.localStorage, LAST_VISIT_KEY);
    try {
      window.sessionStorage.setItem(SESSION_BASELINE_KEY, String(baseline || 1));
    } catch {}
  }
  try {
    window.localStorage.setItem(LAST_VISIT_KEY, String(now));
  } catch {}
  return { baseline: baseline > 1 ? baseline : 0, dismissedAt: readNumber(window.localStorage, DISMISSED_KEY) };
}

function recentChanges(apps: AppConfig[], now: number, seenUntil: number): Change[] {
  const since = Math.max(now - WINDOW_DAYS * 24 * 60 * 60 * 1000, seenUntil);
  const changes: Change[] = [];
  for (const app of apps) {
    const created = app.createdAt ? new Date(app.createdAt).getTime() : 0;
    const updated = app.updatedAt ? new Date(app.updatedAt).getTime() : 0;
    if (updated > since && updated - created > UPDATE_GRACE_MS) changes.push({ app, kind: 'updated', at: app.updatedAt! });
    else if (created > since) changes.push({ app, kind: 'new', at: app.createdAt! });
  }
  return changes.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function AppIcon({ app }: { app: AppConfig }) {
  const src = getImageAssetUrl(app.icon);
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-lg">
      {src ? <Image src={src} alt="" fill sizes="36px" className="object-contain p-1" unoptimized /> : app.icon || '🏛️'}
    </span>
  );
}

interface Props {
  apps: AppConfig[];
  /** Show the "what changed" half (off inside a space). */
  showChanges?: boolean;
  recentApps: RecentApp[];
  onHideRecent: () => void;
}

/**
 * One card for what is relevant to the user: apps changed since their last visit,
 * and the apps they looked at recently. Renders nothing when both halves are empty.
 */
export function RecentChanges({ apps, showChanges = true, recentApps, onHideRecent }: Props) {
  // Time and storage are read after mount, so the server and the first client render agree.
  const [state, setState] = useState<{ now: number; baseline: number; dismissedAt: number } | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const now = Date.now();
      setState({ now, ...readSeenUntil(now) });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (state === null) return null;
  const { now, baseline, dismissedAt } = state;
  const all = showChanges ? recentChanges(apps, now, Math.max(baseline, dismissedAt)) : [];
  const changes = all.slice(0, LIMIT);
  const more = all.length - changes.length;
  const newCount = all.filter((change) => change.kind === 'new').length;
  const updatedCount = all.length - newCount;
  const summary = [
    newCount > 0 ? `${newCount} neu` : null,
    updatedCount > 0 ? `${updatedCount} aktualisiert` : null,
  ].filter(Boolean).join(' · ');

  // An app already shown above is not repeated in the recents row.
  const shownIds = new Set(changes.map(({ app }) => app.id));
  const recents = recentApps.filter((app) => !shownIds.has(app.id)).slice(0, RECENT_LIMIT);

  if (changes.length === 0 && recents.length === 0) return null;

  const dismissChanges = () => {
    const at = Date.now();
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(at));
    } catch {}
    setState({ ...state, dismissedAt: at });
  };

  return (
    <section aria-label="Für dich" className="flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.07]">
      {changes.length > 0 && (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 id="recent-changes" className="shrink-0 text-base font-semibold tracking-tight">Seit deinem letzten Besuch</h2>
              <span className="truncate text-sm text-muted-foreground">{summary}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" render={<NextLink href="/neuigkeiten" />}>
                Wochenrückblick
                <ArrowRight />
              </Button>
              <Tooltip>
                <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Änderungen ausblenden" onClick={dismissChanges} />}>
                  <X />
                </Tooltip.Trigger>
                <Tooltip.Content>Ausblenden, bis es Neues gibt</Tooltip.Content>
              </Tooltip>
            </div>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {changes.map(({ app, kind, at }) => (
              <li key={app.id}>
                <NextLink
                  href={`/apps/${encodeURIComponent(app.id)}`}
                  className="flex items-center gap-3 rounded-xl bg-muted/30 p-3 ring-1 ring-foreground/[0.07] outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <AppIcon app={app} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{app.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {getRelativeTimeMeta(at, now)?.label}
                      {app.categories?.[0] ? ` · ${app.categories[0]}` : ''}
                    </span>
                  </span>
                  <Badge variant={kind === 'new' ? 'success' : 'info'} size="sm" className="shrink-0">
                    {kind === 'new' ? 'Neu' : 'Aktualisiert'}
                  </Badge>
                </NextLink>
              </li>
            ))}
          </ul>
          {more > 0 && (
            <NextLink href="/neuigkeiten" className="self-start rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              + {more} weitere
            </NextLink>
          )}
        </div>
      )}

      {recents.length > 0 && (
        <div className={`flex items-center gap-3 px-4 py-3 ${changes.length > 0 ? 'border-t bg-muted/20' : ''}`}>
          <h2 id="recently-viewed" className="shrink-0 text-sm text-muted-foreground">Zuletzt gesehen</h2>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-hide">
            {recents.map((app) => {
              const iconSrc = getImageAssetUrl(app.icon);
              return (
                <Button key={app.id} variant="outline" size="sm" shape="pill" className="shrink-0" render={<NextLink href={`/apps/${app.id}`} />}>
                  {iconSrc ? (
                    <span className="relative size-4 shrink-0">
                      <Image src={iconSrc} alt="" fill className="object-contain" sizes="16px" unoptimized />
                    </span>
                  ) : (
                    <span className="text-sm leading-none">{app.icon || '🏛️'}</span>
                  )}
                  {app.name}
                </Button>
              );
            })}
          </div>
          <Tooltip>
            <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" aria-label="„Zuletzt gesehen“ ausblenden" onClick={onHideRecent} />}>
              <X />
            </Tooltip.Trigger>
            <Tooltip.Content>Ausblenden – bleibt in der Suche (⌘K)</Tooltip.Content>
          </Tooltip>
        </div>
      )}
    </section>
  );
}
