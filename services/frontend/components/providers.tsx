'use client';

import { RouterProvider } from '@heroui/react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '../context/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus={true}>
      <AuthProvider>
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
      </AuthProvider>
    </SessionProvider>
  );
}
