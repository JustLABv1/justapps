'use client';

import { AppCard } from "@/components/AppCard";
import { AppStoreGate } from "@/components/AppStoreGate";
import { GroupIcon } from "@/components/GroupIcon";
import { GroupCover } from "@/components/groups/GroupCover";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Input } from "@/components/panelui/input";
import { Select } from "@/components/panelui/select";
import { Spinner } from "@/components/panelui/spinner";
import type { AppConfig } from "@/config/apps";
import { getRelativeTimeMeta } from "@/lib/appFreshness";
import { type AppGroup, byRelevance, groupColor, groupInitials, isFresh, loadApps, loadGroups, summarizeGroups, topCategories, latestUpdate, type GroupSummary } from "@/lib/appGroups";
import { toast } from "@/lib/toast";
import { ArrowLeft, ArrowUpDown, Layers2, Search, Share2, Tag, X } from "lucide-react";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { type CSSProperties, useEffect, useMemo, useState } from "react";

type Sort = "relevance" | "newest" | "name";
const SORT_ITEMS: { value: Sort; label: string }[] = [
  { value: "relevance", label: "Empfohlen" },
  { value: "newest", label: "Zuletzt aktualisiert" },
  { value: "name", label: "Name" },
];

function GruppenDetailPageContent() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<AppGroup | null>(null);
  const [members, setMembers] = useState<AppConfig[]>([]);
  const [others, setOthers] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [freshOnly, setFreshOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("relevance");

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([loadGroups(), loadApps(id), loadApps()])
      .then(([groups, groupApps, allApps]) => {
        if (!active) return;
        setGroup(groups.find((entry) => entry.id === id) ?? null);
        setMembers(groupApps);
        setOthers(summarizeGroups(groups.filter((entry) => entry.id !== id), allApps).filter((entry) => entry.members.length > 0));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const categories = useMemo(() => topCategories(members, 50), [members]);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de");
    return members
      .filter((app) => !category || app.categories?.includes(category))
      .filter((app) => !freshOnly || isFresh(app))
      .filter((app) => !needle || [app.name, app.description, ...(app.tags || [])].some((value) => value?.toLocaleLowerCase("de").includes(needle)))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name, "de");
        if (sort === "newest") return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        return byRelevance(a, b);
      });
  }, [members, query, category, freshOnly, sort]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-muted-foreground">
        <Spinner />
        Gruppe wird geladen …
      </div>
    );
  }

  const back = (
    <Button variant="ghost" size="sm" className="-ms-3 w-fit" render={<NextLink href="/gruppen" />}>
      <ArrowLeft />
      Alle Gruppen
    </Button>
  );

  if (!group) {
    return (
      <div className="flex flex-col gap-8 pb-16">
        {back}
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-center">
          <Layers2 className="size-8 text-muted-foreground/50" />
          <p className="font-medium">Gruppe nicht gefunden</p>
          <p className="text-sm text-muted-foreground">Diese Gruppe gibt es nicht mehr, oder sie ist für dich nicht sichtbar.</p>
        </div>
      </div>
    );
  }

  const freshCount = members.filter(isFresh).length;
  const activity = getRelativeTimeMeta(latestUpdate(members))?.label;
  const filtered = !!(query || category || freshOnly);
  const reset = () => {
    setQuery("");
    setCategory(null);
    setFreshOnly(false);
  };
  const share = () => {
    void navigator.clipboard.writeText(window.location.href);
    toast.success("Link kopiert.");
  };

  return (
    <div className="flex w-full flex-col gap-8 pb-16">
      <div className="flex items-center justify-between gap-3">
        {back}
        <Button variant="ghost" size="sm" onClick={share}>
          <Share2 />
          Teilen
        </Button>
      </div>

      {/* ── Header: the group's cover, its icon over the edge ── */}
      <header className="flex flex-col" style={{ "--group": groupColor(group.id) } as CSSProperties}>
        <GroupCover color={groupColor(group.id)} apps={[...members].sort(byRelevance)} className="h-36 rounded-2xl border sm:h-44" />
        <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-end sm:gap-6 sm:px-6">
          <GroupIcon
            icon={group.icon}
            name={group.name}
            fallback={<span className="text-2xl font-semibold tracking-tight sm:text-3xl">{groupInitials(group.name)}</span>}
            className="-mt-10 size-20 shrink-0 rounded-3xl border-4 border-background bg-[color-mix(in_oklab,var(--group)_18%,var(--card))] text-[var(--group)] shadow-sm sm:-mt-12 sm:size-24 [&_svg]:size-9"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:pb-1">
            <h1 className="text-3xl font-semibold tracking-tight">{group.name}</h1>
            <p className="text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? "App" : "Apps"}
              {freshCount > 0 && ` · ${freshCount} neu oder aktualisiert`}
              {activity && ` · zuletzt aktiv ${activity}`}
            </p>
          </div>
        </div>
        {group.description && <p className="mt-4 max-w-3xl px-1 leading-relaxed text-muted-foreground sm:px-6">{group.description}</p>}
      </header>

      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-center">
          <Layers2 className="size-8 text-muted-foreground/50" />
          <p className="font-medium">Noch keine Apps in dieser Gruppe</p>
          <p className="text-sm text-muted-foreground">Apps werden im App-Editor unter „Zuordnungen“ einer Gruppe hinzugefügt.</p>
        </div>
      ) : (
        <section aria-label={`Apps in ${group.name}`} className="flex flex-col gap-4">
          {/* ── Filters ── */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input.Group className="min-w-0 flex-1 sm:max-w-sm">
                <Input.Addon><Search /></Input.Addon>
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`In ${group.name} suchen`} aria-label="Apps in dieser Gruppe durchsuchen" />
              </Input.Group>
              <Select items={SORT_ITEMS} value={sort} onValueChange={(value) => value && setSort(value as Sort)}>
                <Select.Trigger variant="ghost" size="sm" aria-label="Apps sortieren" className="sm:ms-auto">
                  <ArrowUpDown />
                  <Select.Value />
                </Select.Trigger>
                <Select.Content align="end">
                  {SORT_ITEMS.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}
                </Select.Content>
              </Select>
            </div>
            {(categories.length > 1 || freshCount > 0) && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter">
                {freshCount > 0 && (
                  <Button size="sm" shape="pill" variant={freshOnly ? "default" : "outline"} aria-pressed={freshOnly} onClick={() => setFreshOnly(!freshOnly)}>
                    Neu oder aktualisiert
                    <Badge variant={freshOnly ? "secondary" : "outline"} size="sm">{freshCount}</Badge>
                  </Button>
                )}
                {categories.length > 1 && categories.map((entry) => (
                  <Button
                    key={entry}
                    size="sm"
                    shape="pill"
                    variant={category === entry ? "default" : "outline"}
                    aria-pressed={category === entry}
                    onClick={() => setCategory(category === entry ? null : entry)}
                  >
                    <Tag />
                    {entry}
                  </Button>
                ))}
                {filtered && (
                  <Button size="sm" variant="ghost" onClick={reset}>
                    <X />
                    Zurücksetzen
                  </Button>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground" role="status">
              {filtered ? `${visible.length} von ${members.length} Apps` : `${members.length} Apps`}
            </p>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-12 text-center">
              <p className="font-medium">Keine passende App</p>
              <Button variant="link" size="sm" onClick={reset}>Filter zurücksetzen</Button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((app) => (
                <li key={app.id}>
                  <AppCard app={app} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Other groups ── */}
      {others.length > 0 && (
        <section aria-labelledby="other-groups" className="flex flex-col gap-4 border-t pt-8">
          <h2 id="other-groups" className="text-lg font-semibold tracking-tight">Weitere Gruppen</h2>
          <ul className="flex flex-wrap gap-2">
            {others.slice(0, 8).map((entry) => (
              <li key={entry.id}>
                <NextLink
                  href={`/gruppen/${entry.id}`}
                  style={{ "--group": groupColor(entry.id) } as CSSProperties}
                  className="flex items-center gap-2.5 rounded-xl border bg-card py-1.5 ps-1.5 pe-3 text-sm transition-colors hover:border-[color-mix(in_oklab,var(--group)_45%,var(--border))] hover:bg-[color-mix(in_oklab,var(--group)_6%,var(--card))] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <GroupIcon icon={entry.icon} name="" fallback={<span className="text-[11px] font-semibold">{groupInitials(entry.name)}</span>} className="size-7 rounded-lg bg-[color-mix(in_oklab,var(--group)_18%,var(--card))] text-[var(--group)] [&_svg]:size-3.5" />
                  <span className="font-medium">{entry.name}</span>
                  <span className="text-muted-foreground tabular-nums">{entry.members.length}</span>
                </NextLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function GruppenDetailPage() {
  return (
    <AppStoreGate>
      <GruppenDetailPageContent />
    </AppStoreGate>
  );
}
