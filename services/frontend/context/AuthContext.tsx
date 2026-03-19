'use client';

import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  authType?: string;
  canSubmitApps?: boolean;
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
  const [fetchedUser, setFetchedUser] = useState<User | null>(null);

  // Derive the active user and token immediately from session if available
  const s = session as {
    user?: { id?: string; name?: string; email?: string; role?: string; authType?: string; canSubmitApps?: boolean };
    idToken?: string;
    accessToken?: string;
    error?: string;
  } | null;

  useEffect(() => {
    if (s?.error === 'RefreshAccessTokenError' || s?.error === 'SessionExpired') {
      console.warn('Session expired or refresh failed, logging out...');
      logout();
    }
    if (s?.error === 'ExchangeFailed') {
      // Backend exchange failed on login — sign out of next-auth and prompt re-auth
      console.warn('Backend token exchange failed during OIDC login, re-authenticating...');
      nextAuthSignOut({ callbackUrl: '/login' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.error]);

  const oidcUser = React.useMemo<User | null>(() => {
    if (status !== 'authenticated' || !s?.user) return null;
    
    return {
      id: s.user.id || s.user.email || 'oidc',
      username: s.user.name || s.user.email || 'OIDC User',
      email: s.user.email || '',
      role: s.user.role || 'user',
      authType: s.user.authType,
      canSubmitApps: s.user.canSubmitApps,
    };
  }, [status, s?.user?.id, s?.user?.name, s?.user?.email, s?.user?.role, s?.user?.authType, s?.user?.canSubmitApps]);

  const user = React.useMemo(() => {
    // If we have fetched detailed user data from backend, use it as source of truth
    if (fetchedUser) return fetchedUser;

    // If we're authenticated via OIDC but haven't fetched details yet, fallback to session data
    if (status === 'authenticated' && oidcUser) return oidcUser;
    
    // If not authenticated (or OIDC user not yet resolved), fallback to local session state
    if (status === 'unauthenticated') return localUser;

    return null;
  }, [fetchedUser, oidcUser, status, localUser]);

  const token = React.useMemo(() => {
    return (status === 'authenticated') ? (s?.idToken || s?.accessToken || null) : (status === 'unauthenticated' ? localToken : null);
  }, [status, s?.idToken, s?.accessToken, localToken]);

  // Sync token to localStorage when OIDC session changes manually to avoid race conditions
  useEffect(() => {
    if (status === 'authenticated' && s && oidcUser) {
      if (typeof window !== 'undefined') {
        const authToken = s.idToken || s.accessToken;
        if (authToken) {
          localStorage.setItem('token', authToken);
          localStorage.setItem('user', JSON.stringify(oidcUser));
        }
      }
    }
  }, [status, s?.idToken, s?.accessToken, oidcUser]);

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

  // Fetch user data on mount or when token changes (or auth type changes)
  useEffect(() => {
    const fetchUserData = async () => {
      // Don't fetch during loading or if no token
      if (status === 'loading' || !token) return;

      try {
        const { fetchApi } = await import('@/lib/api');
        // Ensure trailing slash to match backend router
        const response = await fetchApi('/user/');
        
        if (response.status === 401) {
          console.warn('Backend rejected token, logging out...');
          logout();
        } else if (response.ok) {
           const data = await response.json();
           if (data.user) {
             setFetchedUser(data.user);
           }
        }
      } catch (error) {
        console.error('Failed to validate token and fetch user:', error);
      }
    };

    fetchUserData();
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

  // Improved loading state that waits for user hydration
  const isLoading = status === 'loading' || (status === 'authenticated' && !user);

  return (
    <AuthContext.Provider value={{ user, token, loading: isLoading, login, logout, oidcLogin }}>
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
