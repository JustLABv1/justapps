'use client';

import { getApiUrl } from '@/lib/apiUrl';
import { toast } from '@heroui/react';
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

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
  oidcLogin: (providerKey?: string, callbackUrl?: string) => void;
  refreshUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_EVENT = 'auth:storage-change';

interface LocalAuthSession {
  user: User | null;
  token: string | null;
}

const emptyLocalAuthSession: LocalAuthSession = {
  user: null,
  token: null,
};

let cachedLocalAuthToken: string | null = null;
let cachedLocalAuthUserRaw: string | null = null;
let cachedLocalAuthSession: LocalAuthSession = emptyLocalAuthSession;

function readStoredAuthSession(): LocalAuthSession {
  if (typeof window === 'undefined') {
    return emptyLocalAuthSession;
  }

  const token = localStorage.getItem('token');
  const userRaw = localStorage.getItem('user');

  if (token === cachedLocalAuthToken && userRaw === cachedLocalAuthUserRaw) {
    return cachedLocalAuthSession;
  }

  if (!token || !userRaw) {
    cachedLocalAuthToken = token;
    cachedLocalAuthUserRaw = userRaw;
    cachedLocalAuthSession = emptyLocalAuthSession;
    return cachedLocalAuthSession;
  }

  try {
    const user = JSON.parse(userRaw) as User;
    cachedLocalAuthToken = token;
    cachedLocalAuthUserRaw = userRaw;
    cachedLocalAuthSession = { user, token };
    return cachedLocalAuthSession;
  } catch {
    cachedLocalAuthToken = token;
    cachedLocalAuthUserRaw = userRaw;
    cachedLocalAuthSession = emptyLocalAuthSession;
    return cachedLocalAuthSession;
  }
}

function notifyStoredAuthSessionChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

function writeStoredAuthSession(token: string, user: User) {
  if (typeof window === 'undefined') {
    return;
  }

  const userRaw = JSON.stringify(user);
  if (localStorage.getItem('token') === token && localStorage.getItem('user') === userRaw) {
    return;
  }

  localStorage.setItem('token', token);
  localStorage.setItem('user', userRaw);
  cachedLocalAuthToken = token;
  cachedLocalAuthUserRaw = userRaw;
  cachedLocalAuthSession = { user, token };
  notifyStoredAuthSessionChange();
}

function clearStoredAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }

  const hadStoredSession = localStorage.getItem('token') !== null || localStorage.getItem('user') !== null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  cachedLocalAuthToken = null;
  cachedLocalAuthUserRaw = null;
  cachedLocalAuthSession = emptyLocalAuthSession;

  if (hadStoredSession) {
    notifyStoredAuthSessionChange();
  }
}

