"use client";

import { Breadcrumb } from "@/components/panelui/breadcrumb";
import { Button } from "@/components/panelui/button";
import { Command } from "@/components/panelui/command";
import { NavRail, useNavRail } from "@/components/panelui/nav-rail";
import {
  adminNavGroups,
  adminNavLinks,
  isAdminDestinationActive,
} from "@/lib/admin-navigation";
import { LayoutDashboard, Search, Settings2 } from "lucide-react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/** Where the reader is: the group and the page, for the breadcrumb. */
function useLocation(pathname: string) {
  const group = adminNavGroups.find((entry) =>
    entry.items.some((item) => isAdminDestinationActive(item, pathname)),
  );
  const page = group?.items.find((item) => isAdminDestinationActive(item, pathname));
  const title = page?.label ?? adminNavLinks.find((item) => item.href === pathname)?.label;
  return { group, page, title };
}

/** Closes the drawer on a phone once a destination is chosen. */
function CloseDrawerOnNavigate() {
  const pathname = usePathname();
  const { setMobileOpen } = useNavRail();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);
  return null;
}

/** ⌘K over every settings page, plus a way to search the catalog. */
function AdminSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch("");
      }}
      label="Verwaltung durchsuchen"
    >
      <Command search={search} onSearchChange={setSearch} label="Einstellungen">
        <Command.Input placeholder="Einstellung oder Bereich suchen …" />
        <Command.List>
          <Command.Empty>Nichts gefunden. Versuchen Sie z. B. „Logo“, „Login“ oder „Rollen“.</Command.Empty>
          <Command.Group heading="Allgemein">
            <Command.Item icon={<LayoutDashboard />} kind="Seite" onSelect={() => router.push("/verwaltung")}>
              Übersicht
            </Command.Item>
          </Command.Group>
          {adminNavGroups.map((group) => (
            <Command.Group key={group.label} heading={group.label}>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.href}
                    value={item.href}
                    textValue={item.label}
                    icon={<Icon />}
                    subtitle={item.description}
                    keywords={[group.label, ...(item.keywords?.split(/\s+/) ?? [])]}
                    kind="Seite"
                    onSelect={() => router.push(item.href)}
                  >
                    {item.label}
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
          {search.trim() && (
            <Command.Group heading="Katalog">
              <Command.Item
                forceMount
                value="catalog-search"
                icon={<Search />}
                kind="Suche"
                onSelect={() => router.push(`/?q=${encodeURIComponent(search.trim())}`)}
              >
                Apps nach „{search.trim()}“ durchsuchen
              </Command.Item>
            </Command.Group>
          )}
        </Command.List>
        <Command.Footer>
          <Command.FooterAction keys={["↵"]}>Öffnen</Command.FooterAction>
        </Command.Footer>
      </Command>
    </Command.Dialog>
  );
}

/**
 * The frame of every Verwaltung page: a rail of the areas beside the page,
 * folded to icons on request and a drawer on narrow screens, with a trail
 * above the page saying where it sits.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { group, title } = useLocation(pathname);
  const [searchOpen, setSearchOpen] = useState(false);
  const editing = pathname.endsWith("/edit");

  return (
    <NavRail.Provider storageKey="verwaltung-rail" mobileBreakpoint="64rem" className="min-h-0 items-start gap-6 lg:gap-8">
      <CloseDrawerOnNavigate />
      <NavRail
        aria-label="Verwaltung"
        expandedWidth="16rem"
        className="lg:sticky lg:top-24 lg:h-[calc(100svh-8rem)]"
      >
        <NavRail.Header>
          <NavRail.Brand
            icon={<Settings2 />}
            label="Verwaltung"
            render={<NextLink href="/verwaltung" />}
          >
            Verwaltung
          </NavRail.Brand>
          <NavRail.Trigger expandLabel="Navigation ausklappen" collapseLabel="Navigation einklappen" />
        </NavRail.Header>
        <NavRail.Content>
          <NavRail.Item icon={<Search />} label="Suchen" onClick={() => setSearchOpen(true)}>
            <span className="flex flex-1 items-center justify-between gap-2">
              Suchen
              <kbd className="rounded bg-foreground/[0.06] px-1.5 font-sans text-[11px] text-muted-foreground">⌘K</kbd>
            </span>
          </NavRail.Item>
          <NavRail.Item
            icon={<LayoutDashboard />}
            active={pathname === "/verwaltung"}
            render={<NextLink href="/verwaltung" />}
          >
            Übersicht
          </NavRail.Item>
          {adminNavGroups.map((entry) => (
            <NavRail.Group key={entry.label} label={entry.label}>
              {entry.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavRail.Item
                    key={item.href}
                    icon={<Icon />}
                    active={isAdminDestinationActive(item, pathname)}
                    render={<NextLink href={item.href} />}
                  >
                    {item.label}
                  </NavRail.Item>
                );
              })}
            </NavRail.Group>
          ))}
        </NavRail.Content>
      </NavRail>

      <div className="flex min-w-0 flex-1 flex-col gap-6 pb-6">
        <div className="flex min-h-9 items-center gap-2">
          {/* On a narrow screen the rail is a drawer, and this opens it. */}
          <NavRail.Trigger
            className="lg:hidden"
            expandLabel="Verwaltungsmenü öffnen"
            collapseLabel="Verwaltungsmenü schließen"
          />
          <Breadcrumb aria-label="Brotkrümelnavigation" maxItems={4} className="min-w-0 flex-1">
            <Breadcrumb.List>
              <Breadcrumb.Item>
                {title || editing ? (
                  <Breadcrumb.Link render={<NextLink href="/verwaltung" />}>Verwaltung</Breadcrumb.Link>
                ) : (
                  <Breadcrumb.Page>Verwaltung</Breadcrumb.Page>
                )}
              </Breadcrumb.Item>
              {group && group.label !== title && (
                <Breadcrumb.Item>
                  <Breadcrumb.Link render={<NextLink href={adminNavLinks.find((link) => link.group === group.label)?.href ?? "/verwaltung"} />}>
                    {group.label}
                  </Breadcrumb.Link>
                </Breadcrumb.Item>
              )}
              {title && (
                <Breadcrumb.Item>
                  {editing ? (
                    <Breadcrumb.Link render={<NextLink href={pathname.replace(/\/[^/]+\/edit$/, "")} />}>{title}</Breadcrumb.Link>
                  ) : (
                    <Breadcrumb.Page>{title}</Breadcrumb.Page>
                  )}
                </Breadcrumb.Item>
              )}
              {editing && (
                <Breadcrumb.Item>
                  <Breadcrumb.Page>Bearbeiten</Breadcrumb.Page>
                </Breadcrumb.Item>
              )}
            </Breadcrumb.List>
          </Breadcrumb>
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSearchOpen(true)} aria-label="Verwaltung durchsuchen">
            <Search />
          </Button>
        </div>
        {children}
      </div>

      <AdminSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </NavRail.Provider>
  );
}
