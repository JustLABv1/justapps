'use client';

import { Spinner } from '@/components/panelui/spinner';
import { Tabs } from '@/components/panelui/tabs';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { useUpdates } from '@/context/UpdatesContext';
import { useAuth } from '@/context/AuthContext';
import { Bell, Bot, KeyRound, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

const profileLinks = [
  { href: '/profil', label: 'Übersicht', icon: UserRound },
  { href: '/profil/benachrichtigungen', label: 'Benachrichtigungen', icon: Bell },
  { href: '/profil/tokens', label: 'API-Tokens', icon: KeyRound },
  { href: '/profil/mcp', label: 'MCP einrichten', icon: Bot },
];

export default function ProfilLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { totalUnread } = useUpdates();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, user]);

  // Only the first load waits here; a later refresh keeps the page, and what was typed in it.
  if (!user) {
    return loading ? (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    ) : null;
  }

  const active = pathname === '/profil'
    ? '/profil'
    : profileLinks.find(({ href }) => href !== '/profil' && pathname.startsWith(href))?.href;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <ProfileHeader user={user} />
        <Tabs variant="underline" value={active} onValueChange={(href) => router.push(String(href))}>
          <Tabs.List aria-label="Mein Profil" className="max-w-full overflow-x-auto">
            {profileLinks.map(({ href, label, icon: Icon }) => (
              <Tabs.Trigger key={href} value={href}>
                <Icon />
                {label}
                {href === '/profil/benachrichtigungen' && totalUnread > 0 && (
                  <Tabs.Badge>{totalUnread > 99 ? '99+' : totalUnread}</Tabs.Badge>
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
      </div>
      <div className="pb-6">{children}</div>
    </div>
  );
}
