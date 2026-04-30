'use client';

import { useAuth } from '@/context/AuthContext';
import { adminNavLinks, isAdminNavLinkActive } from '@/lib/admin-navigation';
import { Link, Surface } from '@heroui/react';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

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
        <p className="text-sm text-muted">Plattformverwaltung nach Domänen statt Einzelfunktionen.</p>
      </div>

      <Surface className="mb-10 border border-border/60 bg-surface/80 p-2 shadow-sm">
        <nav className="flex flex-wrap gap-2" aria-label="Navigation der Verwaltung">
          {adminNavLinks.map((link) => {
            const { href, label, icon: Icon } = link;
            const isActive = isAdminNavLinkActive(link, pathname);

          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-[140px] flex-1 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors no-underline sm:flex-none ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:bg-surface-secondary hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
          })}
        </nav>
      </Surface>

      <div className="pb-6">
        {children}
      </div>
    </div>
  );
}
