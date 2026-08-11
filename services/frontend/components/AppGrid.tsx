'use client';

import { AppConfig } from "@/config/apps";
import { useFavorites } from "@/context/FavoritesContext";
import { fetchApi } from "@/lib/api";
import { getAppStatusLabel, sortAppStatuses } from "@/lib/appStatus";
import { getImageAssetUrl } from "@/lib/assets";
import { emptyRecentlyViewed, getRecentlyViewed, subscribeToRecentlyViewed } from "@/lib/recentlyViewed";
import { Button, Input, ListBox, Select, TextField, Tooltip } from "@heroui/react";
import { ChevronDown, ChevronUp, Clock, Heart, Loader2, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppCard } from "./AppCard";
import { AppCardSkeleton } from "./AppCardSkeleton";

const PAGE_SIZE = 24;

interface AppGridProps {
  initialApps: AppConfig[];
}

export function AppGrid({ initialApps }: AppGridProps) {
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
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { favorites, isLoaded: favoritesLoaded } = useFavorites();
  const recentApps = useSyncExternalStore(subscribeToRecentlyViewed, getRecentlyViewed, () => emptyRecentlyViewed);
  const serverFilterKey = useMemo(() => JSON.stringify({
    q: searchQuery,
    category: selectedCategory,
    status: selectedStatus,
    type: selectedType,
    group: selectedGroup,
    sort: selectedSort,
    semantic: semanticSearch,
    favorite: showFavoritesOnly,
  }), [searchQuery, selectedCategory, selectedStatus, selectedType, selectedGroup, selectedSort, semanticSearch, showFavoritesOnly]);
  const serverResults = hasServerFilter && serverResponse?.key === serverFilterKey
    ? serverResponse.apps
    : null;
  const serverLoading = hasServerFilter && serverResponse?.key !== serverFilterKey;

  // Server-side filtering: debounce 300ms, fire when any server-filterable param changes
  useEffect(() => {
    if (!hasServerFilter) return;

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
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
        const res = await fetchApi(`/apps?${params.toString()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
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
        setServerResponse({ key: serverFilterKey, apps: [], page: 1, total: 0, hasMore: false });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [hasServerFilter, searchQuery, selectedCategory, selectedStatus, selectedType, selectedGroup, selectedSort, semanticSearch, showFavoritesOnly, serverFilterKey]);

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
      if (!current || !current.hasMore || serverPageLoading) return;

      setServerPageLoading(true);
      try {
        const params = new URLSearchParams();
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
        const response = await fetchApi(`/apps?${params.toString()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
        setServerResponse((previous) => previous && previous.key === serverFilterKey
          ? {
              ...previous,
              apps: [...previous.apps, ...items],
              page: typeof data.page === 'number' ? data.page : current.page + 1,
              total: typeof data.total === 'number' ? data.total : previous.total,
              hasMore: data.hasMore === true,
            }
          : previous);
      } finally {
        setServerPageLoading(false);
      }
      return;
    }

    setVisibleAppsState((current) => {
      const previousCount = current.key === visibleAppsKey ? current.count : PAGE_SIZE;
      return { key: visibleAppsKey, count: Math.min(previousCount + PAGE_SIZE, filteredApps.length) };
    });
  }, [filteredApps.length, hasServerFilter, searchQuery, selectedCategory, selectedStatus, selectedType, selectedGroup, selectedSort, semanticSearch, showFavoritesOnly, serverFilterKey, serverPageLoading, serverResponse, visibleAppsKey]);

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

  const quickCategories = categories.slice(0, 6);
  const quickStatuses = statuses.slice(0, 4);

  const clearAllFilters = () => {
    setShowFavoritesOnly(false);
    router.replace('/', { scroll: false });
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
      {/* Filter bar */}
      <div className="flex flex-col gap-4 bg-surface p-5 rounded-2xl border border-border shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-2 lg:max-w-3xl sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <TextField value={searchQuery} onChange={commitSearch} className="w-full">
                <Input
                  aria-label="Apps suchen"
                  placeholder={semanticSearch ? "Natürlich suchen, z. B. \"Werkzeuge für Karten\"" : "Apps suchen..."}
                  className="h-11 w-full rounded-xl bg-field-background pl-10 pr-12"
                />
              </TextField>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <Button
                      isIconOnly
                      size="sm"
                      variant={semanticSearch ? "primary" : "ghost"}
                      onPress={() => setSemanticSearch(!semanticSearch)}
                      aria-pressed={semanticSearch}
                      aria-label={semanticSearch ? "Semantische KI-Suche deaktivieren" : "Semantische KI-Suche aktivieren"}
                      className={`h-8 w-8 rounded-lg ${semanticSearch ? 'text-background' : 'text-muted hover:text-foreground'}`}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="top">{semanticSearch ? 'Semantische KI-Suche an' : 'Semantische KI-Suche'}</Tooltip.Content>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <Button
              variant={showFilters || hasActiveFilters ? "primary" : "secondary"}
              onPress={() => setShowFilters(!showFilters)}
              className={`h-11 rounded-xl px-4 gap-2 font-medium ${showFilters || hasActiveFilters ? 'text-background' : ''}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filter
              {activeFilters.length > 0 && (
                <span className="inline-flex min-w-5 justify-center rounded-full bg-background/20 px-1.5 py-0.5 text-[11px] font-semibold text-current">
                  {activeFilters.length}
                </span>
              )}
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="h-11 rounded-xl px-4 text-xs gap-1.5 text-muted hover:text-foreground"
                onPress={clearAllFilters}
              >
                <X className="w-3.5 h-3.5" />
                Zurücksetzen
              </Button>
            )}
          </div>
        </div>

        {(quickCategories.length > 0 || quickStatuses.length > 0 || favoritesLoaded) && (
          <div className="flex flex-col gap-3 border-t border-border/50 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted/80">Schnellfilter</span>
              {favoritesLoaded && favorites.size > 0 && (
                <Button
                  size="sm"
                  variant={showFavoritesOnly ? "primary" : "secondary"}
                  onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`h-8 rounded-full px-3 text-xs font-medium gap-1.5 ${showFavoritesOnly ? 'text-background' : ''}`}
                >
                  <Heart className={`w-3 h-3 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                  Favoriten ({favorites.size})
                </Button>
              )}
              {quickCategories.map((cat) => (
                <Button
                  key={`quick-cat-${cat}`}
                  size="sm"
                  variant={selectedCategory === cat ? "primary" : "secondary"}
                  onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`h-8 rounded-full px-3 text-xs font-medium ${selectedCategory === cat ? 'text-background' : ''}`}
                >
                  {cat}
                </Button>
              ))}
              {quickStatuses.map((status) => (
                <Button
                  key={`quick-status-${status}`}
                  size="sm"
                  variant={selectedStatus === status ? "primary" : "secondary"}
                  onPress={() => setSelectedStatus(selectedStatus === status ? null : status)}
                  className={`h-8 rounded-full px-3 text-xs font-medium ${selectedStatus === status ? 'text-background' : ''}`}
                >
                  {getAppStatusLabel(status) || status}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border/50 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              Starten Sie direkt mit Suche oder Schnellfiltern. Für feinere Auswahl stehen Kategorie, Status, Art und Gruppe bereit.
            </p>
            {!showFilters && filterSummary && (
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted/80">
                {filterSummary}
              </p>
            )}
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Button
                  key={filter.key}
                  size="sm"
                  variant="secondary"
                  onPress={filter.clear}
                  className="h-8 rounded-full px-3 text-xs font-medium"
                >
                  {filter.label}
                  <X className="w-3 h-3" />
                </Button>
              ))}
            </div>
          )}
        </div>

        {showFilters && (
          <div className="grid gap-4 border-t border-border/50 pt-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface-secondary/40 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Sortierung</span>
              <Select
                aria-label="Apps sortieren"
                selectedKey={selectedSort || 'default'}
                onSelectionChange={(key) => setSelectedSort(String(key))}
                className="w-full"
              >
                <Select.Trigger className="bg-field-background">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="default" textValue="Standard">
                      Standard
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="rating" textValue="Beste Bewertung">
                      Beste Bewertung
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="updated" textValue="Zuletzt aktualisiert">
                      Zuletzt aktualisiert
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="status" textValue="Status">
                      Status
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface-secondary/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Kategorien</span>
                <Button
                  variant={!selectedCategory ? "primary" : "secondary"}
                  size="sm"
                  onPress={() => setSelectedCategory(null)}
                  className={`rounded-full text-[11px] h-7 px-3 ${!selectedCategory ? 'text-background' : ''}`}
                >
                  Alle Kategorien
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 min-w-0">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? "primary" : "secondary"}
                    size="sm"
                    onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className={`rounded-full text-xs h-8 px-3 font-medium ${selectedCategory === cat ? 'text-background' : ''}`}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            {hasReuseApps && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface-secondary/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Art</span>
                  <Button
                    variant={!selectedType ? "primary" : "secondary"}
                    size="sm"
                    onPress={() => setSelectedType(null)}
                    className={`rounded-full text-[11px] h-7 px-3 ${!selectedType ? 'text-background' : ''}`}
                  >
                    Alle
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedType === 'install' ? "primary" : "secondary"}
                    size="sm"
                    onPress={() => setSelectedType(selectedType === 'install' ? null : 'install')}
                    className={`rounded-full text-[11px] h-7 px-3 ${selectedType === 'install' ? 'text-background' : ''}`}
                  >
                    Selbst installieren
                  </Button>
                  <Button
                    variant={selectedType === 'reuse' ? "primary" : "secondary"}
                    size="sm"
                    onPress={() => setSelectedType(selectedType === 'reuse' ? null : 'reuse')}
                    className={`rounded-full text-[11px] h-7 px-3 ${selectedType === 'reuse' ? 'text-background' : ''}`}
                  >
                    Nachnutzung
                  </Button>
                </div>
              </div>
            )}

            {statuses.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface-secondary/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Status</span>
                  <Button
                    variant={!selectedStatus ? "primary" : "secondary"}
                    size="sm"
                    onPress={() => setSelectedStatus(null)}
                    className={`rounded-full text-[11px] h-7 px-3 ${!selectedStatus ? 'text-background' : ''}`}
                  >
                    Alle
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((st) => (
                    <Button
                      key={st}
                      variant={selectedStatus === st ? "primary" : "secondary"}
                      size="sm"
                      onPress={() => setSelectedStatus(selectedStatus === st ? null : st)}
                      className={`rounded-full text-[11px] h-7 px-3 ${selectedStatus === st ? 'text-background' : ''}`}
                    >
                      {getAppStatusLabel(st) || st}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {groups.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface-secondary/40 p-4 lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Gruppe</span>
                  <Button
                    variant={!selectedGroup ? "primary" : "secondary"}
                    size="sm"
                    onPress={() => setSelectedGroup(null)}
                    className={`rounded-full text-[11px] h-7 px-3 ${!selectedGroup ? 'text-background' : ''}`}
                  >
                    Alle
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <Button
                      key={g.id}
                      variant={selectedGroup === g.id ? "primary" : "secondary"}
                      size="sm"
                      onPress={() => setSelectedGroup(selectedGroup === g.id ? null : g.id)}
                      className={`rounded-full text-[11px] h-7 px-3 ${selectedGroup === g.id ? 'text-background' : ''}`}
                    >
                      {g.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recently viewed — only when no active filters */}
      {!hasActiveFilters && recentApps.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Zuletzt gesehen</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {recentApps.map((app) => {
              const iconSrc = getImageAssetUrl(app.icon);

              return (
                <NextLink
                  key={app.id}
                  href={`/apps/${app.id}`}
                  className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl border border-border bg-surface hover:border-accent/40 hover:bg-accent/5 transition-all shadow-sm"
                >
                  {iconSrc ? (
                    <div className="relative w-5 h-5 shrink-0">
                      <Image src={iconSrc} alt={app.name} fill className="object-contain rounded" sizes="20px" unoptimized />
                    </div>
                  ) : (
                    <span className="text-sm leading-none">{app.icon || '🏛️'}</span>
                  )}
                  <span className="text-xs font-semibold text-foreground whitespace-nowrap">{app.name}</span>
                </NextLink>
              );
            })}
          </div>
        </div>
      )}

      {(() => {
        const visibleApps = filteredApps.slice(0, visibleCount);

        return (
          <>
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-medium text-muted">
                {serverLoading ? (
                  <span className="text-muted">Suche läuft...</span>
                ) : (
                  <><span className="text-foreground font-bold">{visibleApps.length}</span> von <span className="text-foreground font-bold">{hasServerFilter ? (serverResponse?.total ?? filteredApps.length) : filteredApps.length}</span> {(hasServerFilter ? (serverResponse?.total ?? filteredApps.length) : filteredApps.length) === 1 ? 'App' : 'Apps'} &mdash; <span className="text-xs text-muted/60">Karte anklicken für Details</span></>
                )}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 text-muted hover:text-foreground"
                  onPress={clearAllFilters}
                >
                  <X className="w-3.5 h-3.5" />
                  Filter zurücksetzen
                </Button>
              )}
            </div>

            {/* Apps grid — masonry layout so cards size to their own content */}
            <section id="apps" className="columns-1 md:columns-2 lg:columns-3 gap-x-5 pb-4" aria-label="App-Liste">
              {serverLoading ? (
                [...Array(6)].map((_, i) => (
                  <div key={`skeleton-${i}`} className="break-inside-avoid mb-5">
                    <AppCardSkeleton />
                  </div>
                ))
              ) : (
                visibleApps.map((app) => (
                  <div key={app.id} className="break-inside-avoid mb-5">
                    <AppCard app={app} />
                  </div>
                ))
              )}
            </section>

            {!serverLoading && filteredApps.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-14 h-14 bg-default rounded-full flex items-center justify-center">
                  <Search className="w-6 h-6 text-muted" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">Keine Apps gefunden</p>
                  <p className="text-sm text-muted mt-1">Versuchen Sie es mit anderen Suchbegriffen oder Kategorien.</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={clearAllFilters}
                >
                  Filter zurücksetzen
                </Button>
              </div>
            )}

            {!serverLoading && hasMoreApps && (
              <div ref={loadMoreRef} className="flex flex-col items-center gap-3 pb-8 pt-2" aria-live="polite">
                <span className="text-sm text-muted">Weitere Apps werden geladen, sobald Sie weiter scrollen.</span>
                <Button variant="secondary" onPress={loadMoreApps}>
                  Weitere Apps laden
                </Button>
              </div>
            )}
            {!serverLoading && filteredApps.length > 0 && !hasMoreApps && visibleApps.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-2 pb-8 pt-2 text-sm text-muted" aria-live="polite">
                <Loader2 className="h-4 w-4 text-success" /> Alle {filteredApps.length} Apps geladen
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
