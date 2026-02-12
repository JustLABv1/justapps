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
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(initialApps.map(app => app.category));
    return Array.from(cats);
  }, [initialApps]);

  const collections = useMemo(() => {
    const cols = new Set<string>();
    initialApps.forEach(app => {
      app.collections?.forEach(col => cols.add(col));
    });
    return Array.from(cols);
  }, [initialApps]);

  const filteredApps = useMemo(() => {
    return initialApps.filter((app) => {
      const matchesSearch = 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = !selectedCategory || app.category === selectedCategory;
      const matchesCollection = !selectedCollection || app.collections?.includes(selectedCollection);
      
      return matchesSearch && matchesCategory && matchesCollection;
    });
  }, [initialApps, searchQuery, selectedCategory, selectedCollection]);

  const hasActiveFilters = searchQuery || selectedCategory || selectedCollection;

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 bg-surface p-4 rounded-lg border border-border">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md">
            <TextField value={searchQuery} onChange={setSearchQuery} className="w-full">
              <Input
                placeholder="Apps suchen..."
                className="w-full"
              />
            </TextField>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={!selectedCategory ? undefined : "secondary"}
              onPress={() => setSelectedCategory(null)}
              className="rounded-full text-xs"
            >
              Alle
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? undefined : "secondary"}
                size="sm"
                onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className="rounded-full text-xs"
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {collections.length > 0 && (
          <div className="flex items-center gap-3 pt-3 border-t border-separator">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider shrink-0">Kollektionen:</span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={!selectedCollection ? undefined : "secondary"}
                size="sm"
                onPress={() => setSelectedCollection(null)}
                className="rounded-full text-xs h-7"
              >
                Alle
              </Button>
              {collections.map((col) => (
                <Button
                  key={col}
                  variant={selectedCollection === col ? undefined : "secondary"}
                  size="sm"
                  onPress={() => setSelectedCollection(selectedCollection === col ? null : col)}
                  className="rounded-full text-xs h-7"
                >
                  {col}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {filteredApps.length} {filteredApps.length === 1 ? 'App' : 'Apps'} gefunden
        </p>
        {hasActiveFilters && (
          <Button
            variant="secondary"
            size="sm"
            className="text-xs gap-1.5"
            onPress={() => {
              setSearchQuery("");
              setSelectedCategory(null);
              setSelectedCollection(null);
            }}
          >
            <X className="w-3 h-3" />
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Apps grid */}
      <section id="apps" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-12">
        {filteredApps.map((app) => (
          <AppCard key={app.id} app={app} />
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
              setSelectedCollection(null);
            }}
          >
            Filter zurücksetzen
          </Button>
        </div>
      )}
    </div>
  );
}
