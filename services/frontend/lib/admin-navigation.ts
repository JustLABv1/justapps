import type { LucideIcon } from 'lucide-react';

import { Activity, Archive, GitBranch, KeyRound, Layers, Layers2, LayoutDashboard, Settings, Users } from 'lucide-react';

export type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
};

export const adminNavLinks: AdminNavLink[] = [
  { href: '/verwaltung', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/verwaltung/backups', label: 'Backups', icon: Archive, exact: false },
  { href: '/verwaltung/apps', label: 'Apps', icon: Layers, exact: false },
  { href: '/verwaltung/repository-sync', label: 'Repository Sync', icon: GitBranch, exact: false },
  { href: '/verwaltung/gruppen', label: 'Gruppen', icon: Layers2, exact: false },
  { href: '/verwaltung/benutzer', label: 'Benutzer', icon: Users, exact: false },
  { href: '/verwaltung/audit', label: 'Audit', icon: Activity, exact: false },
  { href: '/verwaltung/tokens', label: 'Tokens', icon: KeyRound, exact: false },
  { href: '/verwaltung/einstellungen', label: 'Einstellungen', icon: Settings, exact: false },
];