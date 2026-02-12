'use client';

import { RouterProvider } from '@heroui/react';
import { SessionProvider } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '../context/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <SessionProvider>
      <AuthProvider>
        <RouterProvider navigate={router.push}>
          {children}
        </RouterProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
