import { defineI18n } from "fumadocs-core/i18n";
import { uiTranslations } from "fumadocs-ui/i18n";

export const i18n = defineI18n({
  defaultLanguage: "de",
  languages: ["de", "en"],
  hideLocale: "never",
  fallbackLanguage: "de",
});

export const translations = i18n
  .translations()
  .extend(uiTranslations())
  .add({
    de: {
      displayName: "Deutsch",
      "Ask AI(AI chat button)": "AI fragen",
      "Back to Home(404 page)": "Zur Startseite",
      "Choose a language(language switcher)": "Sprache auswählen",
      "Choose a language(language switcher)(aria-label)": "Sprache auswählen",
      "Close Search(search dialog)(aria-label)": "Suche schließen",
      "Close Sidebar(aria-label)": "Seitenleiste schließen",
      "Collapse Sidebar(sidebar)(aria-label)": "Seitenleiste einklappen",
      "Copied Text(code block)(aria-label)": "Text kopiert",
      "Copy Anchor Link(heading anchor)(aria-label)": "Anker-Link kopieren",
      "Copy Markdown(page actions)": "Markdown kopieren",
      "Copy Text(code block)(aria-label)": "Text kopieren",
      "Dark(theme switcher)(aria-label)": "Dunkles Design",
      "Edit on GitHub(edit page)": "Auf GitHub bearbeiten",
      "Hide Sidebar(sidebar)": "Seitenleiste ausblenden",
      "Last updated on(page footer)": "Zuletzt aktualisiert am",
      "No Headings(table of contents)": "Keine Überschriften",
      "No results found(search dialog)": "Keine Ergebnisse gefunden",
      "On this page(table of contents)": "Auf dieser Seite",
      "Open Search(search trigger)(aria-label)": "Suche öffnen",
      "Open Sidebar(sidebar)(aria-label)": "Seitenleiste öffnen",
      "Page Not Found(404 page)": "Seite nicht gefunden",
      "Previous Page(pagination)": "Vorherige Seite",
      "Next Page(pagination)": "Nächste Seite",
      "Search(search dialog)": "Suchen",
      "Search(search trigger)": "Suchen",
      "Show Sidebar(sidebar)": "Seitenleiste anzeigen",
      "System(theme switcher)(aria-label)": "Systemeinstellung",
      "Table of Contents(inline table of contents)": "Inhaltsverzeichnis",
      "Toggle Menu(mobile menu)(aria-label)": "Menü umschalten",
      "Toggle Theme(theme switcher)(aria-label)": "Design umschalten",
      "View as Markdown(page actions)": "Als Markdown anzeigen",
    },
    en: {
      displayName: "English",
    },
  });
