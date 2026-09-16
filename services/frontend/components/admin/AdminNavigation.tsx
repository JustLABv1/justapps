'use client';

import { adminNavGroups, adminNavLinks, isAdminDestinationActive, searchAdminDestinations } from '@/lib/admin-navigation';
import { ArrowLeft, ChevronDown, ChevronRight, LayoutDashboard, Search, Settings2, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function AdminNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [openPath, setOpenPath] = useState<string | null>(null);
  const mobileOpen = openPath === pathname;
  const groups = searchAdminDestinations(query);
  const currentGroup = adminNavGroups.find((group) => group.items.some((item) => isAdminDestinationActive(item, pathname)));
  const current = currentGroup?.items.find((item) => isAdminDestinationActive(item, pathname));
  const title = current?.label ?? adminNavLinks.find((item) => item.href === pathname)?.label ?? 'Einstellungen';
  const close = () => { setOpenPath(null); setQuery(''); };
  const linkStyle = 'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent';

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[256px_minmax(0,1fr)] lg:gap-8">
      <aside className="lg:sticky lg:top-20">
        <div className="rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 p-4 lg:p-5">
            <Link href="/verwaltung" onClick={close} className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><Settings2 className="size-5" aria-hidden="true" /></span>
              <span><span className="block text-sm font-semibold">Verwaltung</span><span className="block text-xs text-muted">Einstellungen & Übersicht</span></span>
            </Link>
            <button type="button" aria-label={mobileOpen ? 'Verwaltungsmenü schließen' : 'Verwaltungsmenü öffnen'} aria-expanded={mobileOpen} aria-controls="admin-navigation" onClick={() => setOpenPath(mobileOpen ? null : pathname)} className="flex size-10 items-center justify-center rounded-lg hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent lg:hidden">
              {mobileOpen ? <X className="size-5" /> : <ChevronDown className="size-5" />}
            </button>
          </div>
          <div id="admin-navigation" className={`${mobileOpen ? 'block' : 'hidden'} lg:block`}>
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-secondary/50 px-3 focus-within:ring-2 focus-within:ring-accent">
                <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <input aria-label="Einstellungen suchen" placeholder="Einstellungen suchen …" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
                  if (event.key === 'Escape') setQuery('');
                }} className="h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted" />
                {query && <button type="button" aria-label="Suche zurücksetzen" onClick={() => setQuery('')} className="rounded p-1 focus-visible:ring-2 focus-visible:ring-accent"><X className="size-4" /></button>}
              </div>
            </div>
            <nav aria-label="Navigation der Verwaltung" className="max-h-[60dvh] space-y-5 overflow-y-auto px-3 pb-4 lg:max-h-[calc(100dvh-260px)]">
              {!query.trim() && <Link href="/verwaltung" onClick={close} aria-current={pathname === '/verwaltung' ? 'page' : undefined} className={`${linkStyle} ${pathname === '/verwaltung' ? 'bg-accent/10 font-semibold text-accent' : 'text-muted hover:bg-surface-secondary hover:text-foreground'}`}><LayoutDashboard className="size-4 shrink-0" />Übersicht</Link>}
              {groups.map((group) => <div key={group.label}>
                <h2 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{group.label}</h2>
                <ul className="space-y-0.5">{group.items.map((item) => {
                  const active = isAdminDestinationActive(item, pathname);
                  const Icon = item.icon;
                  return <li key={item.href}><Link href={item.href} onClick={close} aria-current={active ? 'page' : undefined} title={item.description} className={`${linkStyle} ${active ? 'bg-accent/10 font-semibold text-accent' : 'text-muted hover:bg-surface-secondary hover:text-foreground'}`}><Icon className="size-4 shrink-0" aria-hidden="true" /><span>{item.label}</span></Link></li>;
                })}</ul>
              </div>)}
              {groups.length === 0 && <p role="status" className="px-3 py-4 text-sm text-muted">Keine Einstellung gefunden. Versuchen Sie z. B. „Logo“, „Login“ oder „Rollen“.</p>}
            </nav>
            <div className="border-t border-border p-3"><Link href="/" className={`${linkStyle} text-muted hover:bg-surface-secondary hover:text-foreground`}><ArrowLeft className="size-4" />Zur Plattform</Link></div>
          </div>
        </div>
      </aside>
      <div className="min-w-0 pb-6">
        <nav aria-label="Brotkrümelnavigation" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Link href="/verwaltung" className="rounded hover:text-accent focus-visible:ring-2 focus-visible:ring-accent">Verwaltung</Link>
          {currentGroup && <><ChevronRight className="size-3" aria-hidden="true" /><span>{currentGroup.label}</span></>}
          <ChevronRight className="size-3" aria-hidden="true" /><span aria-current="page" className="font-medium text-foreground">{title}</span>
          {pathname.endsWith('/edit') && <><ChevronRight className="size-3" aria-hidden="true" /><span>Bearbeiten</span></>}
        </nav>
        {children}
      </div>
    </div>
  );
}
