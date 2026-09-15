'use client';

import { RouterProvider, Toast } from '@heroui/react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '../context/AuthContext';
import { FavoritesProvider } from '../context/FavoritesContext';
import { SettingsProvider } from '../context/SettingsContext';
import { UpdatesProvider } from '../context/UpdatesContext';
import { AIChatWidget } from './AIChatWidget';
import { BackendHealthGate } from './BackendHealthGate';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus={true}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <RouterProvider navigate={router.push}>
          <BackendHealthGate>
            <AuthProvider>
              <FavoritesProvider>
                <UpdatesProvider>
                  <SettingsProvider>
                    <Toast.Provider placement="bottom end" />
                    {children}
                    <AIChatWidget />
                  </SettingsProvider>
                </UpdatesProvider>
              </FavoritesProvider>
            </AuthProvider>
          </BackendHealthGate>
        </RouterProvider>
      </NextThemesProvider>
    </SessionProvider>
  );
}
