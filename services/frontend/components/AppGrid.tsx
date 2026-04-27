'use client';

import { AppConfig } from "@/config/apps";
import { useFavorites } from "@/context/FavoritesContext";
import { fetchApi } from "@/lib/api";
import { getAppStatusLabel, sortAppStatuses } from "@/lib/appStatus";
import { getImageAssetUrl } from "@/lib/assets";
import { emptyRecentlyViewed, getRecentlyViewed, subscribeToRecentlyViewed } from "@/lib/recentlyViewed";
import { Button, Input, Pagination, TextField } from "@heroui/react";
import { ChevronDown, ChevronUp, Clock, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  const hasServerFilter = Boolean(searchQuery || selectedCategory || selectedStatus || selectedGroup);
  const paginationKey = [
    searchQuery,
    selectedCategory ?? '',
    selectedStatus ?? '',
    selectedType ?? '',
    selectedGroup ?? '',
  ].join('|');

  const [showFilters, setShowFilters] = useState(false);
  const [serverResponse, setServerResponse] = useState<{ key: string; apps: AppConfig[] } | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [pagination, setPagination] = useState({ key: paginationKey, page: 1 });

  const { favorites, isLoaded: favoritesLoaded } = useFavorites();
  const recentApps = useSyncExternalStore(subscribeToRecentlyViewed, getRecentlyViewed, () => emptyRecentlyViewed);
  const currentPage = pagination.key === paginationKey ? pagination.page : 1;
  const serverFilterKey = useMemo(() => JSON.stringify({
    q: searchQuery,
    category: selectedCategory,
    status: selectedStatus,
    group: selectedGroup,
  }), [searchQuery, selectedCategory, selectedStatus, selectedGroup]);
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
        if (selectedGroup) params.set('group', selectedGroup);
        const res = await fetchApi(`/apps?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setServerResponse({
            key: serverFilterKey,
            apps: Array.isArray(data) ? data : [],
          });
        }
      } catch { /* silent */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [hasServerFilter, searchQuery, selectedCategory, selectedStatus, selectedGroup, serverFilterKey]);

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
  const setCurrentPage = useCallback((nextPage: number | ((page: number) => number)) => {
    setPagination((previous) => {
      const previousPage = previous.key === paginationKey ? previous.page : 1;
      const resolvedPage = typeof nextPage === 'function'
        ? nextPage(previousPage)
        : nextPage;

      return {
        key: paginationKey,
        page: resolvedPage,
      };
    });
  }, [paginationKey]);

  const setSelectedCategory = useCallback((v: string | null) => updateParam('category', v), [updateParam]);
  const setSelectedStatus = useCallback((v: string | null) => updateParam('status', v), [updateParam]);
  const setSelectedType = useCallback((v: string | null) => updateParam('type', v), [updateParam]);
  const setSelectedGroup = useCallback((v: string | null) => updateParam('group', v), [updateParam]);
  const commitSearch = useCallback((v: string) => updateParam('q', v || null), [updateParam]);

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
            app.authority?.toLowerCase().includes(query) ||
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

  const hasActiveFilters = searchQuery || selectedCategory || selectedStatus || selectedType || selectedGroup || showFavoritesOnly;

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

    if (showFavoritesOnly) {
      filters.push({
        key: 'favorites',
        label: 'Meine Favoriten',
        clear: () => setShowFavoritesOnly(false),
      });
    }

    return filters;
  }, [commitSearch, groups, searchQuery, selectedCategory, selectedGroup, selectedStatus, selectedType, setSelectedCategory, setSelectedGroup, setSelectedStatus, setSelectedType, showFavoritesOnly]);

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
          <div className="relative w-full lg:max-w-2xl">
            <TextField value={searchQuery} onChange={commitSearch} className="w-full">
              <Input
                placeholder="Apps suchen..."
                className="w-full bg-field-background h-11 rounded-xl pl-10"
              />
            </TextField>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
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
        const totalPages = Math.ceil(filteredApps.length / PAGE_SIZE);
        const safePage = Math.min(currentPage, Math.max(1, totalPages));
        const from = filteredApps.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
        const to = Math.min(safePage * PAGE_SIZE, filteredApps.length);
        const paginatedApps = filteredApps.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

        return (
          <>
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-medium text-muted">
                {serverLoading ? (
                  <span className="text-muted">Suche läuft...</span>
                ) : totalPages > 1 ? (
                  <><span className="text-foreground font-bold">{from}–{to}</span> von <span className="text-foreground font-bold">{filteredApps.length}</span> Apps &mdash; <span className="text-xs text-muted/60">Karte anklicken für Details</span></>
                ) : (
                  <><span className="text-foreground font-bold">{filteredApps.length}</span> {filteredApps.length === 1 ? 'App' : 'Apps'} gefunden &mdash; <span className="text-xs text-muted/60">Karte anklicken für Details</span></>
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
                paginatedApps.map((app) => (
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

            {!serverLoading && totalPages > 1 && (
              <div className="flex justify-center pb-8">
                <Pagination aria-label="Seitennavigation">
                  <Pagination.Content>
                    <Pagination.Item>
                      <Pagination.Previous
                        onPress={() => { setCurrentPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        isDisabled={safePage === 1}
                        aria-label="Vorherige Seite"
                      >
                        <Pagination.PreviousIcon />
                      </Pagination.Previous>
                    </Pagination.Item>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - safePage) <= 1) return true;
                        return false;
                      })
                      .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                        if (idx > 0 && (page as number) - (arr[idx - 1] as number) > 1) {
                          acc.push('ellipsis');
                        }
                        acc.push(page);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === 'ellipsis' ? (
                          <Pagination.Item key={`ellipsis-${idx}`}>
                            <Pagination.Ellipsis />
                          </Pagination.Item>
                        ) : (
                          <Pagination.Item key={item}>
                            <Pagination.Link
                              isActive={item === safePage}
                              onPress={() => { setCurrentPage(item as number); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            >
                              {item}
                            </Pagination.Link>
                          </Pagination.Item>
                        )
                      )}

                    <Pagination.Item>
                      <Pagination.Next
                        onPress={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        isDisabled={safePage === totalPages}
                        aria-label="Nächste Seite"
                      >
                        <Pagination.NextIcon />
                      </Pagination.Next>
                    </Pagination.Item>
                  </Pagination.Content>
                </Pagination>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
