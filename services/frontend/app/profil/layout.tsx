'use client';

import { useAuth } from '@/context/AuthContext';
import { Link, Surface } from '@heroui/react';
import { Bot, KeyRound, Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

const profileLinks = [
  { href: '/profil/tokens', label: 'API-Tokens', icon: KeyRound },
  { href: '/profil/mcp', label: 'MCP einrichten', icon: Bot },
];

export default function ProfilLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Surface className="border border-border/60 bg-surface/80 p-2 shadow-sm">
        <nav className="flex flex-wrap gap-2" aria-label="Mein Konto">
          {profileLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold no-underline transition-colors ${
                  active
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:bg-surface-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </Surface>

      <div className="pb-6">{children}</div>
    </div>
  );
}
