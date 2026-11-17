import type { AppDraft } from "./shared";

export type SectionId =
  | "overview"
  | "basics"
  | "classification"
  | "links"
  | "documentation"
  | "deployment"
  | "repository"
  | "relations"
  | "details"
  | "banner";

export interface ReadinessItem {
  id: string;
  label: string;
  /** Needed before the app can leave draft. The rest are recommendations. */
  required: boolean;
  done: boolean;
  section: SectionId;
}

const hasUrl = (items?: { url?: string }[]) => !!items?.some((item) => item.url?.trim());

export function hasDeploymentData(app: AppDraft) {
  return !!(
    app.dockerRepo?.trim() ||
    app.customDockerCommand?.trim() ||
    app.customComposeCommand?.trim() ||
    app.helmRepo?.trim() ||
    app.customHelmCommand?.trim()
  );
}

/** What an app needs, and what helps, before it is published. */
export function getReadiness(app: AppDraft): ReadinessItem[] {
  return [
    { id: "name", label: "Name", required: true, done: !!app.name?.trim(), section: "basics" },
    { id: "description", label: "Kurzbeschreibung", required: true, done: !!app.description?.trim(), section: "basics" },
    { id: "categories", label: "Mindestens eine Kategorie", required: true, done: (app.categories?.length ?? 0) > 0, section: "classification" },
    { id: "authority", label: "Herausgeber", required: false, done: !!app.authority?.trim(), section: "classification" },
    { id: "links", label: "Live-Zugang, Quellcode oder Dokumentations-Link", required: false, done: hasUrl(app.liveDemos) || hasUrl(app.repositories) || hasUrl(app.customLinks) || !!app.docsUrl?.trim(), section: "links" },
    { id: "documentation", label: "Ausführliche Dokumentation", required: false, done: !!app.markdownContent?.trim(), section: "documentation" },
    { id: "deployment", label: "Installationsanleitung oder Nachnutzung", required: false, done: (app.hasDeploymentAssistant !== false && hasDeploymentData(app)) || !!app.isReuse, section: "deployment" },
  ];
}
