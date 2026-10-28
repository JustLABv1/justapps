import type { LucideIcon } from "lucide-react";

import {
  Activity,
  Archive,
  Bot,
  FileText,
  GitBranch,
  KeyRound,
  Layers,
  LayoutDashboard,
  Paintbrush,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Workflow,
} from "lucide-react";

export type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
  matchPrefixes?: string[];
  group?: string;
};

export const adminNavLinks: AdminNavLink[] = [
  {
    href: "/verwaltung",
    label: "Übersicht",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/verwaltung/katalog",
    label: "Katalog",
    group: "Katalog",
    icon: Layers,
    exact: false,
    matchPrefixes: ["/verwaltung/apps", "/verwaltung/gruppen"],
  },
  {
    href: "/verwaltung/sicherheit",
    label: "Benutzer & Zugriff",
    group: "Benutzer & Zugriff",
    icon: ShieldCheck,
    exact: false,
    matchPrefixes: ["/verwaltung/benutzer", "/verwaltung/tokens"],
  },
  {
    href: "/verwaltung/plattform/gestaltung",
    label: "Erscheinungsbild",
    group: "Erscheinungsbild",
    icon: Paintbrush,
    exact: false,
  },
  {
    href: "/verwaltung/integrationen",
    label: "Integrationen",
    group: "Integrationen",
    icon: GitBranch,
    exact: false,
    matchPrefixes: ["/verwaltung/repository-sync", "/verwaltung/gitlab"],
  },
  {
    href: "/verwaltung/betrieb",
    label: "Betrieb",
    group: "Betrieb",
    icon: Activity,
    exact: false,
    matchPrefixes: [
      "/verwaltung/katalog/gesundheit",
      "/verwaltung/sicherheit/audit",
      "/verwaltung/sicherheit/backups",
      "/verwaltung/audit",
      "/verwaltung/backups",
    ],
  },
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function isAdminNavLinkActive(link: AdminNavLink, pathname: string) {
  if (link.exact) {
    return pathname === link.href;
  }

  const destinationGroup = adminNavGroups.find((group) =>
    group.items.some((item) => isAdminDestinationActive(item, pathname)),
  );
  if (destinationGroup && link.group)
    return destinationGroup.label === link.group;

  if (matchesPrefix(pathname, link.href)) {
    return true;
  }

  return (link.matchPrefixes || []).some((prefix) =>
    matchesPrefix(pathname, prefix),
  );
}

export type AdminDestination = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords?: string;
  aliases?: string[];
};

