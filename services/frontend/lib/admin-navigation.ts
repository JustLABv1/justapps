import type { LucideIcon } from 'lucide-react';

import { GitBranch, Layers, LayoutDashboard, Paintbrush, ShieldCheck } from 'lucide-react';

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
    matchPrefixes: ['/verwaltung/backups', '/verwaltung/benutzer', '/verwaltung/audit', '/verwaltung/tokens'],
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