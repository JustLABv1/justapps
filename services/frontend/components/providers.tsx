'use client';

import { RouterProvider } from '@heroui/react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '../context/AuthContext';
import { SettingsProvider } from '../context/SettingsContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus={true}>
      <AuthProvider>
        <SettingsProvider>
          <NextThemesProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <RouterProvider navigate={router.push}>
              {children}
            </RouterProvider>
          </NextThemesProvider>
        </SettingsProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
