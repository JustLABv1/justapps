'use client';

import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
  oidcLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [localToken, setLocalToken] = useState<string | null>(null);

  // Derive the active user and token immediately from session if available
  const s = session as {
    user?: { id?: string; name?: string; email?: string; role?: string };
    idToken?: string;
    accessToken?: string;
    error?: string;
  } | null;

  useEffect(() => {
    if (s?.error === 'RefreshAccessTokenError') {
      console.warn('OIDC Refresh token failed, logging out...');
      logout();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.error]);

  const oidcUser: User | null = (status === 'authenticated' && s?.user) ? {
    id: s.user.id || s.user.email || 'oidc',
    username: s.user.name || s.user.email || 'OIDC User',
    email: s.user.email || '',
    role: s.user.role || 'user',
  } : null;

  const user = oidcUser || (status === 'unauthenticated' ? localUser : null);
  const token = (status === 'authenticated') ? (s?.idToken || s?.accessToken) : (status === 'unauthenticated' ? localToken : null);

  // Sync token to localStorage when OIDC session changes
  useEffect(() => {
    if (status === 'authenticated' && s) {
      // Prefer idToken for OIDC as the backend verifier expects it
      const authToken = s.idToken || s.accessToken;
      if (authToken && typeof window !== 'undefined') {
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(oidcUser));
      }
    } else if (status === 'unauthenticated' && typeof window !== 'undefined') {
      // Only clear if we were previously using OIDC (this part is tricky, let's just clear if unauth)
      // Actually, we should only clear session storage if we were logged in via OIDC.
    }
  }, [status, s, oidcUser]);

  // Load local user on mount (only if status is unauthenticated)
  useEffect(() => {
    if (typeof window !== 'undefined' && status === 'unauthenticated') {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');
      if (storedUser && storedToken) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setLocalUser(parsedUser);
          setLocalToken(storedToken);
        } catch {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      }
    }
  }, [status]);

  // Check token validity on mount or when token changes
  useEffect(() => {
    const checkTokenValidity = async () => {
      // Don't check during loading or if no token
      if (status === 'loading' || !token) return;

      try {
        const { fetchApi } = await import('@/lib/api');
        const response = await fetchApi('/token/validate');
        if (response.status === 401) {
          console.warn('Backend rejected token, logging out...');
          logout();
        }
      } catch (error) {
        console.error('Failed to validate token:', error);
      }
    };

    checkTokenValidity();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  const login = (token: string, userData: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
    }
    setLocalUser(userData);
    setLocalToken(token);
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setLocalUser(null);
    setLocalToken(null);
    if (status === 'authenticated') {
      // If we have an idToken, we can try a Federated logout from Keycloak
      // Note: This matches the issuer in process.env.AUTH_KEYCLOAK_ISSUER
      // but we need it on the client side. If not available, we just sign out from next-auth.
      nextAuthSignOut({ callbackUrl: '/login' });
    }
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:unauthorized', handleUnauthorized);
      return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const oidcLogin = () => {
    nextAuthSignIn('keycloak', { callbackUrl: '/' });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading: status === 'loading', login, logout, oidcLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
