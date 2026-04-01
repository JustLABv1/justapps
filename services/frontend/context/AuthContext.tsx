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
  profileReady: boolean;
  profileError: string | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  oidcLogin: () => void;
  refreshUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [localToken, setLocalToken] = useState<string | null>(null);
  const [fetchedUser, setFetchedUser] = useState<User | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

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
  }, [status, s?.user]);

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

  const refreshUser = async () => {
    if (status !== 'authenticated') {
      const hasLocalSession = !!localToken && !!localUser;
      setFetchedUser(null);
      setProfileReady(hasLocalSession);
      setProfileError(null);
      return hasLocalSession;
    }

    if (!token) {
      setFetchedUser(null);
      setProfileReady(false);
      setProfileError('Backend-Sitzung fehlt. Bitte erneut anmelden.');
      return false;
    }

    setProfileReady(false);
    setProfileError(null);

    try {
      const { fetchApi } = await import('@/lib/api');
      
      // Explicitly pass the current token in headers to avoid race conditions 
      // where localStorage hasn't been updated yet by the other useEffect
      const response = await fetchApi('/user/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        console.warn('Backend rejected token, logging out...');
        logout();
        return false;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = (errorBody as { message?: string }).message || 'Benutzerprofil konnte nicht geladen werden.';
        setFetchedUser(null);
        setProfileError(message);
        return false;
      }

      const data = await response.json();
      if (!data.user) {
        setFetchedUser(null);
        setProfileError('Benutzerprofil konnte nicht geladen werden.');
        return false;
      }

      setFetchedUser(data.user);
      setProfileReady(true);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Benutzerprofil konnte nicht geladen werden.';
      console.error('Failed to validate token and fetch user:', error);
      setFetchedUser(null);
      setProfileError(message);
      return false;
    }
  };

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
          setProfileReady(true);
          setProfileError(null);
        } catch {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          setLocalUser(null);
          setLocalToken(null);
          setProfileReady(false);
          setProfileError(null);
        }
      } else {
        setLocalUser(null);
        setLocalToken(null);
        setProfileReady(false);
        setProfileError(null);
      }
    }
  }, [status]);

  // Fetch user data on mount or when the backend token changes.
  useEffect(() => {
    if (status === 'loading') return;

    if (status !== 'authenticated') {
      setFetchedUser(null);
      setProfileReady(!!localToken && !!localUser);
      setProfileError(null);
      return;
    }

    setFetchedUser(null);
    setProfileReady(false);
    setProfileError(null);

    void refreshUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status, localToken, localUser]);

  const login = (token: string, userData: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
    }
    setLocalUser(userData);
    setLocalToken(token);
    setProfileReady(true);
    setProfileError(null);
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setLocalUser(null);
    setLocalToken(null);
    setFetchedUser(null);
    setProfileReady(false);
    setProfileError(null);
    if (status === 'authenticated') {
      // If we have an idToken, we can try a federated logout from the configured OIDC provider.
      // The provider is still addressed internally through the legacy `keycloak` id for compatibility.
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

  // Keep privileged UI in loading state until the backend confirms the authenticated user.
  const isLoading = status === 'loading' || (status === 'authenticated' && !profileReady && !profileError);

  return (
    <AuthContext.Provider value={{ user, token, loading: isLoading, profileReady, profileError, login, logout, oidcLogin, refreshUser }}>
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
