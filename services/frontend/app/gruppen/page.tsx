'use client';

import { AppStoreGate } from "@/components/AppStoreGate";
import { GroupIcon } from "@/components/GroupIcon";
import { GroupCover } from "@/components/groups/GroupCover";
import { Badge } from "@/components/panelui/badge";
import { Input } from "@/components/panelui/input";
import { Select } from "@/components/panelui/select";
import { Spinner } from "@/components/panelui/spinner";
import { getRelativeTimeMeta } from "@/lib/appFreshness";
import { groupColor, groupInitials, type GroupSummary, loadApps, loadGroups, summarizeGroups } from "@/lib/appGroups";
import { ArrowUpDown, Layers2, Search, X } from "lucide-react";
import NextLink from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

type Sort = "size" | "name" | "activity";
const SORT_ITEMS: { value: Sort; label: string }[] = [
  { value: "size", label: "Meiste Apps" },
  { value: "activity", label: "Zuletzt aktiv" },
  { value: "name", label: "Name" },
];

function GroupCard({ group }: { group: GroupSummary }) {
  const activity = getRelativeTimeMeta(group.lastUpdatedAt)?.label;
  const color = groupColor(group.id);
  return (
    <NextLink
      href={`/gruppen/${group.id}`}
      style={{ "--group": color } as CSSProperties}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--group)_45%,var(--border))] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:hover:translate-y-0"
    >
      <GroupCover color={color} apps={group.members} />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
        <div className="-mt-7 flex items-end justify-between gap-3">
          <GroupIcon
            icon={group.icon}
            name=""
            fallback={<span className="text-lg font-semibold tracking-tight">{groupInitials(group.name)}</span>}
            className="size-14 shrink-0 rounded-2xl border-4 border-card bg-[color-mix(in_oklab,var(--group)_18%,var(--card))] text-[var(--group)] shadow-sm [&_svg]:size-6"
          />
          {group.freshCount > 0 && <Badge variant="info" size="sm" dot>{group.freshCount} neu</Badge>}
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold leading-snug">{group.name}</h2>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {group.description || (group.members.length ? `${group.members.length} Apps rund um ${group.topCategories.slice(0, 2).join(" und ") || group.name}.` : "Noch ohne Beschreibung.")}
          </p>
        </div>

        {group.topCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {group.topCategories.map((category) => <Badge key={category} variant="outline" size="sm">{category}</Badge>)}
          </div>
        )}

        <div className="mt-auto flex items-center gap-3 border-t pt-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {group.members.length ? `${group.members.length} ${group.members.length === 1 ? "App" : "Apps"}` : "Noch keine Apps"}
          </span>
          {activity && <span className="ms-auto text-xs">aktiv {activity}</span>}
        </div>
      </div>
    </NextLink>
  );
}

function GruppenPageContent() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("size");

  useEffect(() => {
    let active = true;
    Promise.all([loadGroups(), loadApps()])
      .then(([nextGroups, apps]) => active && setGroups(summarizeGroups(nextGroups, apps)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de");
    const filtered = needle
      ? groups.filter((group) =>
          [group.name, group.description || "", ...group.topCategories, ...group.members.map((app) => app.name)]
            .some((value) => value.toLocaleLowerCase("de").includes(needle)))
      : groups;
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "de");
      if (sort === "activity") return new Date(b.lastUpdatedAt || 0).getTime() - new Date(a.lastUpdatedAt || 0).getTime();
      return b.members.length - a.members.length || a.name.localeCompare(b.name, "de");
    });
  }, [groups, query, sort]);

  const appCount = new Set(groups.flatMap((group) => group.members.map((app) => app.id))).size;

  return (
    <div className="flex w-full flex-col gap-8 pb-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Gruppen</h1>
        <p className="max-w-2xl text-muted-foreground">
          Gruppen bündeln Apps zu einem Thema oder Programm. So findest du schnell alles, was zusammengehört.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input.Group className="min-w-0 flex-1 sm:max-w-md">
          <Input.Addon><Search /></Input.Addon>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Gruppen, Apps oder Kategorien suchen" aria-label="Gruppen durchsuchen" />
          {query && (
            <Input.Addon align="end">
              <button type="button" aria-label="Suche löschen" onClick={() => setQuery("")} className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </Input.Addon>
          )}
        </Input.Group>
        <p className="text-sm text-muted-foreground sm:ms-2" role="status">
          {loading ? "Wird geladen …" : query ? `${visible.length} von ${groups.length} Gruppen` : `${groups.length} Gruppen mit ${appCount} Apps`}
        </p>
        <Select items={SORT_ITEMS} value={sort} onValueChange={(value) => value && setSort(value as Sort)}>
          <Select.Trigger variant="ghost" size="sm" aria-label="Gruppen sortieren" className="sm:ms-auto">
            <ArrowUpDown />
            <Select.Value />
          </Select.Trigger>
          <Select.Content align="end">
            {SORT_ITEMS.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}
          </Select.Content>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
          <Spinner />
          Gruppen werden geladen …
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-center">
          <Layers2 className="size-8 text-muted-foreground/50" />
          <p className="font-medium">{groups.length === 0 ? "Noch keine Gruppen" : "Keine passende Gruppe"}</p>
          <p className="text-sm text-muted-foreground">
            {groups.length === 0 ? "Gruppen lassen sich im App-Editor unter „Zuordnungen“ anlegen." : "Versuch es mit einem anderen Suchbegriff."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((group) => (
            <li key={group.id}>
              <GroupCard group={group} />
            </li>
          ))}
        </ul>
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