export const adminNavGroups: { label: string; items: AdminDestination[] }[] = [
  {
    label: "Katalog",
    items: [
      {
        href: "/verwaltung/katalog/apps",
        label: "Apps verwalten",
        description: "App-Bestand, Entwürfe und Veröffentlichungen verwalten.",
        icon: Layers,
        aliases: ["/verwaltung/apps"],
        keywords: "Anwendungen Inhalte",
      },
      {
        href: "/verwaltung/katalog/spaces",
        label: "Private Spaces",
        description:
          "Spaces, Eigentümer, Mitglieder und Gruppenzuordnungen verwalten.",
        icon: Layers,
        keywords: "Private Bereiche Gruppenberechtigung",
      },
      {
        href: "/verwaltung/katalog/gruppen",
        label: "App-Gruppen",
        description: "Apps in Sammlungen organisieren.",
        icon: Users,
        aliases: ["/verwaltung/gruppen"],
      },
      {
        href: "/verwaltung/katalog/einstellungen",
        label: "Katalog konfigurieren",
        description:
          "Sortierung, angepinnte Apps, Link-Prüfung und Detailfelder konfigurieren.",
        icon: SlidersHorizontal,
        keywords:
          "Katalog Einstellungen Verhalten Reihenfolge Pinning Metadaten Felder",
      },
    ],
  },
  {
    label: "Benutzer & Zugriff",
    items: [
      {
        href: "/verwaltung/sicherheit/benutzer",
        label: "Benutzer & Freigaben",
        description:
          "Konten, Rollenzuweisungen und individuelle App- und Space-Freigaben verwalten.",
        icon: Users,
        aliases: ["/verwaltung/benutzer"],
        keywords: "Konten Nutzer Einreichung Erlaubnis",
      },
      {
        href: "/verwaltung/sicherheit/zugriff",
        label: "Zugriff & Berechtigungen",
        description:
          "Globale Regeln, Login-Pflicht, App- und Space-Erstellung, Community- und KI-Nutzung, Rollenrechte und OIDC-Anmeldung zentral festlegen.",
        icon: ShieldCheck,
        keywords:
          "Rollen Rechte Regeln Freigaben Governance Login Authentifizierung anonym FAQ KI AI Spaces Erstellung OIDC SSO Keycloak Gruppen Claim Client Secrets",
      },
      {
        href: "/verwaltung/sicherheit/tokens",
        label: "API-Tokens",
        description: "Persönliche und technische Zugriffstoken verwalten.",
        icon: KeyRound,
        aliases: ["/verwaltung/tokens"],
      },
    ],
  },
  {
    label: "Erscheinungsbild",
    items: [
      {
        href: "/verwaltung/plattform/gestaltung",
        label: "Erscheinungsbild",
        description:
          "Name, Logos, Farben, Startseite, Banner und Footer-Links an einem Ort konfigurieren.",
        icon: Paintbrush,
        keywords: "Branding Design Hero Favicon Impressum Datenschutz Fußzeile",
      },
    ],
  },
  {
    label: "Integrationen",
    items: [
      {
        href: "/verwaltung/integrationen/repository-providers",
        label: "GitHub & GitLab",
        description:
          "Repository-Provider, Tokens und Standardpfade konfigurieren.",
        icon: GitBranch,
        aliases: ["/verwaltung/gitlab"],
      },
      {
        href: "/verwaltung/integrationen/repository-sync",
        label: "Repository-Sync",
        description: "Synchronisationen und ausstehende Änderungen prüfen.",
        icon: Workflow,
        aliases: ["/verwaltung/repository-sync"],
      },
      {
        href: "/verwaltung/integrationen/ai",
        label: "KI-Provider & Modelle",
        description:
          "KI-Anbindungen, Modelle und den Wissensindex konfigurieren.",
        icon: Bot,
        keywords: "AI Chat OpenAI Index",
      },
    ],
  },
  {
    label: "Betrieb",
    items: [
      {
        href: "/verwaltung/katalog/gesundheit",
        label: "App-Gesundheit",
        description:
          "Defekte Links, Synchronisationsprobleme und veraltete Apps finden.",
        icon: Activity,
        keywords: "Monitoring Erreichbarkeit Pflegezustand",
      },
      {
        href: "/verwaltung/sicherheit/audit",
        label: "Aktivitätsprotokoll",
        description:
          "Änderungen und administrative Aktivitäten nachvollziehen.",
        icon: FileText,
        aliases: ["/verwaltung/audit"],
        keywords: "Audit Logs",
      },
      {
        href: "/verwaltung/sicherheit/backups",
        label: "Sicherung & Wiederherstellung",
        description: "Backups exportieren und wiederherstellen.",
        icon: Archive,
        aliases: ["/verwaltung/backups"],
        keywords: "Restore Migration",
      },
    ],
  },
];

export function isAdminDestinationActive(
  item: AdminDestination,
  pathname: string,
) {
  return [item.href, ...(item.aliases ?? [])].some((prefix) =>
    matchesPrefix(pathname, prefix),
  );
}

export function searchAdminDestinations(query: string) {
  const normalize = (value: string) =>
    value
      .toLocaleLowerCase("de")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return adminNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const text = normalize(
          `${group.label} ${item.label} ${item.description} ${item.keywords ?? ""}`,
        );
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((group) => group.items.length > 0);
}
