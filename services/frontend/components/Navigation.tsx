'use client';

import { resolveAssetUrl } from "@/lib/assets";
import {
    Avatar,
    Button,
    Dropdown,
    Label,
    Link,
    Separator
} from "@heroui/react";
import { Bot, ChevronDown, Menu, Search, X } from "lucide-react";
import { useTheme } from "next-themes";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { adminNavLinks } from "../lib/admin-navigation";
import { fetchApi } from "../lib/api";
import { JustAppsLogo } from "./JustAppsLogo";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function Navigation() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasGitLabProviders, setHasGitLabProviders] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useSettings();
  const { resolvedTheme } = useTheme();

  // Close search and clear on navigation
  useEffect(() => {
    startTransition(() => {
      setSearchOpen(false);
      setSearchQuery('');
    });
  }, [pathname]);

  // Cmd+K / Ctrl+K opens search; Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      return;
    }

    let active = true;

    fetchApi('/settings/repository-providers/available', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          return [];
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
      })
      .then((providers) => {
        if (active) {
          setHasGitLabProviders(providers.length > 0);
        }
      })
      .catch(() => {
        if (active) {
          setHasGitLabProviders(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.role]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };
  const isDark = resolvedTheme === 'dark';

  const storeName = settings.storeName || 'JustApps';
  const logoSrc = isDark
    ? (settings.logoDarkUrl || settings.logoUrl || null)
    : (settings.logoUrl || null);
  const resolvedLogoSrc = resolveAssetUrl(logoSrc);

  const isInVerwaltung = pathname.startsWith('/verwaltung');
  const visibleAdminNavLinks = adminNavLinks.filter((link) => link.href !== '/verwaltung/repository-sync' || hasGitLabProviders);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const regularNavLinks = [
    { href: "/", label: "Apps", active: pathname === '/' },
    { href: "/gruppen", label: "Gruppen", active: pathname === '/gruppen' || pathname.startsWith('/gruppen/') },
    ...(user ? [{ href: "/meine-apps", label: "Meine Apps", active: pathname === '/meine-apps' }] : []),
    ...(user || settings.allowAnonymousAI ? [{ href: "/chat", label: "AI Chat", active: pathname === '/chat' }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 no-underline text-foreground hover:opacity-80 transition-opacity shrink-0"
        >
          <div className="flex flex-cols items-center gap-2 leading-tight">
            {resolvedLogoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolvedLogoSrc} alt={`${storeName} Logo`} width={24} height={24} className="rounded-sm object-contain" style={{ maxHeight: 24 }} />
            ) : (
              <JustAppsLogo className="w-6 h-6" />
            )}
            <span className="text-[9px] font-bold tracking-[0.2em]">{storeName}</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-8">
          {regularNavLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors no-underline ${
                link.active
                  ? 'text-accent bg-accent/8'
                  : 'text-muted hover:text-foreground hover:bg-default'
              }`}
            >
              {link.href === '/chat' && <Bot className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />}
              {link.label}
            </Link>
          ))}

          {/* Verwaltung dropdown (admin only) */}
          {user?.role === 'admin' && (
            <Dropdown>
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors h-auto ${
                  isInVerwaltung
                    ? 'text-accent bg-accent/8'
                    : 'text-muted hover:text-foreground hover:bg-default'
                }`}
              >
                Verwaltung
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu
                  onAction={(key) => router.push(key as string)}
                  className="min-w-[180px]"
                >
                  {visibleAdminNavLinks.map(({ href, label, icon: Icon }) => (
                    <Dropdown.Item key={href} id={href} textValue={label}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted" />
                        <span>{label}</span>
                      </div>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Global search */}
          <div className="hidden sm:flex items-center">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="flex items-center">
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
                  placeholder="Apps suchen..."
                  className="w-52 h-8 rounded-lg border border-border bg-surface-secondary px-3 text-sm outline-none focus:border-accent transition-colors placeholder:text-muted/60"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                    className="ml-1 p-1 text-muted hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>
            ) : (
              <button
                onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm text-muted hover:text-foreground hover:bg-default transition-colors"
                aria-label="Suche öffnen (Cmd+K)"
              >
                <Search className="w-4 h-4" />
                <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-default border border-border text-[10px] font-mono text-muted/70">
                  ⌘K
                </kbd>
              </button>
            )}
          </div>

          <ThemeSwitcher />

          {loading ? (
            <div className="h-8 w-8 rounded-full bg-default/50 animate-pulse" />
          ) : user ? (
            <Dropdown>
              <Button variant="secondary" className="p-0 min-w-0 bg-transparent hover:bg-transparent shadow-none" aria-label="Benutzermenü">
                <Avatar size="sm">
                  <Avatar.Fallback>{user.username.slice(0, 2).toUpperCase()}</Avatar.Fallback>
                </Avatar>
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu onAction={(key) => key === 'logout' && handleLogout()}>
                  <Dropdown.Item id="profile" textValue={`Angemeldet als ${user.email}`}>
                    <div className="flex flex-col gap-0.5">
                      <Label className="font-semibold text-sm">Angemeldet als</Label>
                      <div className="text-xs text-muted text-balance break-all max-w-[180px]">{user.email}</div>
                      {user.authType === 'oidc' && (
                        <div className="mt-1">
                          <span className="text-[10px] bg-sky-500/10 text-sky-500 px-1.5 py-0.5 rounded border border-sky-500/20 whitespace-nowrap">
                            Managed by SSO
                          </span>
                        </div>
                      )}
                    </div>
                  </Dropdown.Item>
                  <Separator />
                  <Dropdown.Item id="logout" variant="danger" textValue="Abmelden">
                    <Label>Abmelden</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Button onPress={() => router.push('/login')} variant="secondary" size="sm">
                Anmelden
              </Button>
              <Button onPress={() => router.push('/register')} size="sm">
                Registrieren
              </Button>
            </div>
          )}

          {/* Mobile menu toggle */}
          <Button
            isIconOnly
            variant="secondary"
            size="sm"
            className="md:hidden"
            onPress={() => setMobileOpen(!mobileOpen)}
            aria-label="Menü öffnen"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface p-4 space-y-2">
          {/* Mobile search */}
          <form onSubmit={(e) => { handleSearchSubmit(e); setMobileOpen(false); }} className="relative mb-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Apps suchen..."
              className="w-full h-9 rounded-lg border border-border bg-surface-secondary pl-9 pr-3 text-sm outline-none focus:border-accent transition-colors placeholder:text-muted/60"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          </form>

          {regularNavLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-default no-underline"
              onPress={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          {/* Admin links inline in mobile menu */}
          {user?.role === 'admin' && (
            <div className="pt-2 border-t border-separator">
              <p className="px-3 py-1 text-[10px] font-bold text-muted uppercase tracking-widest">Verwaltung</p>
              {visibleAdminNavLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-default no-underline"
                  onPress={() => setMobileOpen(false)}
                >
                  <Icon className="w-4 h-4 text-muted" />
                  {label}
                </Link>
              ))}
            </div>
          )}

          {!user && (
            <div className="flex gap-2 pt-2 border-t border-separator mt-2">
              <Button onPress={() => { router.push('/login'); setMobileOpen(false); }} variant="secondary" size="sm" className="flex-1">
                Anmelden
              </Button>
              <Button onPress={() => { router.push('/register'); setMobileOpen(false); }} size="sm" className="flex-1">
                Registrieren
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
