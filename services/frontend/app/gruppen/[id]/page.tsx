'use client';

import { AppCard } from '@/components/AppCard';
import { GroupIcon } from '@/components/GroupIcon';
import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { getAppFreshness, getRelativeTimeMeta } from '@/lib/appFreshness';
import { ChevronLeft, Layers2, Loader2, Sparkles, Star } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AppGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

async function loadGroups(): Promise<AppGroup[]> {
  const res = await fetchApi('/app-groups');
  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function loadGroupApps(groupId: string): Promise<AppConfig[]> {
  const res = await fetchApi(`/apps?group=${encodeURIComponent(groupId)}`);
  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
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
    .slice(0, 5)
    .map(([category]) => category);
}

export default function GruppenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<AppGroup | null>(null);
  const [members, setMembers] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    let isActive = true;

    const loadGroupDetail = async () => {
      setLoading(true);
      setNotFound(false);

      try {
        const [groups, memberApps] = await Promise.all([
          loadGroups(),
          loadGroupApps(id),
        ]);

        if (!isActive) {
          return;
        }

        const found = groups.find((entry) => entry.id === id) ?? null;
        setGroup(found);
        setNotFound(found === null);
        setMembers(memberApps);
      } catch {
        if (!isActive) {
          return;
        }

        setGroup(null);
        setMembers([]);
        setNotFound(true);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadGroupDetail();

    return () => {
      isActive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-6xl mx-auto pb-10">
        <Link
          href="/gruppen"
          className="inline-flex items-center gap-2 mb-6 text-sm font-medium text-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Alle Gruppen
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Layers2 className="w-10 h-10 text-muted/40" />
          <p className="text-lg font-semibold text-foreground">Gruppe nicht gefunden</p>
          <p className="text-sm text-muted">Diese Gruppe existiert nicht oder wurde gelöscht.</p>
        </div>
      </div>
    );
  }

  const topCategories = getTopCategories(members);
  const featuredCount = members.filter((app) => app.isFeatured).length;
  const reuseCount = members.filter((app) => app.isReuse).length;
  const freshCount = members.filter((app) => {
    const kind = getAppFreshness(app).kind;
    return kind === 'new' || kind === 'updated';
  }).length;
  const latestUpdatedAt = members
    .map((app) => app.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
  const latestUpdatedLabel = getRelativeTimeMeta(latestUpdatedAt)?.label;
  const spotlightMembers = [...members]
    .sort((left, right) => {
      const leftFreshness = getAppFreshness(left).kind;
      const rightFreshness = getAppFreshness(right).kind;
      const freshnessRank = { reuse: 3, new: 2, updated: 1, none: 0 };

      return (Number(right.isFeatured) - Number(left.isFeatured))
        || (freshnessRank[rightFreshness] - freshnessRank[leftFreshness])
        || (new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());
    })
    .slice(0, 3);

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <Link
        href="/gruppen"
        className="inline-flex items-center gap-2 mb-6 text-sm font-medium text-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Alle Gruppen
      </Link>

      <section className="mb-8 overflow-hidden rounded-[2rem] border border-border bg-surface shadow-sm">
        <div className="border-b border-border/70 px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <GroupIcon icon={group?.icon} name={group?.name || 'Gruppe'} className="h-14 w-14 rounded-3xl bg-accent/10 text-accent shrink-0" />
              <div className="min-w-0">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
                  <Sparkles className="h-3.5 w-3.5" />
                  Gruppe
                </span>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">{group?.name}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
                  {group?.description || 'Kuratiertes Themenfeld mit passenden Apps, schnellen Einstiegen und klaren Signalen zu neuen oder gepflegten Lösungen.'}
                </p>
              </div>
            </div>

            <span className="shrink-0 rounded-full border border-border bg-surface-secondary px-3 py-1 text-sm font-semibold text-muted">
              {members.length} {members.length === 1 ? 'App' : 'Apps'}
            </span>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-surface-secondary/70 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Highlights</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{featuredCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface-secondary/70 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Nachnutzung</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{reuseCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface-secondary/70 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Neu/Akt.</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{freshCount}</p>
              </div>
            </div>

            {topCategories.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {topCategories.map((category) => (
                  <span key={category} className="rounded-full border border-border bg-surface-secondary px-3 py-1 text-[11px] font-semibold text-muted">
                    {category}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-surface-secondary/40 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Worum es hier geht</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Diese Gruppe hebt passende Lösungen gebündelt hervor und macht sichtbar, welche Apps besonders relevant,
              reuse-tauglich oder gerade frisch gepflegt sind.
            </p>
            <p className="mt-4 text-sm font-medium text-foreground">
              {latestUpdatedLabel ? `Letzte sichtbare Änderung ${latestUpdatedLabel}.` : 'Noch keine sichtbaren Änderungen.'}
            </p>
          </div>
        </div>
      </section>

      {spotlightMembers.length > 0 && (
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">Highlights in dieser Gruppe</h2>
            <p className="text-sm text-muted">Schneller Einstieg in besonders relevante oder frisch gepflegte Apps.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {spotlightMembers.map((app) => {
              const freshness = getAppFreshness(app);

              return (
                <Link
                  key={app.id}
                  href={`/apps/${app.id}`}
                  className="group flex h-full flex-col rounded-[1.75rem] border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <GroupIcon icon={app.icon} name={app.name} className="h-11 w-11 rounded-2xl border border-border bg-surface-secondary text-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-foreground group-hover:text-accent">{app.name}</p>
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
                      <p className="mt-1 text-sm text-muted line-clamp-2">{app.description}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-1 flex-col">
                    <div className="flex flex-wrap gap-2">
                      {app.categories?.slice(0, 3).map((category) => (
                        <span key={category} className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-[11px] font-semibold text-muted">
                          {category}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto pt-4">
                      <div className="border-t border-border/60 pt-3 text-sm text-muted">
                        {freshness.updatedRelative?.label || freshness.createdRelative?.label || 'Ohne Zeitstempel'}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Layers2 className="w-10 h-10 text-muted/40" />
          <p className="text-lg font-semibold text-foreground">Noch keine Apps in dieser Gruppe</p>
          <p className="text-sm text-muted">Administratoren können Apps über den App-Editor Gruppen zuweisen.</p>
        </div>
      ) : (
        <section aria-label={group ? `Apps in ${group.name}` : 'Apps'}>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">Alle Apps dieser Gruppe</h2>
            <p className="text-sm text-muted">Die komplette Sammlung mit denselben Karten und Schnellzugriffen wie im Store.</p>
          </div>

          <div className="columns-1 md:columns-2 lg:columns-3 gap-x-5">
            {members.map((app) => (
              <div key={app.id} className="break-inside-avoid mb-5">
                <AppCard app={app} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