function subscribeToStoredAuthSession(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === 'token' || event.key === 'user') {
      onStoreChange();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(AUTH_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(AUTH_STORAGE_EVENT, onStoreChange);
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const localSession = useSyncExternalStore(
    subscribeToStoredAuthSession,
    readStoredAuthSession,
    () => emptyLocalAuthSession,
  );
  const [fetchedUser, setFetchedUser] = useState<User | null>(null);
  const [fetchedUserToken, setFetchedUserToken] = useState<string | null>(null);
  const [authenticatedProfileReady, setAuthenticatedProfileReady] = useState(false);
  const [authenticatedProfileError, setAuthenticatedProfileError] = useState<string | null>(null);
  const hasShownSessionExpiredNoticeRef = useRef(false);
  const delayedLogoutTimeoutRef = useRef<number | null>(null);

  // Derive the active user and token immediately from session if available
  const s = session as {
    user?: { id?: string; name?: string; email?: string; role?: string; authType?: string; canSubmitApps?: boolean };
    idToken?: string;
    accessToken?: string;
    error?: string;
  } | null;
  const oidcToken = status === 'authenticated' ? (s?.idToken || s?.accessToken || null) : null;

  const oidcUser = status !== 'authenticated' || !s?.user
    ? null
    : {
        id: s.user.id || s.user.email || 'oidc',
        username: s.user.name || s.user.email || 'OIDC User',
        email: s.user.email || '',
        role: s.user.role || 'user',
        authType: s.user.authType,
        canSubmitApps: s.user.canSubmitApps,
      };
  const oidcUserKey = oidcUser ? JSON.stringify(oidcUser) : null;

  const logout = useCallback(() => {
    if (delayedLogoutTimeoutRef.current !== null) {
      window.clearTimeout(delayedLogoutTimeoutRef.current);
      delayedLogoutTimeoutRef.current = null;
    }
    hasShownSessionExpiredNoticeRef.current = false;
    clearStoredAuthSession();
    setFetchedUser(null);
    setFetchedUserToken(null);
    setAuthenticatedProfileReady(false);
    setAuthenticatedProfileError(null);
    if (status === 'authenticated') {
      nextAuthSignOut({ callbackUrl: '/login' });
    }
  }, [status]);

  const notifySessionExpiredThenLogout = useCallback(() => {
    if (hasShownSessionExpiredNoticeRef.current) {
      return;
    }
    hasShownSessionExpiredNoticeRef.current = true;
    toast.warning('Sitzung abgelaufen. Sie werden zur Anmeldung weitergeleitet.');
    delayedLogoutTimeoutRef.current = window.setTimeout(() => {
      delayedLogoutTimeoutRef.current = null;
      logout();
    }, 1500);
  }, [logout]);

  useEffect(() => {
    if (!s?.error) return;

    const timeoutId = window.setTimeout(() => {
      if (s.error === 'RefreshAccessTokenError' || s.error === 'SessionExpired') {
        console.warn('Session expired or refresh failed, scheduling logout...');
        notifySessionExpiredThenLogout();
      }

      if (s.error === 'ExchangeFailed') {
        // Backend exchange failed on login — sign out of next-auth and prompt re-auth
        console.warn('Backend token exchange failed during OIDC login, re-authenticating...');
        nextAuthSignOut({ callbackUrl: '/login' });
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notifySessionExpiredThenLogout, s?.error]);

  useEffect(() => {
    return () => {
      if (delayedLogoutTimeoutRef.current !== null) {
        window.clearTimeout(delayedLogoutTimeoutRef.current);
      }
    };
  }, []);

  const user = fetchedUser && fetchedUserToken === oidcToken
    ? fetchedUser
    : status === 'authenticated'
      ? oidcUser
      : status === 'unauthenticated'
        ? localSession.user
        : null;

  const token = status === 'authenticated'
    ? oidcToken
    : status === 'unauthenticated'
      ? localSession.token
      : null;

  const refreshUser = useCallback(async () => {
    if (status !== 'authenticated') {
      return !!localSession.token && !!localSession.user;
    }

    if (!token) {
      setFetchedUser(null);
      setFetchedUserToken(null);
      setAuthenticatedProfileReady(false);
      setAuthenticatedProfileError('Backend-Sitzung fehlt. Bitte erneut anmelden.');
      return false;
    }

    setFetchedUser(null);
    setFetchedUserToken(null);
    setAuthenticatedProfileReady(false);
    setAuthenticatedProfileError(null);

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
        console.warn('Backend rejected token, scheduling logout...');
        notifySessionExpiredThenLogout();
        return false;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = (errorBody as { message?: string }).message || 'Benutzerprofil konnte nicht geladen werden.';
        setFetchedUser(null);
        setFetchedUserToken(null);
        setAuthenticatedProfileError(message);
        return false;
      }

      const data = await response.json();
      if (!data.user) {
        setFetchedUser(null);
        setFetchedUserToken(null);
        setAuthenticatedProfileError('Benutzerprofil konnte nicht geladen werden.');
        return false;
      }

      setFetchedUser(data.user);
      setFetchedUserToken(token);
      setAuthenticatedProfileReady(true);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Benutzerprofil konnte nicht geladen werden.';
      console.error('Failed to validate token and fetch user:', error);
      setFetchedUser(null);
      setFetchedUserToken(null);
      setAuthenticatedProfileError(message);
      return false;
    }
  }, [localSession.token, localSession.user, notifySessionExpiredThenLogout, status, token]);

  // Sync token to localStorage when OIDC session changes manually to avoid race conditions
  useEffect(() => {
    if (status !== 'authenticated' || !oidcToken || !oidcUserKey) {
      return;
    }

    // Keep localStorage aligned with active OIDC session even if another
    // consumer cleared token/user while next-auth still reports authenticated.
    const storedUserKey = localSession.user ? JSON.stringify(localSession.user) : null;
    if (localSession.token !== oidcToken || storedUserKey !== oidcUserKey) {
      writeStoredAuthSession(oidcToken, JSON.parse(oidcUserKey) as User);
    }
  }, [localSession.token, localSession.user, oidcToken, oidcUserKey, status]);

  // Fetch user data on mount or when the backend token changes.
  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshUser();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshUser, status]);

  const login = useCallback((nextToken: string, userData: User) => {
    if (delayedLogoutTimeoutRef.current !== null) {
      window.clearTimeout(delayedLogoutTimeoutRef.current);
      delayedLogoutTimeoutRef.current = null;
    }
    hasShownSessionExpiredNoticeRef.current = false;
    writeStoredAuthSession(nextToken, userData);
    setFetchedUser(null);
    setFetchedUserToken(null);
    setAuthenticatedProfileReady(false);
    setAuthenticatedProfileError(null);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      notifySessionExpiredThenLogout();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:unauthorized', handleUnauthorized);
      return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }
  }, [notifySessionExpiredThenLogout]);

  const oidcLogin = useCallback((providerKey?: string, callbackUrl?: string) => {
    if (providerKey && typeof window !== 'undefined') {
      const apiBase = getApiUrl();
      const params = new URLSearchParams();
      params.set('callbackUrl', callbackUrl || '/');
      window.location.href = `${apiBase}/auth/oidc/${encodeURIComponent(providerKey)}/start?${params.toString()}`;
      return;
    }

    nextAuthSignIn('oidc', { callbackUrl: callbackUrl || '/' });
  }, []);

  const profileReady = status === 'authenticated'
    ? authenticatedProfileReady
    : status === 'unauthenticated'
      ? !!localSession.token && !!localSession.user
      : false;
  const profileError = status === 'authenticated' ? authenticatedProfileError : null;

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
