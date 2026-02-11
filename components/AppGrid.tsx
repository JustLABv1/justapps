'use client';

import { useState, useMemo } from "react";
import { Input, Chip, Button } from "@heroui/react";
import { Search } from "lucide-react";
import { AppCard } from "./AppCard";
import { AppConfig } from "@/config/apps";

interface AppGridProps {
  initialApps: AppConfig[];
}

export function AppGrid({ initialApps }: AppGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(initialApps.map(app => app.category));
    return Array.from(cats);
  }, [initialApps]);

  const filteredApps = useMemo(() => {
    return initialApps.filter((app) => {
      const matchesSearch = 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !selectedCategory || app.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [initialApps, searchQuery, selectedCategory]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative w-full md:max-w-md">
          <Input
            placeholder="Apps suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <Chip
            variant={selectedCategory === null ? "primary" : "tertiary"}
            color={selectedCategory === null ? "accent" : "default"}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(null)}
          >
            Alle
          </Chip>
          {categories.map((cat) => (
            <Chip
              key={cat}
              variant={selectedCategory === cat ? "primary" : "tertiary"}
              color={selectedCategory === cat ? "accent" : "default"}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Chip>
          ))}
        </div>
      </div>

      <div className="text-sm text-default-500 font-medium">
        {filteredApps.length} {filteredApps.length === 1 ? 'App' : 'Apps'} gefunden
      </div>

      <section id="apps" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20 justify-items-center">
        {filteredApps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </section>

      {filteredApps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 bg-default-100 rounded-full flex items-center justify-center">
            <Search className="w-8 h-8 text-default-300" />
          </div>
          <div>
            <p className="text-xl font-bold text-bund-black">Keine Apps gefunden</p>
            <p className="text-default-500">Versuchen Sie es mit anderen Suchbegriffen oder Kategorien.</p>
          </div>
          <Button 
            variant="tertiary"
            onPress={() => {
              setSearchQuery("");
              setSelectedCategory(null);
            }}
          >
            Filter zurücksetzen
          </Button>
        </div>
      )}
    </div>
  );
}
