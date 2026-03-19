'use client';

import { AppConfig } from "@/config/apps";
import { Button, Input, TextField } from "@heroui/react";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppCard } from "./AppCard";

interface AppGridProps {
  initialApps: AppConfig[];
}

export function AppGrid({ initialApps }: AppGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

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
    // Define a stable sorting order for lifecycles (German labels)
    const order = ['POC', 'MVP', 'Sandbox', 'In Erprobung', 'Etabliert'];
    return Array.from(sts).sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [initialApps]);

  const getStatusLabel = (state: string) => {
    switch (state?.toLowerCase()) {
      case 'graduated':
      case 'etabliert':
      case 'produktiv': return 'Etabliert';
      case 'incubating':
      case 'in inkubation':
      case 'in erprobung': return 'In Erprobung';
      case 'sandbox': return 'Sandbox';
      case 'mvp': return 'MVP';
      case 'poc': return 'POC';
      default: return state;
    }
  };

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
        (selectedType === 'install' && !app.isReuse);
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

  return (
    <div className="flex flex-col gap-8">
      {/* Filter bar */}
      <div className="flex flex-col gap-4 bg-surface p-5 rounded-2xl border border-border shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1 max-w-md">
            <TextField value={searchQuery} onChange={setSearchQuery} className="w-full">
              <Input
                placeholder="Apps suchen..."
                className="w-full bg-field-background h-11 rounded-xl pl-10"
              />
            </TextField>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={!selectedCategory ? "primary" : "secondary"}
              onPress={() => setSelectedCategory(null)}
              className={`rounded-full text-xs h-9 px-4 font-medium ${!selectedCategory ? 'text-background' : ''}`}
            >
              Alle Kategorien
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "primary" : "secondary"}
                size="sm"
                onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`rounded-full text-xs h-9 px-4 font-medium ${selectedCategory === cat ? 'text-background' : ''}`}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {hasReuseApps && (
          <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted uppercase tracking-wider shrink-0">Art:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={!selectedType ? "primary" : "secondary"}
                  size="sm"
                  onPress={() => setSelectedType(null)}
                  className={`rounded-full text-[11px] h-7 px-3 ${!selectedType ? 'text-background' : ''}`}
                >
                  Alle
                </Button>
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
          </div>
        )}

        {statuses.length > 0 && (
          <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted uppercase tracking-wider shrink-0">Status:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={!selectedStatus ? "primary" : "secondary"}
                  size="sm"
                  onPress={() => setSelectedStatus(null)}
                  className={`rounded-full text-[11px] h-7 px-3 ${!selectedStatus ? 'text-background' : ''}`}
                >
                  Alle
                </Button>
                {statuses.map((st) => (
                  <Button
                    key={st}
                    variant={selectedStatus === st ? "primary" : "secondary"}
                    size="sm"
                    onPress={() => setSelectedStatus(selectedStatus === st ? null : st)}
                    className={`rounded-full text-[11px] h-7 px-3 ${selectedStatus === st ? 'text-background' : ''}`}
                  >
                    {getStatusLabel(st)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {groups.length > 0 && (
          <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted uppercase tracking-wider shrink-0">Gruppe:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={!selectedGroup ? "primary" : "secondary"}
                  size="sm"
                  onPress={() => setSelectedGroup(null)}
                  className={`rounded-full text-[11px] h-7 px-3 ${!selectedGroup ? 'text-background' : ''}`}
                >
                  Alle
                </Button>
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
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-medium text-muted">
          <span className="text-foreground font-bold">{filteredApps.length}</span> {filteredApps.length === 1 ? 'App' : 'Apps'} gefunden
        </p>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 text-muted hover:text-foreground"
            onPress={() => {
              setSearchQuery("");
              setSelectedCategory(null);
              setSelectedStatus(null);
              setSelectedType(null);
              setSelectedGroup(null);
            }}
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
            onPress={() => {
              setSearchQuery("");
              setSelectedCategory(null);
              setSelectedStatus(null);
              setSelectedType(null);
              setSelectedGroup(null);
            }}
          >
            Filter zurücksetzen
          </Button>
        </div>
      )}
    </div>
  );
}
