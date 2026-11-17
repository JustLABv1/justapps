'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FlagBar } from '@/components/FlagBar';
import { Footer } from '@/components/Footer';
import { Navigation } from '@/components/Navigation';
import { PageTransition } from '@/components/PageTransition';
import { TopBanner } from '@/components/TopBanner';
import { usePathname } from 'next/navigation';

function isCreationRoute(pathname: string) {
  return pathname === '/meine-apps/new'
    || pathname === '/verwaltung/apps/new'
    || pathname === '/verwaltung/katalog/apps/new';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const creationRoute = isCreationRoute(pathname);

  return (
    <div className="relative flex min-h-screen flex-col">
      <FlagBar />
      <Navigation />
      {!creationRoute && <TopBanner />}
      <main
        className={
          creationRoute
            ? 'flex-grow w-full'
            : 'flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'
        }
      >
        <ErrorBoundary><PageTransition>{children}</PageTransition></ErrorBoundary>
      </main>
      {!creationRoute && <Footer />}
    </div>
  );
}
