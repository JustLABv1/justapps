'use client';

import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import type { AppConfig } from '@/config/apps';
import { getRelativeTimeMeta } from '@/lib/appFreshness';
import { getImageAssetUrl } from '@/lib/assets';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';

const WINDOW_DAYS = 14;
const LIMIT = 6;
/** An edit within the first hour after creation still counts as part of creating it. */
const UPDATE_GRACE_MS = 60 * 60 * 1000;

interface Change {
  app: AppConfig;
  kind: 'new' | 'updated';
  at: string;
}

function recentChanges(apps: AppConfig[], now: number): Change[] {
  const since = now - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const changes: Change[] = [];
  for (const app of apps) {
    const created = app.createdAt ? new Date(app.createdAt).getTime() : 0;
    const updated = app.updatedAt ? new Date(app.updatedAt).getTime() : 0;
    if (updated > since && updated - created > UPDATE_GRACE_MS) changes.push({ app, kind: 'updated', at: app.updatedAt! });
    else if (created > since) changes.push({ app, kind: 'new', at: app.createdAt! });
  }
  return changes.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, LIMIT);
}

function AppIcon({ app }: { app: AppConfig }) {
  const src = getImageAssetUrl(app.icon);
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-lg">
      {src ? <Image src={src} alt="" fill sizes="36px" className="object-contain p-1" unoptimized /> : app.icon || '🏛️'}
    </span>
  );
}

/** The apps added or changed in the last two weeks, newest first. */
export function RecentChanges({ apps }: { apps: AppConfig[] }) {
  // "Now" is read after mount, so the server and the first client render agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (now === null) return null;
  const changes = recentChanges(apps, now);
  if (changes.length === 0) return null;

  return (
    <section aria-labelledby="recent-changes" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-changes" className="text-base font-semibold tracking-tight">Neu &amp; aktualisiert</h2>
        <Button variant="ghost" size="sm" render={<NextLink href="/neuigkeiten" />}>
          Wochenrückblick
          <ArrowRight />
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {changes.map(({ app, kind, at }) => (
          <li key={app.id}>
            <NextLink
              href={`/apps/${encodeURIComponent(app.id)}`}
              className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/[0.07] outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
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
    </section>
  );
}
