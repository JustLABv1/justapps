import { GroupIcon } from '@/components/GroupIcon';
import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { getAppFreshness, getRelativeTimeMeta } from '@/lib/appFreshness';
import { ArrowRight, Layers2, Sparkles, Star } from 'lucide-react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'App-Gruppen' };
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
    return res.json();
  } catch {
    return [];
  }
}

async function loadApps(): Promise<AppConfig[]> {
  try {
    const res = await fetchApi('/apps', { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
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

export default async function GruppenPage() {
  const [groups, apps] = await Promise.all([loadGroups(), loadApps()]);
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
        <div className="grid gap-5 lg:grid-cols-2">
          {enrichedGroups.map((group) => (
            <Link
              key={group.id}
              href={`/gruppen/${group.id}`}
              className="group flex flex-col gap-5 rounded-[2rem] border border-border bg-surface p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <GroupIcon icon={group.icon} name={group.name} className="h-11 w-11 rounded-2xl bg-accent/10 text-accent shrink-0" />
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-foreground transition-colors group-hover:text-accent">{group.name}</p>
                    <p className="mt-1 text-sm text-muted line-clamp-2">
                      {group.description || 'Kuratiertes Themenfeld mit passenden Apps, Statussignalen und schnellen Einstiegen.'}
                    </p>
                  </div>
                </div>

                <span className="shrink-0 rounded-full border border-border bg-surface-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {group.appCount} {group.appCount === 1 ? 'App' : 'Apps'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border bg-surface-secondary/70 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Highlights</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{group.featuredCount}</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface-secondary/70 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Nachnutzung</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{group.reuseCount}</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface-secondary/70 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Neu/Akt.</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{group.freshCount}</p>
                </div>
              </div>

              {group.previewApps.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface-secondary/40 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Schnelleinstieg</p>
                  <div className="mt-3 space-y-2.5">
                    {group.previewApps.map((app) => {
                      const freshness = getAppFreshness(app);

                      return (
                        <div key={app.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5 transition-colors group-hover:bg-accent/5">
                          <GroupIcon icon={app.icon} name={app.name} className="h-10 w-10 rounded-2xl border border-border bg-surface-secondary text-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{app.name}</p>
                            <p className="truncate text-xs text-muted">{app.categories?.slice(0, 2).join(' · ') || 'Ohne Kategorie'}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {app.isFeatured && <Star className="h-3.5 w-3.5 text-gov-gold" />}
                            {freshness.badgeLabel && (
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                                freshness.badgeColor === 'warning'
                                  ? 'bg-warning/10 text-warning'
                                  : freshness.badgeColor === 'accent'
                                    ? 'bg-accent/10 text-accent'
                                    : 'bg-success/10 text-success'
                              }`}>
                                {freshness.badgeLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {group.topCategories.length > 0 ? group.topCategories.map((category) => (
                  <span key={category} className="rounded-full border border-border bg-surface-secondary px-3 py-1 text-[11px] font-semibold text-muted">
                    {category}
                  </span>
                )) : (
                  <span className="text-sm text-muted">Diese Gruppe wartet noch auf erste Apps.</span>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-4 text-sm">
                <span className="text-muted">
                  {group.lastUpdatedLabel ? `Zuletzt geändert: ${group.lastUpdatedLabel}` : 'Noch keine Aktivität'}
                </span>
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
