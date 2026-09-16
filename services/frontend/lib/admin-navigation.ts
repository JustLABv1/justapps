import type { LucideIcon } from 'lucide-react';

import { Activity, Archive, Bot, FileText, GitBranch, Globe, KeyRound, Layers, LayoutDashboard, Paintbrush, ShieldCheck, SlidersHorizontal, Users, Workflow } from 'lucide-react';

export type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
  matchPrefixes?: string[];
};

export const adminNavLinks: AdminNavLink[] = [
  { href: '/verwaltung', label: 'Übersicht', icon: LayoutDashboard, exact: true },
  {
    href: '/verwaltung/katalog',
    label: 'Katalog',
    icon: Layers,
    exact: false,
    matchPrefixes: ['/verwaltung/apps', '/verwaltung/gruppen'],
  },
  {
    href: '/verwaltung/plattform',
    label: 'Plattform',
    icon: Paintbrush,
    exact: false,
    matchPrefixes: ['/verwaltung/einstellungen'],
  },
  {
    href: '/verwaltung/integrationen',
    label: 'Integrationen',
    icon: GitBranch,
    exact: false,
    matchPrefixes: ['/verwaltung/repository-sync', '/verwaltung/gitlab'],
  },
  {
    href: '/verwaltung/sicherheit',
    label: 'Sicherheit',
    icon: ShieldCheck,
    exact: false,
    matchPrefixes: ['/verwaltung/backups', '/verwaltung/benutzer', '/verwaltung/audit', '/verwaltung/tokens', '/verwaltung/sicherheit/rollen'],
  },
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

export function isAdminNavLinkActive(link: AdminNavLink, pathname: string) {
  if (link.exact) {
    return pathname === link.href;
  }

  if (matchesPrefix(pathname, link.href)) {
    return true;
  }

  return (link.matchPrefixes || []).some((prefix) => matchesPrefix(pathname, prefix));
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
  { label: 'Apps & Inhalte', items: [
    { href: '/verwaltung/katalog/apps', label: 'Apps verwalten', description: 'Apps anlegen, bearbeiten und veröffentlichen.', icon: Layers, aliases: ['/verwaltung/apps'], keywords: 'Katalog Entwürfe Anwendungen' },
    { href: '/verwaltung/katalog/gruppen', label: 'Gruppen', description: 'Apps in Gruppen organisieren.', icon: Users, aliases: ['/verwaltung/gruppen'] },
    { href: '/verwaltung/katalog/inhalte', label: 'Felder & Links', description: 'Detailfelder, Metadaten und Footer-Links konfigurieren.', icon: FileText, keywords: 'Inhalte Fußzeile' },
    { href: '/verwaltung/katalog/app-verhalten', label: 'Katalog-Einstellungen', description: 'Sortierung, angepinnte Apps und Link-Prüfung einstellen.', icon: SlidersHorizontal, keywords: 'App Verhalten Pinning Reihenfolge' },
  ] },
  { label: 'Benutzer & Zugriff', items: [
    { href: '/verwaltung/sicherheit/benutzer', label: 'Benutzer', description: 'Konten und Rollenzuweisungen verwalten.', icon: Users, aliases: ['/verwaltung/benutzer'] },
    { href: '/verwaltung/sicherheit/rollen', label: 'Rollen & Rechte', description: 'Rollen erstellen und Berechtigungen vergeben.', icon: ShieldCheck, keywords: 'Moderatoren Zugriff' },
    { href: '/verwaltung/integrationen/auth', label: 'Anmeldung & SSO', description: 'Login-Pflicht und OIDC-Anbieter konfigurieren.', icon: KeyRound, keywords: 'Authentifizierung Login Single Sign On' },
    { href: '/verwaltung/sicherheit/tokens', label: 'API-Tokens', description: 'Zugriffstoken verwalten.', icon: KeyRound, aliases: ['/verwaltung/tokens'] },
  ] },
  { label: 'Auftritt & Regeln', items: [
    { href: '/verwaltung/plattform/branding', label: 'Name & Erscheinungsbild', description: 'Plattformname, Logos, Farben und Favicon ändern.', icon: Paintbrush, keywords: 'Branding Design' },
    { href: '/verwaltung/plattform/startseite', label: 'Startseite & Banner', description: 'Begrüßung, Hero und Ankündigungen gestalten.', icon: Globe },
    { href: '/verwaltung/plattform/governance', label: 'Regeln & Freigaben', description: 'Einreichungen und Freigaben konfigurieren.', icon: ShieldCheck, keywords: 'Governance Plattform' },
  ] },
  { label: 'Anbindungen & KI', items: [
    { href: '/verwaltung/integrationen/repository-providers', label: 'GitHub & GitLab', description: 'Repository-Anbieter und Verbindungen einrichten.', icon: GitBranch, aliases: ['/verwaltung/gitlab'], keywords: 'Provider Tokens Integration' },
    { href: '/verwaltung/integrationen/repository-sync', label: 'Repository-Sync', description: 'Synchronisation und ausstehende Änderungen prüfen.', icon: Workflow, aliases: ['/verwaltung/repository-sync'] },
    { href: '/verwaltung/integrationen/ai', label: 'KI-Assistent', description: 'Modelle, Provider und Wissensindex konfigurieren.', icon: Bot, keywords: 'AI Chat OpenAI' },
  ] },
  { label: 'Betrieb', items: [
    { href: '/verwaltung/katalog/gesundheit', label: 'App-Gesundheit', description: 'Defekte Links und veraltete Apps finden.', icon: Activity, keywords: 'Monitoring Erreichbarkeit Fehler' },
    { href: '/verwaltung/sicherheit/audit', label: 'Aktivitätsprotokoll', description: 'Änderungen und administrative Aktivitäten nachvollziehen.', icon: FileText, aliases: ['/verwaltung/audit'], keywords: 'Audit Logs' },
    { href: '/verwaltung/sicherheit/backups', label: 'Sicherung & Wiederherstellung', description: 'Backups exportieren und importieren.', icon: Archive, aliases: ['/verwaltung/backups'], keywords: 'Restore Migration' },
  ] },
];

export function isAdminDestinationActive(item: AdminDestination, pathname: string) {
  return [item.href, ...(item.aliases ?? [])].some((prefix) => matchesPrefix(pathname, prefix));
}

export function searchAdminDestinations(query: string) {
  const normalize = (value: string) => value.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return adminNavGroups.map((group) => ({ ...group, items: group.items.filter((item) => {
    const text = normalize(`${group.label} ${item.label} ${item.description} ${item.keywords ?? ''}`);
    return words.every((word) => text.includes(word));
  }) })).filter((group) => group.items.length > 0);
}
