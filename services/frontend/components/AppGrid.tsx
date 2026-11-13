'use client';

import { AppConfig } from "@/config/apps";
import { useFavorites } from "@/context/FavoritesContext";
import { fetchApi } from "@/lib/api";
import { getAppStatusLabel, sortAppStatuses } from "@/lib/appStatus";
import { getImageAssetUrl } from "@/lib/assets";
import { emptyRecentlyViewed, getRecentlyViewed, subscribeToRecentlyViewed } from "@/lib/recentlyViewed";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Chip } from "@/components/panelui/chip";
import { Input } from "@/components/panelui/input";
import { Select } from "@/components/panelui/select";
import { Tooltip } from "@/components/panelui/tooltip";
import { Check, ChevronDown, ChevronUp, Clock, Heart, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppCard } from "./AppCard";
import { AppCardSkeleton } from "./AppCardSkeleton";

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { value: 'default', label: 'Standard' },
  { value: 'rating', label: 'Beste Bewertung' },
  { value: 'updated', label: 'Zuletzt aktualisiert' },
  { value: 'status', label: 'Status' },
];

interface AppGridProps {
  initialApps: AppConfig[];
  spaceId?: string;
  scopeControl?: ReactNode;
  catalogAction?: ReactNode;
}

export function AppGrid({ initialApps, spaceId = "", scopeControl, catalogAction }: AppGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchQuery = searchParams.get('q') ?? '';
  const selectedCategory = searchParams.get('category');
  const selectedStatus = searchParams.get('status');
  const selectedType = searchParams.get('type');
  const selectedGroup = searchParams.get('group');
  const selectedSort = searchParams.get('sort') ?? '';
  const semanticSearch = searchParams.get('semantic') === 'true';
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const hasServerFilter = Boolean(searchQuery || selectedCategory || selectedStatus || selectedType || selectedGroup || selectedSort || showFavoritesOnly || semanticSearch);
  const paginationKey = [
    spaceId,
    searchQuery,
    selectedCategory ?? '',
    selectedStatus ?? '',
    selectedType ?? '',
    selectedGroup ?? '',
    selectedSort,
    semanticSearch ? 'semantic' : '',
    showFavoritesOnly ? 'favorites' : '',
  ].join('|');

  const [showFilters, setShowFilters] = useState(false);
  const [serverResponse, setServerResponse] = useState<{ key: string; apps: AppConfig[]; page: number; total: number; hasMore: boolean } | null>(null);
  const [serverPageLoading, setServerPageLoading] = useState(false);
  const [visibleAppsState, setVisibleAppsState] = useState({ key: paginationKey, count: PAGE_SIZE });
  const pageRequestRef = useRef<AbortController | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { favorites, isLoaded: favoritesLoaded } = useFavorites();
  const recentApps = useSyncExternalStore(subscribeToRecentlyViewed, getRecentlyViewed, () => emptyRecentlyViewed);
  const serverFilterKey = useMemo(() => JSON.stringify({
    spaceId,
    q: searchQuery,
    category: selectedCategory,
    status: selectedStatus,
    type: selectedType,
    group: selectedGroup,
    sort: selectedSort,
    semantic: semanticSearch,
    favorite: showFavoritesOnly,
  }), [spaceId, searchQuery, selectedCategory, selectedStatus, selectedType, selectedGroup, selectedSort, semanticSearch, showFavoritesOnly]);
  const serverResults = hasServerFilter && serverResponse?.key === serverFilterKey
    ? serverResponse.apps
    : null;
  const serverLoading = hasServerFilter && serverResponse?.key !== serverFilterKey;

  // Server-side filtering: debounce 300ms, fire when any server-filterable param changes
  useEffect(() => {
    if (!hasServerFilter) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (spaceId) params.set("spaceId", spaceId);
        if (searchQuery) params.set('q', searchQuery);
        if (selectedCategory) params.set('category', selectedCategory);
        if (selectedStatus) params.set('status', selectedStatus);
        if (selectedType) params.set('type', selectedType);
        if (selectedGroup) params.set('group', selectedGroup);
        if (selectedSort) params.set('sort', selectedSort);
        if (semanticSearch && searchQuery) params.set('semantic', 'true');
        if (showFavoritesOnly) params.set('favorite', 'me');
        params.set('page', '1');
        params.set('pageSize', String(PAGE_SIZE));
        const res = await fetchApi(`/apps?${params.toString()}`, { cache: 'no-store', signal: controller.signal });
        if (controller.signal.aborted) return;
        if (res.ok) {
          const data = await res.json();
          if (controller.signal.aborted) return;
          setServerPageLoading(false);
          const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
          setServerResponse({
            key: serverFilterKey,
            apps: items,
            page: typeof data.page === 'number' ? data.page : 1,
            total: typeof data.total === 'number' ? data.total : items.length,
            hasMore: data.hasMore === true,
          });
        } else {
          setServerResponse({ key: serverFilterKey, apps: [], page: 1, total: 0, hasMore: false });
        }
      } catch {
        if (controller.signal.aborted) return;
        setServerResponse({ key: serverFilterKey, apps: [], page: 1, total: 0, hasMore: false });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [spaceId, hasServerFilter, searchQuery, selectedCategory, selectedStatus, selectedType, selectedGroup, selectedSort, semanticSearch, showFavoritesOnly, serverFilterKey]);

  useEffect(() => {
    return () => {
      pageRequestRef.current?.abort();
      pageRequestRef.current = null;
    };
  }, [serverFilterKey]);

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : '/', { scroll: false });
  }, [router, searchParams]);

  const setSelectedCategory = useCallback((v: string | null) => updateParam('category', v), [updateParam]);
  const setSelectedStatus = useCallback((v: string | null) => updateParam('status', v), [updateParam]);
  const setSelectedType = useCallback((v: string | null) => updateParam('type', v), [updateParam]);
  const setSelectedGroup = useCallback((v: string | null) => updateParam('group', v), [updateParam]);
  const setSelectedSort = useCallback((v: string | null) => updateParam('sort', v && v !== 'default' ? v : null), [updateParam]);
  const commitSearch = useCallback((v: string) => updateParam('q', v || null), [updateParam]);
  const setSemanticSearch = useCallback((enabled: boolean) => updateParam('semantic', enabled ? 'true' : null), [updateParam]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    initialApps.forEach(app => {
      app.categories?.forEach(cat => {
        if (cat) cats.add(cat);
      });
    });
    return Array.from(cats).sort();
  }, [initialApps]);

  const statuses = useMemo(() => {
    const sts = new Set<string>();
    initialApps.forEach(app => {
      if (app.status) sts.add(app.status);
    });
    return sortAppStatuses(Array.from(sts));
  }, [initialApps]);

  // Source: server results when searching, otherwise all apps
  const sourceApps = hasServerFilter ? (serverResults ?? initialApps) : initialApps;

  const filteredApps = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return sourceApps.filter((app) => {
      // When server already filtered by these params, skip redundant client checks
      const matchesSearch = serverResults
        ? true
        : (!query ||
            app.name.toLowerCase().includes(query) ||
            app.description.toLowerCase().includes(query) ||
            app.categories?.some(cat => cat.toLowerCase().includes(query)) ||
            app.tags?.some(tag => tag.toLowerCase().includes(query)));

      const matchesCategory = serverResults ? true : (!selectedCategory || app.categories?.includes(selectedCategory));
      const matchesStatus = serverResults ? true : (!selectedStatus || app.status === selectedStatus);
      const matchesGroup = serverResults ? true : (!selectedGroup || app.appGroups?.some(g => g.id === selectedGroup));

      const matchesType = !selectedType ||
        (selectedType === 'reuse' && app.isReuse) ||
        (selectedType === 'install' && app.hasDeploymentAssistant !== false);
      const matchesFavorites = !showFavoritesOnly || favorites.has(app.id);

      return matchesSearch && matchesCategory && matchesStatus && matchesType && matchesGroup && matchesFavorites;
    });
  }, [sourceApps, serverResults, searchQuery, selectedCategory, selectedStatus, selectedType, selectedGroup, showFavoritesOnly, favorites]);

  const hasActiveFilters = searchQuery || selectedCategory || selectedStatus || selectedType || selectedGroup || selectedSort || showFavoritesOnly || semanticSearch;

  const visibleAppsKey = `${paginationKey}|${serverResults ? serverFilterKey : 'initial'}`;
  const visibleCount = hasServerFilter
    ? filteredApps.length
    : (visibleAppsState.key === visibleAppsKey ? visibleAppsState.count : PAGE_SIZE);
  const hasMoreApps = hasServerFilter
    ? Boolean(serverResponse?.hasMore)
    : visibleCount < filteredApps.length;
  const loadMoreApps = useCallback(async () => {
    if (hasServerFilter) {
      const current = serverResponse;
      if (!current || current.key !== serverFilterKey || !current.hasMore || pageRequestRef.current) return;
      const controller = new AbortController();
      pageRequestRef.current = controller;

      setServerPageLoading(true);
      try {
        const params = new URLSearchParams();
        if (spaceId) params.set("spaceId", spaceId);
        if (searchQuery) params.set('q', searchQuery);
        if (selectedCategory) params.set('category', selectedCategory);
        if (selectedStatus) params.set('status', selectedStatus);
        if (selectedType) params.set('type', selectedType);
        if (selectedGroup) params.set('group', selectedGroup);
        if (selectedSort) params.set('sort', selectedSort);
        if (semanticSearch && searchQuery) params.set('semantic', 'true');
        if (showFavoritesOnly) params.set('favorite', 'me');
        params.set('page', String(current.page + 1));
        params.set('pageSize', String(PAGE_SIZE));
        const response = await fetchApi(`/apps?${params.toString()}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (controller.signal.aborted) return;
        const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
        setServerResponse((previous) => previous && previous.key === serverFilterKey && previous.page === current.page
          ? {
              ...previous,
              apps: [...previous.apps, ...items.filter((item: AppConfig) => !previous.apps.some((app) => app.id === item.id))],
              page: typeof data.page === 'number' ? data.page : current.page + 1,
              total: typeof data.total === 'number' ? data.total : previous.total,
              hasMore: data.hasMore === true,
            }
          : previous);
      } catch {
        // Keep the existing results; the next scroll or button press can retry.
      } finally {
        if (pageRequestRef.current === controller) {
          pageRequestRef.current = null;
          setServerPageLoading(false);
        }
      }
      return;
    }

    setVisibleAppsState((current) => {
      const previousCount = current.key === visibleAppsKey ? current.count : PAGE_SIZE;
      return { key: visibleAppsKey, count: Math.min(previousCount + PAGE_SIZE, filteredApps.length) };
    });
  }, [spaceId, filteredApps.length, hasServerFilter, searchQuery, selectedCategory, selectedStatus, selectedType, selectedGroup, selectedSort, semanticSearch, showFavoritesOnly, serverFilterKey, serverResponse, visibleAppsKey]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMoreApps || serverLoading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMoreApps();
    }, { rootMargin: '320px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreApps, loadMoreApps, serverLoading]);

  const hasReuseApps = useMemo(() => initialApps.some(app => app.isReuse), [initialApps]);

  const groups = useMemo(() => {
    const groupMap = new Map<string, string>();
    initialApps.forEach(app => {
      app.appGroups?.forEach(g => {
        if (!groupMap.has(g.id)) groupMap.set(g.id, g.name);
      });
    });
    return Array.from(groupMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [initialApps]);

  const clearAllFilters = () => {
    setShowFavoritesOnly(false);
    router.replace(spaceId ? `/?spaceId=${encodeURIComponent(spaceId)}` : '/', { scroll: false });
  };

  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; clear: () => void }> = [];

    if (searchQuery) {
      filters.push({
        key: 'search',
        label: `Suche: ${searchQuery}`,
        clear: () => commitSearch(''),
      });
    }

    if (selectedCategory) {
      filters.push({
        key: 'category',
        label: `Kategorie: ${selectedCategory}`,
        clear: () => setSelectedCategory(null),
      });
    }

    if (selectedStatus) {
      filters.push({
        key: 'status',
        label: `Status: ${getAppStatusLabel(selectedStatus) || selectedStatus}`,
        clear: () => setSelectedStatus(null),
      });
    }

    if (selectedType) {
      filters.push({
        key: 'type',
        label: selectedType === 'install' ? 'Art: Selbst installieren' : 'Art: Nachnutzung',
        clear: () => setSelectedType(null),
      });
    }

    if (selectedGroup) {
      const groupName = groups.find(group => group.id === selectedGroup)?.name ?? selectedGroup;
      filters.push({
        key: 'group',
        label: `Gruppe: ${groupName}`,
        clear: () => setSelectedGroup(null),
      });
    }

    if (selectedSort) {
      filters.push({
        key: 'sort',
        label: `Sortierung: ${selectedSort === 'rating' ? 'Beste Bewertung' : selectedSort === 'updated' ? 'Zuletzt aktualisiert' : selectedSort === 'status' ? 'Status' : 'Name'}`,
        clear: () => setSelectedSort(null),
      });
    }

    if (showFavoritesOnly) {
      filters.push({
        key: 'favorites',
        label: 'Meine Favoriten',
        clear: () => setShowFavoritesOnly(false),
      });
    }

    if (semanticSearch) {
      filters.push({
        key: 'semantic',
        label: 'Semantische Suche',
        clear: () => setSemanticSearch(false),
      });
    }

    return filters;
  }, [commitSearch, groups, searchQuery, selectedCategory, selectedGroup, selectedSort, selectedStatus, selectedType, setSelectedCategory, setSelectedGroup, setSelectedSort, setSelectedStatus, setSelectedType, semanticSearch, setSemanticSearch, showFavoritesOnly]);

  const filterSummary = useMemo(() => {
    const summary = [];

    if (categories.length > 0) {
      summary.push(`${categories.length} Kategorien`);
    }
    if (statuses.length > 0) {
      summary.push(`${statuses.length} Status`);
    }
    if (hasReuseApps) {
      summary.push('Art');
    }
    if (groups.length > 0) {
      summary.push(`${groups.length} Gruppen`);
    }

    return summary.join(' · ');
  }, [categories.length, groups.length, hasReuseApps, statuses.length]);

  return (
    <div className="flex flex-col gap-8">
      <Card as="section" aria-label="Apps suchen und filtern">
        <Card.Content className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input.Group size="lg" className="min-w-0 flex-1">
              <Input.Addon>
                <Search />
              </Input.Addon>
              <Input
                aria-label="Apps suchen"
                value={searchQuery}
                onChange={(event) => commitSearch(event.target.value)}
                placeholder={semanticSearch ? "Natürlich suchen, z. B. \"Werkzeuge für Karten\"" : "Apps suchen..."}
              />
              <Input.Addon align="end">
                <Tooltip>
                  <Tooltip.Trigger
                    render={
                      <Button
                        size="icon-sm"
                        variant={semanticSearch ? "default" : "ghost"}
                        onClick={() => setSemanticSearch(!semanticSearch)}
                        aria-pressed={semanticSearch}
                        aria-label={semanticSearch ? "Semantische KI-Suche deaktivieren" : "Semantische KI-Suche aktivieren"}
                      />
                    }
                  >
                    <Sparkles />
                  </Tooltip.Trigger>
                  <Tooltip.Content>{semanticSearch ? 'Semantische KI-Suche an' : 'Semantische KI-Suche'}</Tooltip.Content>
                </Tooltip>
              </Input.Addon>
            </Input.Group>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {favoritesLoaded && (
                <Button
                  size="lg"
                  variant={showFavoritesOnly ? "default" : "outline"}
                  disabled={favorites.size === 0}
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  aria-pressed={showFavoritesOnly}
                  aria-label={`Meine Favoriten filtern (${favorites.size})`}
                >
                  <Heart />
                  Meine Favoriten
                  <Badge size="sm" variant="secondary">{favorites.size}</Badge>
                </Button>
              )}
              <Button
                size="lg"
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
              >
                <SlidersHorizontal />
                Filter
                {activeFilters.length > 0 && (
                  <Badge size="sm" variant="secondary">{activeFilters.length}</Badge>
                )}
                {showFilters ? <ChevronUp /> : <ChevronDown />}
              </Button>
              {hasActiveFilters && (
                <Button size="lg" variant="ghost" onClick={clearAllFilters}>
                  <X />
                  Zurücksetzen
                </Button>
              )}
            </div>
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2" aria-label="Aktive Filter">
              {activeFilters.map((filter) => (
                <Chip key={filter.key} size="sm" onRemove={filter.clear} removeLabel={`${filter.label} entfernen`}>
                  {filter.label}
                </Chip>
              ))}
            </div>
          ) : (
            !showFilters && filterSummary && (
              <p className="text-sm text-muted-foreground">
                Filtern nach {filterSummary}.
              </p>
            )
          )}

          {showFilters && (
            <div className="grid gap-x-8 gap-y-6 border-t pt-5 lg:grid-cols-2">
              <FilterGroup label="Sortierung">
                <Select
                  items={SORT_OPTIONS}
                  value={selectedSort || 'default'}
                  onValueChange={(value) => setSelectedSort(value)}
                >
                  <Select.Trigger aria-label="Apps sortieren" className="w-full sm:w-64">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {SORT_OPTIONS.map((option) => (
                      <Select.Item key={option.value} value={option.value}>
                        {option.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </FilterGroup>

              <FilterGroup label="Kategorien">
                <Chip pressed={!selectedCategory} onPressedChange={() => setSelectedCategory(null)}>
                  Alle
                </Chip>
                {categories.map((cat) => (
                  <Chip
                    key={cat}
                    pressed={selectedCategory === cat}
                    onPressedChange={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  >
                    {cat}
                  </Chip>
                ))}
              </FilterGroup>

              {hasReuseApps && (
                <FilterGroup label="Art">
                  <Chip pressed={!selectedType} onPressedChange={() => setSelectedType(null)}>
                    Alle
                  </Chip>
                  <Chip
                    pressed={selectedType === 'install'}
                    onPressedChange={() => setSelectedType(selectedType === 'install' ? null : 'install')}
                  >
                    Selbst installieren
                  </Chip>
                  <Chip
                    pressed={selectedType === 'reuse'}
                    onPressedChange={() => setSelectedType(selectedType === 'reuse' ? null : 'reuse')}
                  >
                    Nachnutzung
                  </Chip>
                </FilterGroup>
              )}

              {statuses.length > 0 && (
                <FilterGroup label="Status">
                  <Chip pressed={!selectedStatus} onPressedChange={() => setSelectedStatus(null)}>
                    Alle
                  </Chip>
                  {statuses.map((st) => (
                    <Chip
                      key={st}
                      pressed={selectedStatus === st}
                      onPressedChange={() => setSelectedStatus(selectedStatus === st ? null : st)}
                    >
                      {getAppStatusLabel(st) || st}
                    </Chip>
                  ))}
                </FilterGroup>
              )}

              {groups.length > 0 && (
                <FilterGroup label="Gruppe" className="lg:col-span-2">
                  <Chip pressed={!selectedGroup} onPressedChange={() => setSelectedGroup(null)}>
                    Alle
                  </Chip>
                  {groups.map((g) => (
                    <Chip
                      key={g.id}
                      pressed={selectedGroup === g.id}
                      onPressedChange={() => setSelectedGroup(selectedGroup === g.id ? null : g.id)}
                    >
                      {g.name}
                    </Chip>
                  ))}
                </FilterGroup>
              )}
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Recently viewed — only when no active filters */}
      {!hasActiveFilters && recentApps.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="recently-viewed">
          <h2 id="recently-viewed" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="size-3.5" />
            Zuletzt gesehen
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {recentApps.map((app) => {
              const iconSrc = getImageAssetUrl(app.icon);
              return (
                <Button
                  key={app.id}
                  variant="outline"
                  size="sm"
                  shape="pill"
                  render={<NextLink href={`/apps/${app.id}`} />}
                >
                  {iconSrc ? (
                    <span className="relative size-4 shrink-0">
                      <Image src={iconSrc} alt="" fill className="object-contain" sizes="16px" unoptimized />
                    </span>
                  ) : (
                    <span className="leading-none">{app.icon || '🏛️'}</span>
                  )}
                  {app.name}
                </Button>
              );
            })}
          </div>
        </section>
      )}

      {(() => {
        const visibleApps = filteredApps.slice(0, visibleCount);
        const total = hasServerFilter ? (serverResponse?.total ?? filteredApps.length) : filteredApps.length;

        return (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {scopeControl}
                {catalogAction}
              </div>
              <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
                {serverLoading ? (
                  'Suche läuft...'
                ) : (
                  <>
                    <span className="font-medium text-foreground tabular-nums">{visibleApps.length}</span> von{' '}
                    <span className="font-medium text-foreground tabular-nums">{total}</span> {total === 1 ? 'App' : 'Apps'}
                  </>
                )}
              </p>
            </div>

            {/* Apps stay in row order when more results are appended */}
            <section id="apps" className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 lg:grid-cols-3" aria-label="App-Liste">
              {serverLoading ? (
                [...Array(6)].map((_, i) => (
                  <div key={`skeleton-${i}`} className="min-w-0">
                    <AppCardSkeleton />
                  </div>
                ))
              ) : (
                visibleApps.map((app) => (
                  <div key={app.id} className="min-w-0">
                    <AppCard app={app} />
                  </div>
                ))
              )}
            </section>

            {!serverLoading && filteredApps.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Search className="size-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Keine Apps gefunden</p>
                  <p className="mt-1 text-sm text-muted-foreground">Versuchen Sie es mit anderen Suchbegriffen oder Kategorien.</p>
                </div>
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  Filter zurücksetzen
                </Button>
              </div>
            )}

            {!serverLoading && hasMoreApps && (
              <div ref={loadMoreRef} className="flex flex-col items-center gap-3 pb-8 pt-2" aria-live="polite">
                <span className="text-sm text-muted-foreground">Weitere Apps werden geladen, sobald Sie weiter scrollen.</span>
                <Button variant="outline" loading={serverPageLoading} onClick={loadMoreApps}>
                  Weitere Apps laden
                </Button>
              </div>
            )}
            {!serverLoading && filteredApps.length > 0 && !hasMoreApps && visibleApps.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-2 pb-8 pt-2 text-sm text-muted-foreground" aria-live="polite">
                <Check className="size-4 text-success" /> Alle {filteredApps.length} Apps geladen
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

function FilterGroup({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className={`flex flex-col gap-2.5 ${className ?? ''}`}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex min-w-0 flex-wrap gap-2">{children}</div>
    </div>
  );
}
