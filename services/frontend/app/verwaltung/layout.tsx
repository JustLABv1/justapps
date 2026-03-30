'use client';

import { useAuth } from '@/context/AuthContext';
import { Link } from '@heroui/react';
import { Activity, KeyRound, Layers, Layers2, LayoutDashboard, Loader2, Settings, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const adminNavLinks = [
  { href: '/verwaltung', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/verwaltung/apps', label: 'Apps', icon: Layers, exact: false },
  { href: '/verwaltung/gruppen', label: 'Gruppen', icon: Layers2, exact: false },
  { href: '/verwaltung/benutzer', label: 'Benutzer', icon: Users, exact: false },
  { href: '/verwaltung/audit', label: 'Audit', icon: Activity, exact: false },
  { href: '/verwaltung/tokens', label: 'Tokens', icon: KeyRound, exact: false },
  { href: '/verwaltung/einstellungen', label: 'Einstellungen', icon: Settings, exact: false },
];

export default function VerwaltungLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        const timer = setTimeout(() => {
          if (!user) router.push('/');
        }, 500);
        return () => clearTimeout(timer);
      } else if (user.role !== 'admin') {
        router.push('/');
      }
    }
  }, [user, loading, router]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="relative left-1/2 w-screen max-w-[1720px] -translate-x-1/2 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <div className="mb-8 flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Verwaltung</h1>
        <p className="text-sm text-muted">Plattformverwaltung für Administratoren</p>
      </div>

      <nav className="mb-10 flex gap-1 overflow-x-auto border-b border-border pb-1" aria-label="Navigation der Verwaltung">
        {adminNavLinks.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors no-underline ${
                isActive
                  ? 'text-accent border-accent'
                  : 'text-muted border-transparent hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="pb-6">
        {children}
      </div>
    </div>
  );
}
