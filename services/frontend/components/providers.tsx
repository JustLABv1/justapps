'use client';

import { Toast } from '@/components/panelui/toast';
import { toaster } from '@/lib/toast';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { AuthProvider } from '../context/AuthContext';
import { FavoritesProvider } from '../context/FavoritesContext';
import { SettingsProvider } from '../context/SettingsContext';
import { UpdatesProvider } from '../context/UpdatesContext';
import { BackendHealthGate } from './BackendHealthGate';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus={true}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <Toast.Provider toastManager={toaster} position="bottom-right">
          <BackendHealthGate>
            <AuthProvider>
              <FavoritesProvider>
                <UpdatesProvider>
                  <SettingsProvider>
                    {children}
                  </SettingsProvider>
                </UpdatesProvider>
              </FavoritesProvider>
            </AuthProvider>
          </BackendHealthGate>
        </Toast.Provider>
      </NextThemesProvider>
    </SessionProvider>
  );
}
