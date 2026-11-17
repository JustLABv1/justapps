'use client';

import { JustAppsLogo } from '@/components/JustAppsLogo';
import { Command } from '@/components/panelui/command';
import type { AppConfig } from '@/config/apps';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useUpdates } from '@/context/UpdatesContext';
import { groupColor, groupInitials, loadApps, loadGroups, type AppGroup } from '@/lib/appGroups';
import { getImageAssetUrl, resolveAssetUrl } from '@/lib/assets';
import { getRecentlyViewed, type RecentApp } from '@/lib/recentlyViewed';
import { Bell, LogIn, LogOut, Moon, Plus, Search, Sparkles, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';

export interface SiteSearchPage {
  href: string;
  label: string;
  icon: ElementType;
  external?: boolean;
}

/** The coloured tile each page and action sits on, as in a launcher. */
const TONES: Record<string, string> = {
  '/': 'bg-blue-500',
  '/gruppen': 'bg-violet-500',
  '/faq': 'bg-amber-500',
  '/docs': 'bg-teal-500',
  '/meine-apps': 'bg-emerald-500',
  '/updates': 'bg-rose-500',
  '/profil': 'bg-sky-500',
  '/neuigkeiten': 'bg-orange-500',
  '/bedarf': 'bg-yellow-500',
  '/verwaltung': 'bg-neutral-700',
};

function Tile({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={`flex size-full items-center justify-center text-white [&>svg]:size-3.5 ${tone}`}>
      {children}
    </span>
  );
}

function AppMark({ app }: { app: Pick<AppConfig, 'icon'> }) {
  const src = getImageAssetUrl(app.icon);
  return (
    <span className="relative flex size-full items-center justify-center overflow-hidden bg-muted text-sm leading-none">
      {src ? <Image src={src} alt="" fill sizes="32px" className="object-contain p-0.5" unoptimized /> : app.icon || '🏛️'}
    </span>
  );
}

function GroupMark({ group }: { group: AppGroup }) {
  const src = getImageAssetUrl(group.icon);
  return (
    <span
      style={{ '--group': groupColor(group.id) } as CSSProperties}
      className="relative flex size-full items-center justify-center overflow-hidden bg-[color-mix(in_oklab,var(--group)_16%,var(--card))] text-[0.625rem] font-semibold text-[var(--group)]"
    >
      {src ? <Image src={src} alt="" fill sizes="32px" className="object-contain p-0.5" unoptimized /> : group.icon || groupInitials(group.name)}
    </span>
  );
}

/**
 * ⌘K across the catalog: recently seen apps, every app and group, the pages
 * of the site and a few actions. Tab, or Enter on the last row, searches the
 * full catalog with what was typed.
 */
export function SiteSearch({
  open,
  onOpenChange,
  pages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: SiteSearchPage[];
}) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { totalUnread } = useUpdates();
  const { resolvedTheme, setTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [apps, setApps] = useState<AppConfig[] | null>(null);
  const [groups, setGroups] = useState<AppGroup[]>([]);
  const [recent, setRecent] = useState<RecentApp[]>([]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setRecent(getRecentlyViewed().slice(0, 4)), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open || apps) return;
    let active = true;
    void Promise.all([loadApps(), loadGroups()]).then(([loadedApps, loadedGroups]) => {
      if (!active) return;
      setApps(loadedApps.sort((a, b) => a.name.localeCompare(b.name, 'de')));
      setGroups(loadedGroups);
    });
    return () => { active = false; };
  }, [open, apps]);

  const query = search.trim();
  const close = () => {
    onOpenChange(false);
    setSearch('');
  };
  const go = (href: string, external?: boolean) => {
    if (external) window.open(href, '_blank', 'noopener,noreferrer');
    else router.push(href);
  };
  const searchCatalog = () => {
    if (!query) return;
    router.push(`/?q=${encodeURIComponent(query)}`);
    close();
  };

  const isDark = resolvedTheme === 'dark';
  const storeName = settings.storeName || 'JustApps';
  const logo = resolveAssetUrl(isDark ? settings.logoDarkUrl || settings.logoUrl : settings.logoUrl);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch('');
      }}
      label={`${storeName} durchsuchen`}
    >
      <Command search={search} onSearchChange={setSearch} label="Apps, Gruppen und Seiten">
        <Command.Input
          placeholder="Apps, Gruppen und Seiten suchen …"
          icon={
            logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-full object-contain" />
            ) : (
              <JustAppsLogo className="size-full" />
            )
          }
          onKeyDown={(event) => {
            if (event.key === 'Tab' && !event.shiftKey && query) {
              event.preventDefault();
              searchCatalog();
            }
          }}
        >
          <Command.InputAction keys={['⇥']} disabled={!query} onClick={searchCatalog}>
            Katalog
          </Command.InputAction>
        </Command.Input>

        <Command.List>
          <Command.Empty>Keine Treffer. Mit ⇥ den ganzen Katalog durchsuchen.</Command.Empty>

          {user && !query && (
            <Command.Group>
              <Command.Item
                value="updates"
                icon={<Tile tone="bg-rose-500"><Sparkles /></Tile>}
                subtitle={totalUnread > 0 ? `${totalUnread} ungelesen` : 'Alles gelesen'}
                kind="Updates"
                onSelect={() => go('/updates')}
              >
                Was ist neu
              </Command.Item>
            </Command.Group>
          )}

          {!query && recent.length > 0 && (
            <Command.Group heading="Zuletzt gesehen">
              {recent.map((app) => (
                <Command.Item
                  key={app.id}
                  value={`recent:${app.id}`}
                  textValue={app.name}
                  icon={<AppMark app={app} />}
                  kind="App"
                  onSelect={() => go(`/apps/${encodeURIComponent(app.id)}`)}
                >
                  {app.name}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {query && apps === null && <Command.Loading>Apps werden geladen …</Command.Loading>}

          {query && apps && apps.length > 0 && (
            <Command.Group heading="Apps">
              {apps.map((app) => (
                <Command.Item
                  key={app.id}
                  value={`app:${app.id}`}
                  textValue={app.name}
                  icon={<AppMark app={app} />}
                  subtitle={app.categories?.join(', ') || undefined}
                  keywords={[app.description, ...(app.tags ?? []), ...(app.techStack ?? [])].filter(Boolean) as string[]}
                  kind="App"
                  onSelect={() => go(`/apps/${encodeURIComponent(app.id)}`)}
                >
                  {app.name}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {query && groups.length > 0 && (
            <Command.Group heading="Gruppen">
              {groups.map((group) => (
                <Command.Item
                  key={group.id}
                  value={`group:${group.id}`}
                  textValue={group.name}
                  icon={<GroupMark group={group} />}
                  subtitle={group.description || undefined}
                  kind="Gruppe"
                  onSelect={() => go(`/gruppen/${encodeURIComponent(group.id)}`)}
                >
                  {group.name}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group heading="Seiten">
            {pages.map((page) => {
              const Icon = page.icon;
              return (
                <Command.Item
                  key={page.href}
                  value={`page:${page.href}`}
                  textValue={page.label}
                  icon={<Tile tone={TONES[page.href] ?? 'bg-neutral-500'}><Icon /></Tile>}
                  kind={page.external ? 'Neuer Tab' : 'Seite'}
                  onSelect={() => go(page.href, page.external)}
                >
                  {page.label}
                </Command.Item>
              );
            })}
          </Command.Group>

          <Command.Group heading="Aktionen">
            {user && (
              <Command.Item
                value="action:new-app"
                icon={<Tile tone="bg-emerald-500"><Plus /></Tile>}
                keywords={['erstellen', 'einreichen', 'neu']}
                kind="Aktion"
                onSelect={() => go('/meine-apps/new')}
              >
                App erstellen
              </Command.Item>
            )}
            <Command.Item
              value="action:theme"
              icon={<Tile tone="bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900">{isDark ? <Sun /> : <Moon />}</Tile>}
              keywords={['theme', 'dunkel', 'hell', 'modus', 'design']}
              kind="Aktion"
              onSelect={() => setTheme(isDark ? 'light' : 'dark')}
            >
              {isDark ? 'Helles Design' : 'Dunkles Design'}
            </Command.Item>
            {user && totalUnread > 0 && (
              <Command.Item
                value="action:updates"
                icon={<Tile tone="bg-rose-500"><Bell /></Tile>}
                kind="Aktion"
                onSelect={() => go('/updates')}
              >
                Updates lesen
              </Command.Item>
            )}
            {user ? (
              <Command.Item
                value="action:logout"
                icon={<Tile tone="bg-neutral-500"><LogOut /></Tile>}
                keywords={['logout', 'ausloggen']}
                kind="Aktion"
                onSelect={() => {
                  logout();
                  router.push('/');
                }}
              >
                Abmelden
              </Command.Item>
            ) : (
              <Command.Item
                value="action:login"
                icon={<Tile tone="bg-blue-500"><LogIn /></Tile>}
                keywords={['login', 'einloggen']}
                kind="Aktion"
                onSelect={() => go('/login')}
              >
                Anmelden
              </Command.Item>
            )}
          </Command.Group>

          {query && (
            <Command.Group heading="Katalog">
              <Command.Item
                forceMount
                value="catalog-search"
                icon={<Tile tone="bg-blue-500"><Search /></Tile>}
                kind="Suche"
                onSelect={() => go(`/?q=${encodeURIComponent(query)}`)}
              >
                Alle Apps nach „{query}“ durchsuchen
              </Command.Item>
            </Command.Group>
          )}
        </Command.List>

        <Command.Footer>
          <Command.FooterAction keys={['↵']}>Öffnen</Command.FooterAction>
          <Command.FooterDivider />
          <Command.FooterAction keys={['⇥']} disabled={!query} onClick={searchCatalog}>
            Im Katalog suchen
          </Command.FooterAction>
        </Command.Footer>
      </Command>
    </Command.Dialog>
  );
}
