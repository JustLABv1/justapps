"use client";

import { Input } from "@/components/panelui/input";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { SectionId } from "./readiness";

export interface SearchableSection {
  id: SectionId;
  label: string;
  description: string;
}

export interface Hit {
  key: string;
  sectionId: SectionId;
  sectionLabel: string;
  /** The field's label, or null for a hit on the section itself. */
  field: string | null;
  element: HTMLElement | null;
}

/** What counts as a field's name inside a section: form labels, card titles and setting rows. */
const LABEL_SELECTOR = "label, h3, [data-search-label]";

/** The block a label explains: its field, its setting row, or the header of its card (title and description). */
const CONTEXT_SELECTOR = "[data-search-target], [data-slot='field'], [data-slot='card-header']";

const normalize = (text: string) => text.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();

/**
 * Every section is mounted (only the open one is shown), so the fields are read from the page itself:
 * whatever a section renders, including platform-defined detail fields, can be found without a list to keep in sync.
 *
 * A field is found by its label, by the words around it (its description) and by `data-search-keywords`
 * for words people search for that the field does not say, such as "Space" for where an app lives.
 * Hits on the label come first.
 */
function findHits(query: string, sections: SearchableSection[]): Hit[] {
  const words = normalize(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const matches = (text: string) => {
    const haystack = normalize(text);
    return words.every((word) => haystack.includes(word));
  };

  const scored: { hit: Hit; score: number }[] = [];
  for (const section of sections) {
    if (matches(`${section.label} ${section.description}`)) {
      scored.push({ hit: { key: section.id, sectionId: section.id, sectionLabel: section.label, field: null, element: null }, score: matches(section.label) ? 3 : 1 });
    }
    const root = document.getElementById(`section-${section.id}`);
    if (!root) continue;
    const seen = new Set<string>();
    for (const element of root.querySelectorAll<HTMLElement>(LABEL_SELECTOR)) {
      // The label's own text, without a "(optional)" or required marker drawn inside it.
      const text = (element.dataset.searchLabel || element.textContent || "").replace(/\s*\((optional|Pflicht)\)\s*$/i, "").replace(/\*$/, "").trim();
      if (!text || text.length > 80 || seen.has(text)) continue;
      const context = `${element.dataset.searchKeywords ?? ""} ${(element.closest(CONTEXT_SELECTOR)?.textContent ?? "").slice(0, 400)}`;
      const score = matches(text) ? 2 : matches(`${text} ${context}`) ? 1 : 0;
      if (!score) continue;
      seen.add(text);
      scored.push({ hit: { key: `${section.id}:${text}`, sectionId: section.id, sectionLabel: section.label, field: text, element }, score });
    }
  }
  // Stable: equal scores keep the order of the page.
  return scored.sort((left, right) => right.score - left.score).slice(0, 12).map((entry) => entry.hit);
}

/** Brings a field into view once its section is shown, puts the cursor in it and marks it for a moment. */
function revealField(element: HTMLElement) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const container = element.closest<HTMLElement>("[data-search-target], [data-slot='field'], [data-slot='card']") ?? element;
  container.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });

  const forId = element instanceof HTMLLabelElement ? element.htmlFor : "";
  const control = (forId && document.getElementById(forId))
    || container.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select, button[role='switch'], [role='combobox']");
  control?.focus({ preventScroll: true });

  container.classList.remove("editor-search-hit");
  void container.offsetWidth; // restart the highlight when the same field is picked twice
  container.classList.add("editor-search-hit");
  window.setTimeout(() => container.classList.remove("editor-search-hit"), 1600);
}

export type EditorSearchState = ReturnType<typeof useEditorSearch>;

/** The query, its hits, and opening a hit: shared by the sidebar and the small-screen layout. */
export function useEditorSearch(sections: SearchableSection[], onOpenSection: (id: SectionId) => void) {
  const [query, setQuery] = useState("");
  // Recomputed on each keystroke; reading the page is cheap at this size.
  const hits = useMemo(() => (query.trim() ? findHits(query, sections) : []), [query, sections]);

  const open = (hit: Hit) => {
    onOpenSection(hit.sectionId);
    setQuery("");
    if (hit.element) {
      const element = hit.element;
      // Wait for the section to be shown before measuring where the field is.
      requestAnimationFrame(() => requestAnimationFrame(() => revealField(element)));
    }
  };

  return { query, setQuery, hits, open, searching: query.trim().length > 0 };
}

/** The search field. Enter opens the first hit, Escape clears it. */
export function EditorSearchInput({ search, className }: { search: EditorSearchState; className?: string }) {
  const { query, setQuery, hits, open } = search;
  return (
    <Input.Group className={className}>
      <Input.Addon><Search /></Input.Addon>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && hits[0]) {
            event.preventDefault();
            open(hits[0]);
          }
          if (event.key === "Escape") setQuery("");
        }}
        placeholder="Feld suchen …"
        aria-label="Felder im Editor suchen"
      />
      {query && (
        <Input.Addon align="end">
          <button type="button" aria-label="Suche löschen" onClick={() => setQuery("")} className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </Input.Addon>
      )}
    </Input.Group>
  );
}

/** The hits grouped by the section they are in, in the order the sections come. */
export function groupHits(hits: Hit[]) {
  const groups = new Map<SectionId, Hit[]>();
  for (const hit of hits) groups.set(hit.sectionId, [...(groups.get(hit.sectionId) ?? []), hit]);
  return [...groups.entries()].map(([sectionId, items]) => ({ sectionId, label: items[0].sectionLabel, items }));
}

/** The small-screen search: the field above the section picker, its hits as a plain list in place of the picker. */
export function EditorSearch({ search, children }: { search: EditorSearchState; children: React.ReactNode }) {
  const { hits, open, searching } = search;
  return (
    <div className="flex flex-col gap-3">
      <EditorSearchInput search={search} />
      {searching ? (
        hits.length > 0 ? (
          <ul className="flex flex-col" aria-label="Suchergebnisse">
            {hits.map((hit) => (
              <li key={hit.key}>
                <button
                  type="button"
                  onClick={() => open(hit)}
                  className="flex w-full cursor-pointer flex-col rounded-lg px-2.5 py-2 text-start text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="truncate font-medium">{hit.field ?? hit.sectionLabel}</span>
                  <span className="truncate text-xs text-muted-foreground">{hit.field ? `in ${hit.sectionLabel}` : "Bereich"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2.5 text-sm text-muted-foreground">Kein Feld gefunden.</p>
        )
      ) : (
        children
      )}
    </div>
  );
}
