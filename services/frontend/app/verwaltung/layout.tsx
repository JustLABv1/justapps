'use client';

import { useAuth } from '@/context/AuthContext';
import { Link } from '@heroui/react';
import { Layers, Loader2, Settings, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const adminNavLinks = [
  { href: '/verwaltung/apps', label: 'Apps', icon: Layers },
  { href: '/verwaltung/benutzer', label: 'Benutzer', icon: Users },
  { href: '/verwaltung/einstellungen', label: 'Einstellungen', icon: Settings },
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
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Verwaltung</h1>
        <p className="text-sm text-muted">Plattformverwaltung für Admins</p>
      </div>

      <nav className="flex gap-1 border-b border-border mb-8" aria-label="Admin navigation">
        {adminNavLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors no-underline border-b-2 -mb-px ${
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

      {children}
    </div>
  );
}
