"use client";

import { resolveAssetUrl } from "@/lib/assets";
import { Avatar } from "@/components/panelui/avatar";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Input } from "@/components/panelui/input";
import { Menu } from "@/components/panelui/menu";
import { Sheet } from "@/components/panelui/sheet";
import { Tooltip } from "@/components/panelui/tooltip";
import {
  Bell,
  Bot,
  BookOpen,
  ChevronDown,
  Layers,
  Layers2,
  LayoutDashboard,
  KeyRound,
  LogOut,
  Menu as MenuIcon,
  MessageCircleQuestion,
  Package,
  PlugZap,
  Search,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useUpdates } from "../context/UpdatesContext";
import { adminNavGroups, adminNavLinks } from "../lib/admin-navigation";
import { canAccessAI } from "../lib/ai-access";
import { fetchApi } from "../lib/api";
import { JustAppsLogo } from "./JustAppsLogo";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function Navigation() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openFAQCount, setOpenFAQCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useSettings();
  const { totalUnread } = useUpdates();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!settings.faqEnabled) {
      return;
    }

    let active = true;
    const refreshOpenFAQCount = async () => {
      try {
        const response = await fetchApi('/faq?status=open&page=1&pageSize=1', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { total?: number };
        if (active) setOpenFAQCount(Math.max(0, data.total ?? 0));
      } catch {
        // The badge is supplemental; navigation remains usable if counting fails.
      }
    };

    void refreshOpenFAQCount();
    const handleFAQChanged = () => void refreshOpenFAQCount();
    window.addEventListener('faq:changed', handleFAQChanged);
    return () => {
      active = false;
      window.removeEventListener('faq:changed', handleFAQChanged);
    };
  }, [settings.faqEnabled, user?.id, pathname]);

  // Close search and clear on navigation
  useEffect(() => {
    startTransition(() => {
      setSearchOpen(false);
      setSearchQuery("");
      setMobileOpen(false);
    });
  }, [pathname]);

  // Cmd+K / Ctrl+K opens search; Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };
  const isDark = resolvedTheme === "dark";

  const storeName = settings.storeName || "JustApps";
  const logoSrc = isDark
    ? settings.logoDarkUrl || settings.logoUrl || null
    : settings.logoUrl || null;
  const resolvedLogoSrc = resolveAssetUrl(logoSrc);

  const isInVerwaltung = pathname.startsWith("/verwaltung");
  const visibleAdminNavLinks = [
    { ...adminNavLinks[0], label: 'Alle Einstellungen' },
    ...adminNavGroups.flatMap((group) => group.items).filter((item) => [
      '/verwaltung/katalog/apps',
      '/verwaltung/sicherheit/benutzer',
      '/verwaltung/sicherheit/zugriff?bereich=rollen',
    ].includes(item.href)),
  ];

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const documentationLink = {
    href: "/docs",
    label: "Dokumentation",
    icon: BookOpen,
    active: pathname === "/docs" || pathname.startsWith("/docs/"),
  };
  const documentationLinkAttributes = {
    target: "_blank" as const,
    rel: "noopener noreferrer",
  };

  const regularNavLinks = [
    { href: "/", label: "Apps", icon: Layers, active: pathname === "/" },
    {
      href: "/gruppen",
      label: "Gruppen",
      icon: Layers2,
      active: pathname === "/gruppen" || pathname.startsWith("/gruppen/"),
    },
    ...(settings.faqEnabled
      ? [{
          href: "/faq",
          label: "FAQ",
          icon: MessageCircleQuestion,
          active: pathname === "/faq",
        }]
      : []),
    documentationLink,
    ...(user
      ? [
          {
            href: "/meine-apps",
            label: "Meine Apps",
            icon: Package,
            active: pathname === "/meine-apps",
          },
        ]
      : []),
    ...(user
      ? [
          {
            href: "/updates",
            label: "Updates",
            icon: Bell,
            active: pathname === "/updates",
          },
        ]
      : []),
    ...(canAccessAI(settings, !!user)
      ? [
          {
            href: "/chat",
            label: "AI Chat",
            icon: Bot,
            active: pathname === "/chat",
          },
        ]
      : []),
  ];
  const desktopNavLinks = regularNavLinks.filter(
    (link) => link.href !== documentationLink.href,
  );
  const mobileNavLinks = user
    ? regularNavLinks.filter((link) => link.href !== documentationLink.href)
    : regularNavLinks;

  const countBadge = (href: string) => {
    if (href === "/updates" && totalUnread > 0) {
      return (
        <Badge size="sm" variant="info" aria-label={`${totalUnread} ungelesene Updates`}>
          {totalUnread > 99 ? "99+" : totalUnread}
        </Badge>
      );
    }
    if (href === "/faq" && openFAQCount > 0) {
      return (
        <Badge size="sm" variant="info" aria-label={`${openFAQCount} unbeantwortete FAQ-Fragen`}>
          {openFAQCount > 99 ? "99+" : openFAQCount}
        </Badge>
      );
    }
    return null;
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <NextLink
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md text-foreground outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          {resolvedLogoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedLogoSrc}
              alt=""
              width={24}
              height={24}
              className="rounded-sm object-contain"
              style={{ maxHeight: 24 }}
            />
          ) : (
            <JustAppsLogo className="size-6" />
          )}
          <span className="text-sm font-semibold tracking-tight">{storeName}</span>
        </NextLink>

        {/* Desktop nav */}
        <nav className="ml-4 hidden min-w-0 flex-1 items-center gap-0.5 xl:flex" aria-label="Hauptnavigation">
          {desktopNavLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Button
                key={link.href}
                size="sm"
                variant={link.active ? "secondary" : "ghost"}
                aria-current={link.active ? "page" : undefined}
                render={<NextLink href={link.href} />}
              >
                <Icon />
                {link.label}
                {countBadge(link.href)}
              </Button>
            );
          })}

          {/* Verwaltung (admins only) */}
          {user?.role === "admin" && (
            <Menu>
              <Menu.Trigger render={<Button size="sm" variant={isInVerwaltung ? "secondary" : "ghost"} />}>
                <LayoutDashboard />
                Verwaltung
                <ChevronDown />
              </Menu.Trigger>
              <Menu.Content className="min-w-52">
                {visibleAdminNavLinks.map(({ href, label, icon: Icon }) => (
                  <Menu.Item key={href} onClick={() => router.push(href)}>
                    <Icon />
                    {label}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu>
          )}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Guests keep direct access because they do not have a profile menu. */}
          {(!user || loading) && (
            <Button
              size="sm"
              variant="ghost"
              className="hidden xl:inline-flex"
              render={<a href={documentationLink.href} {...documentationLinkAttributes} />}
            >
              <BookOpen />
              {documentationLink.label}
            </Button>
          )}

          {/* Global search */}
          <div className="hidden items-center sm:flex">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} role="search">
                <Input.Group size="sm" className="w-60">
                  <Input.Addon>
                    <Search />
                  </Input.Addon>
                  <Input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => {
                      if (!searchQuery) setSearchOpen(false);
                    }}
                    placeholder="Apps suchen..."
                    aria-label="Apps suchen"
                    autoFocus
                  />
                  {searchQuery && (
                    <Input.Addon align="end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Suche leeren"
                        className="size-6"
                        onClick={() => {
                          setSearchQuery("");
                          searchInputRef.current?.focus();
                        }}
                      >
                        <X />
                      </Button>
                    </Input.Addon>
                  )}
                </Input.Group>
              </form>
            ) : (
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Suche öffnen"
                      aria-keyshortcuts="Meta+K Control+K"
                      onClick={() => {
                        setSearchOpen(true);
                        setTimeout(() => searchInputRef.current?.focus(), 50);
                      }}
                    />
                  }
                >
                  <Search />
                </Tooltip.Trigger>
                <Tooltip.Content variant="shortcut">
                  Apps suchen
                  <Tooltip.Shortcut keys={["⌘", "K"]} />
                </Tooltip.Content>
              </Tooltip>
            )}
          </div>

          {(!user || loading) && <ThemeSwitcher />}

          {loading ? (
            <Avatar size="sm" aria-hidden="true" className="animate-pulse" />
          ) : user ? (
            <Menu>
              <Menu.Trigger
                render={<Button variant="ghost" size="icon" shape="pill" aria-label="Benutzermenü" />}
              >
                <Avatar size="sm" name={user.username} />
              </Menu.Trigger>
              <Menu.Content align="end" className="w-64">
                <Menu.Group>
                  <Menu.GroupLabel>
                    <span className="block text-foreground">Angemeldet als</span>
                    <span className="block truncate font-normal">{user.email}</span>
                    {user.authType === "oidc" && (
                      <Badge size="sm" variant="info" className="mt-1.5">
                        Managed by SSO
                      </Badge>
                    )}
                  </Menu.GroupLabel>
                </Menu.Group>
                <Menu.Separator />
                <Menu.Item onClick={() => window.open(documentationLink.href, "_blank", "noopener,noreferrer")}>
                  <BookOpen />
                  Dokumentation
                </Menu.Item>
                <Menu.Item onClick={() => setTheme(isDark ? "light" : "dark")}>
                  {isDark ? <Sun /> : <Moon />}
                  {isDark ? "Heller Modus" : "Dunkler Modus"}
                </Menu.Item>
                <Menu.Separator />
                <Menu.Item onClick={() => router.push("/profil/tokens")}>
                  <KeyRound />
                  API-Tokens
                </Menu.Item>
                <Menu.Item onClick={() => router.push("/profil/mcp")}>
                  <PlugZap />
                  MCP einrichten
                </Menu.Item>
                <Menu.Separator />
                <Menu.Item variant="destructive" onClick={handleLogout}>
                  <LogOut />
                  Abmelden
                </Menu.Item>
              </Menu.Content>
            </Menu>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button size="sm" variant="ghost" render={<NextLink href="/login" />}>
                Anmelden
              </Button>
              <Button size="sm" render={<NextLink href="/register" />}>
                Registrieren
              </Button>
            </div>
          )}

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="right">
            <Sheet.Trigger render={<Button variant="ghost" size="icon-sm" className="xl:hidden" aria-label="Menü öffnen" />}>
              <MenuIcon />
            </Sheet.Trigger>
            <Sheet.Content>
              <Sheet.Header title={storeName} />
              <Sheet.Body>
                <nav aria-label="Mobile Navigation" className="flex flex-col gap-1 px-4 pb-6">
                  <form
                    role="search"
                    className="mb-3"
                    onSubmit={(e) => {
                      handleSearchSubmit(e);
                      setMobileOpen(false);
                    }}
                  >
                    <Input.Group>
                      <Input.Addon>
                        <Search />
                      </Input.Addon>
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Apps suchen..."
                        aria-label="Apps suchen"
                      />
                    </Input.Group>
                  </form>

                  {mobileNavLinks.map((link) => {
                    const Icon = link.icon;
                    const external = link.href === documentationLink.href;
                    return (
                      <Button
                        key={link.href}
                        variant={link.active ? "secondary" : "ghost"}
                        className="justify-start"
                        aria-current={link.active ? "page" : undefined}
                        onClick={() => setMobileOpen(false)}
                        render={
                          external
                            ? <a href={link.href} {...documentationLinkAttributes} />
                            : <NextLink href={link.href} />
                        }
                      >
                        <Icon />
                        {link.label}
                        <span className="ms-auto">{countBadge(link.href)}</span>
                      </Button>
                    );
                  })}

                  {user?.role === "admin" && (
                    <MobileSection title="Verwaltung">
                      {visibleAdminNavLinks.map(({ href, label, icon: Icon }) => (
                        <Button
                          key={href}
                          variant="ghost"
                          className="justify-start"
                          onClick={() => setMobileOpen(false)}
                          render={<NextLink href={href} />}
                        >
                          <Icon />
                          {label}
                        </Button>
                      ))}
                    </MobileSection>
                  )}

                  {user && (
                    <MobileSection title="Mein Konto">
                      <Button
                        variant={pathname.startsWith("/profil/tokens") ? "secondary" : "ghost"}
                        className="justify-start"
                        onClick={() => setMobileOpen(false)}
                        render={<NextLink href="/profil/tokens" />}
                      >
                        <KeyRound />
                        API-Tokens
                      </Button>
                      <Button
                        variant={pathname.startsWith("/profil/mcp") ? "secondary" : "ghost"}
                        className="justify-start"
                        onClick={() => setMobileOpen(false)}
                        render={<NextLink href="/profil/mcp" />}
                      >
                        <PlugZap />
                        MCP einrichten
                      </Button>
                    </MobileSection>
                  )}
                </nav>
              </Sheet.Body>
              {!user && (
                <Sheet.Footer>
                  <Button render={<NextLink href="/register" />} onClick={() => setMobileOpen(false)}>
                    Registrieren
                  </Button>
                  <Button variant="outline" render={<NextLink href="/login" />} onClick={() => setMobileOpen(false)}>
                    Anmelden
                  </Button>
                </Sheet.Footer>
              )}
            </Sheet.Content>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function MobileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={title} className="mt-3 flex flex-col gap-1 border-t pt-3">
      <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
