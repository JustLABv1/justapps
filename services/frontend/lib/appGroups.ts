import type { AppConfig } from "@/config/apps";
import { fetchApi } from "@/lib/api";
import { getAppFreshness } from "@/lib/appFreshness";

export interface AppGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface GroupSummary extends AppGroup {
  members: AppConfig[];
  freshCount: number;
  topCategories: string[];
  lastUpdatedAt?: string;
}

async function loadList<T>(endpoint: string): Promise<T[]> {
  try {
    const response = await fetchApi(endpoint, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export const loadGroups = () => loadList<AppGroup>("/app-groups");
export const loadApps = (groupId?: string) => loadList<AppConfig>(groupId ? `/apps?group=${encodeURIComponent(groupId)}` : "/apps");

export const isFresh = (app: AppConfig) => {
  const kind = getAppFreshness(app).kind;
  return kind === "new" || kind === "updated";
};

/** The categories most of a group's apps share, most common first. */
export function topCategories(members: AppConfig[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const app of members) for (const category of app.categories || []) counts.set(category, (counts.get(category) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
    .slice(0, limit)
    .map(([category]) => category);
}

export function latestUpdate(members: AppConfig[]): string | undefined {
  return members
    .map((app) => app.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

/** Featured apps first, then new or updated ones, then the most recently changed. */
export function byRelevance(a: AppConfig, b: AppConfig) {
  const rank = { reuse: 1, new: 3, updated: 2, none: 0 };
  return Number(!!b.isFeatured) - Number(!!a.isFeatured)
    || rank[getAppFreshness(b).kind] - rank[getAppFreshness(a).kind]
    || new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
}

export function summarizeGroups(groups: AppGroup[], apps: AppConfig[]): GroupSummary[] {
  return groups.map((group) => {
    const members = apps.filter((app) => app.appGroups?.some((entry) => entry.id === group.id)).sort(byRelevance);
    return {
      ...group,
      members,
      freshCount: members.filter(isFresh).length,
      topCategories: topCategories(members),
      lastUpdatedAt: latestUpdate(members),
    };
  });
}
