'use client';

import { AppStoreGate } from '@/components/AppStoreGate';
import { GroupIcon } from '@/components/GroupIcon';
import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { getAppFreshness, getRelativeTimeMeta } from '@/lib/appFreshness';
import { ArrowRight, Layers2, Loader2, Sparkles, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';

interface AppGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface EnrichedAppGroup extends AppGroup {
  members: AppConfig[];
  appCount: number;
  featuredCount: number;
  reuseCount: number;
  freshCount: number;
  previewApps: AppConfig[];
  topCategories: string[];
  lastUpdatedLabel?: string;
}

async function loadGroups(): Promise<AppGroup[]> {
  try {
    const res = await fetchApi('/app-groups', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function loadApps(): Promise<AppConfig[]> {
  try {
    const res = await fetchApi('/apps', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function getTopCategories(members: AppConfig[]): string[] {
  const counts = new Map<string, number>();

  for (const app of members) {
    for (const category of app.categories || []) {
      counts.set(category, (counts.get(category) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'de'))
    .slice(0, 3)
    .map(([category]) => category);
}

function getLatestUpdatedAt(members: AppConfig[]): string | undefined {
  return members
    .map((app) => app.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

function enrichGroups(groups: AppGroup[], apps: AppConfig[]): EnrichedAppGroup[] {
  return groups
    .map((group) => {
      const members = apps.filter((app) => app.appGroups?.some((entry) => entry.id === group.id));
      const previewApps = [...members]
        .sort((left, right) => {
          const leftFreshness = getAppFreshness(left).kind;
          const rightFreshness = getAppFreshness(right).kind;
          const freshnessRank = { reuse: 3, new: 2, updated: 1, none: 0 };

          return (Number(right.isFeatured) - Number(left.isFeatured))
            || (freshnessRank[rightFreshness] - freshnessRank[leftFreshness])
            || (new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());
        })
        .slice(0, 3);

      const freshCount = members.filter((app) => {
        const kind = getAppFreshness(app).kind;
        return kind === 'new' || kind === 'updated';
      }).length;

      return {
        ...group,
        members,
        appCount: members.length,
        featuredCount: members.filter((app) => app.isFeatured).length,
        reuseCount: members.filter((app) => app.isReuse).length,
        freshCount,
        previewApps,
        topCategories: getTopCategories(members),
        lastUpdatedLabel: getRelativeTimeMeta(getLatestUpdatedAt(members))?.label,
      };
    })
    .sort((left, right) => right.appCount - left.appCount || right.featuredCount - left.featuredCount || left.name.localeCompare(right.name, 'de'));
}

function GruppenPageContent() {
  const [groups, setGroups] = useState<AppGroup[]>([]);
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([loadGroups(), loadApps()])
      .then(([nextGroups, nextApps]) => {
        if (!active) {
          return;
        }

        setGroups(nextGroups);
        setApps(nextApps);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  const enrichedGroups = enrichGroups(groups, apps);
  const totalGroupedApps = new Set(enrichedGroups.flatMap((group) => group.members.map((app) => app.id))).size;
  const totalFreshApps = enrichedGroups.reduce((sum, group) => sum + group.freshCount, 0);

  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-surface px-6 py-7 shadow-sm sm:px-8 sm:py-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(0,75,118,0.12),transparent_60%)] sm:block" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Entdecken
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">App-Gruppen</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
              Gruppen bündeln thematisch passende Apps, zeigen schnelle Einstiege und machen sichtbarer,
              wo gerade neue oder aktualisierte Lösungen entstehen.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface-secondary/80 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Gruppen</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{enrichedGroups.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-secondary/80 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Apps</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{totalGroupedApps}</p>
            </div>
            <div className="col-span-2 rounded-2xl border border-border bg-surface-secondary/80 px-4 py-3 sm:col-span-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Neu & Akt.</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{totalFreshApps}</p>
            </div>
          </div>
        </div>
      </section>

      {enrichedGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Layers2 className="w-10 h-10 text-muted/40" />
          <p className="text-lg font-semibold text-foreground">Noch keine Gruppen vorhanden</p>
          <p className="text-sm text-muted">Administratoren können Gruppen unter Verwaltung anlegen.</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {enrichedGroups.map((group) => (
            <Link
              key={group.id}
              href={`/gruppen/${group.id}`}
              className="group relative isolate flex min-h-[23.5rem] flex-col overflow-hidden rounded-[2rem] border border-border/80 bg-gradient-to-b from-surface to-surface-secondary p-5 pt-12 shadow-[0_18px_44px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-accent/35 hover:shadow-[0_24px_54px_rgba(0,75,118,0.16)] focus-visible:-translate-y-1 focus-visible:border-accent/35 focus-visible:shadow-[0_24px_54px_rgba(0,75,118,0.16)] sm:p-6 sm:pt-14"
            >
              <div className="absolute left-5 top-0 h-8 w-28 rounded-b-[1.2rem] border-x border-b border-border/70 bg-[linear-gradient(180deg,rgba(0,75,118,0.16),rgba(0,75,118,0.05))] sm:left-6 sm:h-9 sm:w-32" />

              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-4">
                  <GroupIcon icon={group.icon} name={group.name} className="h-12 w-12 rounded-[1.15rem] border border-accent/10 bg-accent/10 text-accent shrink-0 shadow-sm" />
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface-secondary/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted backdrop-blur-sm">
                      Ordner
                    </div>
                    <p className="mt-2.5 text-lg font-semibold text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent sm:text-xl">{group.name}</p>
                    <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted line-clamp-2">
                      {group.description || 'Kuratiertes Themenfeld mit passenden Apps, Statussignalen und schnellen Einstiegen.'}
                    </p>
                  </div>
                </div>

                <span className="shrink-0 rounded-full border border-border/80 bg-surface-secondary/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted shadow-sm backdrop-blur-sm">
                  {group.appCount} {group.appCount === 1 ? 'App' : 'Apps'}
                </span>
              </div>

              <div className="relative mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-accent/15 bg-accent/8 px-3 py-1.5 text-[11px] font-semibold text-accent">
                  {group.featuredCount} Highlights
                </span>
                <span className="rounded-full border border-border bg-surface-secondary/85 px-3 py-1.5 text-[11px] font-semibold text-muted">
                  {group.reuseCount} Nachnutzung
                </span>
                <span className="rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-[11px] font-semibold text-success">
                  {group.freshCount} neu oder aktualisiert
                </span>
              </div>

              <div className="relative mt-4 flex-1 overflow-hidden rounded-[1.6rem] border border-border/70 bg-gradient-to-b from-surface-secondary/90 to-surface-tertiary/90 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-[linear-gradient(180deg,rgba(0,75,118,0.09),transparent)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Karten im Ordner</p>
                    <p className="mt-1 text-xs text-muted sm:text-sm">Beim Hover kommen die wichtigsten Apps nach vorn.</p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    {group.lastUpdatedLabel ? `Aktiv ${group.lastUpdatedLabel}` : 'Noch keine Aktivität'}
                  </div>
                </div>

                {group.previewApps.length > 0 ? (
                  <div className="relative mt-4 min-h-[8.25rem] sm:min-h-[9.25rem]">
                    {group.previewApps.map((app, index) => {
                      const freshness = getAppFreshness(app);
                      const previewClassNames = [
                        'absolute bottom-0 left-0 w-[calc(100%-1rem)] max-w-[18rem] sm:w-[calc(100%-2rem)]',
                        '-rotate-[6deg] translate-x-0 translate-y-3 opacity-75 group-hover:-translate-y-1 group-hover:-rotate-[9deg] group-focus-visible:-translate-y-1 group-focus-visible:-rotate-[9deg]',
                        'rotate-[1deg] translate-x-4 translate-y-1 opacity-90 group-hover:-translate-y-2 group-hover:rotate-0 group-focus-visible:-translate-y-2 group-focus-visible:rotate-0 sm:translate-x-6',
                        'rotate-[6deg] translate-x-8 translate-y-0 opacity-100 group-hover:-translate-y-4 group-hover:rotate-[4deg] group-focus-visible:-translate-y-4 group-focus-visible:rotate-[4deg] sm:translate-x-12',
                      ];

                      return (
                        <div
                          key={app.id}
                          className={`rounded-[1.35rem] border border-border/80 bg-surface/95 p-3 shadow-[0_14px_32px_rgba(15,23,42,0.10)] backdrop-blur-sm transition-all duration-300 ${previewClassNames[Math.min(index + 1, 3)]}`}
                        >
                          <div className="flex items-start gap-3">
                            <GroupIcon icon={app.icon} name={app.name} className="h-10 w-10 rounded-xl border border-border bg-surface-secondary text-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-foreground">{app.name}</p>
                                {app.isFeatured && <Star className="h-3.5 w-3.5 shrink-0 text-gov-gold" />}
                              </div>
                              <p className="mt-1 truncate text-xs text-muted">{app.categories?.slice(0, 2).join(' · ') || 'Ohne Kategorie'}</p>
                              <p className="mt-1.5 line-clamp-1 text-xs leading-relaxed text-muted sm:line-clamp-2">{app.description}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em]">
                            {freshness.badgeLabel && (
                              <span className={`rounded-full px-2 py-1 ${
                                freshness.badgeColor === 'warning'
                                  ? 'bg-warning/10 text-warning'
                                  : freshness.badgeColor === 'accent'
                                    ? 'bg-accent/10 text-accent'
                                    : 'bg-success/10 text-success'
                              }`}>
                                {freshness.badgeLabel}
                              </span>
                            )}
                            <span className="rounded-full border border-border bg-surface-secondary px-2 py-1 text-muted">
                              {app.status || 'Verfügbar'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.2rem] border border-dashed border-border bg-surface/70 px-4 py-4 text-sm text-muted">
                    Diese Gruppe wartet noch auf erste Apps im Ordner.
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {group.topCategories.length > 0 ? group.topCategories.map((category) => (
                  <span key={category} className="rounded-full border border-border/80 bg-surface-secondary/85 px-3 py-1 text-[11px] font-semibold text-muted">
                    {category}
                  </span>
                )) : (
                  <span className="text-sm text-muted">Diese Gruppe wartet noch auf erste Apps.</span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4 text-sm">
                <span className="text-muted">Zum Öffnen klicken</span>
                <span className="inline-flex items-center gap-2 font-semibold text-accent">
                  Gruppe entdecken
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GruppenPage() {
  return (
    <AppStoreGate>
      <GruppenPageContent />
    </AppStoreGate>
  );
}
