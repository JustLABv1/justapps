'use client';

import { useAuth } from '@/context/AuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { Spinner } from '@/components/panelui/spinner';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function VerwaltungLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isCreationRoute = pathname === '/verwaltung/apps/new' || pathname === '/verwaltung/katalog/apps/new';

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
      <Spinner />
    </div>
  );

  if (!user || user.role !== 'admin') return null;

  if (isCreationRoute) {
    return <>{children}</>;
  }

  return (
    <AdminShell>{children}</AdminShell>
  );
}
