'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FlagBar } from '@/components/FlagBar';
import { Footer } from '@/components/Footer';
import { Navigation } from '@/components/Navigation';
import { PageTransition } from '@/components/PageTransition';
import { TopBanner } from '@/components/TopBanner';
import { usePathname } from 'next/navigation';

function isChatRoute(pathname: string) {
  return pathname === '/chat' || pathname.startsWith('/chat/');
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chatRoute = isChatRoute(pathname);

  return (
    <div className={chatRoute ? 'relative flex h-[100dvh] flex-col overflow-hidden' : 'relative flex min-h-screen flex-col'}>
      <FlagBar />
      <Navigation />
      {!chatRoute && <TopBanner />}
      <main
        className={
          chatRoute
            ? 'flex min-h-0 flex-1 overflow-hidden'
            : 'flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'
        }
      >
        <ErrorBoundary>{chatRoute ? children : <PageTransition>{children}</PageTransition>}</ErrorBoundary>
      </main>
      {!chatRoute && <Footer />}
    </div>
  );
}