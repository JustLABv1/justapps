'use client';

import { AppConfig } from "@/config/apps";
import { getAppStatusLabel, sortAppStatuses } from "@/lib/appStatus";
import { Button, Input, TextField } from "@heroui/react";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppCard } from "./AppCard";

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

  const [inputValue, setInputValue] = useState(searchQuery);
  const [showFilters, setShowFilters] = useState(false);

  // Keep input in sync if URL changes externally (e.g. global search, back button)
  useEffect(() => {
    setInputValue(searchParams.get('q') ?? '');
  }, [searchParams]);

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

  const setSelectedCategory = (v: string | null) => updateParam('category', v);
  const setSelectedStatus = (v: string | null) => updateParam('status', v);
  const setSelectedType = (v: string | null) => updateParam('type', v);
  const setSelectedGroup = (v: string | null) => updateParam('group', v);
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

  const filteredApps = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return initialApps.filter((app) => {
      const matchesSearch = 
        app.name.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query) ||
        app.authority?.toLowerCase().includes(query) ||
        app.categories?.some(cat => cat.toLowerCase().includes(query)) ||
        app.tags?.some(tag => tag.toLowerCase().includes(query));
      
      const matchesCategory = !selectedCategory || app.categories?.includes(selectedCategory);
      const matchesStatus = !selectedStatus || app.status === selectedStatus;
      const matchesType = !selectedType ||
        (selectedType === 'reuse' && app.isReuse) ||
        (selectedType === 'install' && app.hasDeploymentAssistant !== false);
      const matchesGroup = !selectedGroup || app.appGroups?.some(g => g.id === selectedGroup);

      return matchesSearch && matchesCategory && matchesStatus && matchesType && matchesGroup;
    });
  }, [initialApps, searchQuery, selectedCategory, selectedStatus, selectedType, selectedGroup]);

  const hasActiveFilters = searchQuery || selectedCategory || selectedStatus || selectedType || selectedGroup;

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
    setInputValue('');
    router.replace('/', { scroll: false });
  };

  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; clear: () => void }> = [];

    if (searchQuery) {
      filters.push({
        key: 'search',
        label: `Suche: ${searchQuery}`,
        clear: () => { setInputValue(''); commitSearch(''); },
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

    return filters;
  }, [groups, searchQuery, selectedCategory, selectedGroup, selectedStatus, selectedType]);

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
            <TextField value={inputValue} onChange={(v) => setInputValue(v)} className="w-full">
              <Input
                placeholder="Apps suchen..."
                className="w-full bg-field-background h-11 rounded-xl pl-10"
                onKeyDown={(e) => { if (e.key === 'Enter') commitSearch(inputValue); }}
                onBlur={() => { if (inputValue !== searchQuery) commitSearch(inputValue); }}
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

        {(quickCategories.length > 0 || quickStatuses.length > 0) && (
          <div className="flex flex-col gap-3 border-t border-border/50 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted/80">Schnellfilter</span>
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

      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-medium text-muted">
          <span className="text-foreground font-bold">{filteredApps.length}</span> {filteredApps.length === 1 ? 'App' : 'Apps'} gefunden
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
      <section id="apps" className="columns-1 md:columns-2 lg:columns-3 gap-x-5 pb-12">
        {filteredApps.map((app) => (
          <div key={app.id} className="break-inside-avoid mb-5">
            <AppCard app={app} />
          </div>
        ))}
      </section>

      {filteredApps.length === 0 && (
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
    </div>
  );
}
