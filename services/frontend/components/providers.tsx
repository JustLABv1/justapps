'use client';

import { RouterProvider } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '../context/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <AuthProvider>
      <RouterProvider navigate={router.push}>
        {children}
      </RouterProvider>
    </AuthProvider>
  );
}
