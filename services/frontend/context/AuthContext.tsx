'use client';

import { getApiUrl } from '@/lib/apiUrl';
import { fetchApi } from '@/lib/api';
import { toast } from '@heroui/react';
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

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
  /** Kept for API compatibility; browser sessions no longer expose a JWT. */
  token: string | null;
  loading: boolean;
  profileReady: boolean;
  profileError: string | null;
  login: (userData: User) => void;
  logout: (options?: LogoutOptions) => void;
  oidcLogin: (providerKey?: string, callbackUrl?: string) => void;
  refreshUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const LOGIN_PATH = '/login';

interface LogoutOptions {
  preserveCurrentUrl?: boolean;
}

function getCurrentCallbackUrl() {
  if (typeof window === 'undefined') {
    return '/';
  }

  const callbackUrl = `${window.location.pathname}${window.location.search}`;
  if (!callbackUrl || callbackUrl === LOGIN_PATH || callbackUrl.startsWith(`${LOGIN_PATH}?`)) {
    return '/';
  }

  return callbackUrl;
}

function getLoginRedirectPath(preserveCurrentUrl?: boolean) {
  if (!preserveCurrentUrl) {
    return LOGIN_PATH;
  }

  return `${LOGIN_PATH}?callbackUrl=${encodeURIComponent(getCurrentCallbackUrl())}`;
}

function redirectToLogin(path: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (currentPath === path) {
    return;
  }

  window.location.assign(path);
}

function clearLegacyAuthStorage() {
  if (typeof window === 'undefined') return;
  // Remove sessions written by versions that stored backend JWTs in
  // localStorage. The active session is now established through the cookie.
  window.localStorage.removeItem('token');
  window.localStorage.removeItem('user');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [cookieUser, setCookieUser] = useState<User | null>(null);
  const [cookieProfileReady, setCookieProfileReady] = useState(false);
  const [fetchedUser, setFetchedUser] = useState<User | null>(null);
  const [authenticatedProfileReady, setAuthenticatedProfileReady] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const hasShownSessionExpiredNoticeRef = useRef(false);
  const delayedLogoutTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    clearLegacyAuthStorage();
  }, []);

  const s = session as {
    user?: { id?: string; name?: string; email?: string; role?: string; authType?: string; canSubmitApps?: boolean };
    /** Upstream OIDC ID token, used once to establish the backend cookie. */
    idToken?: string;
    error?: string;
  } | null;

  const oidcIdToken = status === 'authenticated' ? (s?.idToken || null) : null;
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

  const logout = useCallback((options?: LogoutOptions) => {
    if (delayedLogoutTimeoutRef.current !== null) {
      window.clearTimeout(delayedLogoutTimeoutRef.current);
      delayedLogoutTimeoutRef.current = null;
    }

    const loginRedirectPath = getLoginRedirectPath(options?.preserveCurrentUrl);
    hasShownSessionExpiredNoticeRef.current = false;
    setCookieUser(null);
    setCookieProfileReady(false);
    setFetchedUser(null);
    setAuthenticatedProfileReady(false);
    setProfileError(null);
    clearLegacyAuthStorage();

    void fetchApi('/auth/logout', { method: 'POST' }).catch(() => {});

    if (status === 'authenticated') {
      void nextAuthSignOut({ redirect: false, callbackUrl: loginRedirectPath })
        .catch((error) => {
          console.warn('NextAuth sign-out failed before login redirect:', error);
        })
        .finally(() => redirectToLogin(loginRedirectPath));
      return;
    }
    redirectToLogin(loginRedirectPath);
  }, [status]);

  const notifySessionExpiredThenLogout = useCallback(() => {
    if (hasShownSessionExpiredNoticeRef.current) {
      return;
    }
    hasShownSessionExpiredNoticeRef.current = true;
    toast.warning('Sitzung abgelaufen. Sie werden zur Anmeldung weitergeleitet.');
    delayedLogoutTimeoutRef.current = window.setTimeout(() => {
      delayedLogoutTimeoutRef.current = null;
      logout({ preserveCurrentUrl: true });
    }, 1500);
  }, [logout]);

  useEffect(() => {
    if (!s?.error) return;

    const timeoutId = window.setTimeout(() => {
      if (s.error === 'RefreshAccessTokenError' || s.error === 'SessionExpired') {
        notifySessionExpiredThenLogout();
      }

      if (s.error === 'ExchangeFailed') {
        void nextAuthSignOut({ callbackUrl: '/login' });
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [notifySessionExpiredThenLogout, s?.error]);

  useEffect(() => () => {
    if (delayedLogoutTimeoutRef.current !== null) {
      window.clearTimeout(delayedLogoutTimeoutRef.current);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (status === 'loading') {
      return false;
    }

    setProfileError(null);
    if (status === 'authenticated') {
      setFetchedUser(null);
      setAuthenticatedProfileReady(false);

      if (!oidcIdToken) {
        setProfileError('Backend-Sitzung fehlt. Bitte erneut anmelden.');
        return false;
      }

      try {
        // The exchange response sets the backend JWT as an HttpOnly cookie;
        // the backend JWT itself never enters localStorage or the public auth context.
        const exchangeResponse = await fetchApi('/auth/oidc/exchange', {
          method: 'POST',
          body: JSON.stringify({ id_token: oidcIdToken }),
        });
        if (!exchangeResponse.ok) {
          const errorBody = await exchangeResponse.json().catch(() => ({}));
          setProfileError((errorBody as { message?: string }).message || 'OIDC-Anmeldung konnte nicht mit dem Backend verbunden werden.');
          return false;
        }

        const response = await fetchApi('/user/', { cache: 'no-store' });
        if (response.status === 401) {
          notifySessionExpiredThenLogout();
          return false;
        }
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          setProfileError((errorBody as { message?: string }).message || 'Benutzerprofil konnte nicht geladen werden.');
          return false;
        }

        const data = await response.json() as { user?: User };
        if (!data.user) {
          setProfileError('Benutzerprofil konnte nicht geladen werden.');
          return false;
        }

        setFetchedUser(data.user);
        setAuthenticatedProfileReady(true);
        return true;
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : 'Benutzerprofil konnte nicht geladen werden.');
        return false;
      }
    }

    // Local and dynamic OIDC sessions are resolved entirely through the
    // HttpOnly cookie. A 401 simply means that no browser session exists.
    setCookieProfileReady(false);
    try {
      const response = await fetchApi('/user/', { cache: 'no-store' });
      if (response.status === 401) {
        setCookieUser(null);
        setCookieProfileReady(true);
        return false;
      }
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        setProfileError((errorBody as { message?: string }).message || 'Benutzerprofil konnte nicht geladen werden.');
        setCookieProfileReady(true);
        return false;
      }

      const data = await response.json() as { user?: User };
      setCookieUser(data.user || null);
      setCookieProfileReady(true);
      return !!data.user;
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Benutzerprofil konnte nicht geladen werden.');
      setCookieProfileReady(true);
      return false;
    }
  }, [notifySessionExpiredThenLogout, oidcIdToken, status]);

  useEffect(() => {
    if (status === 'loading') return;
    const timeoutId = window.setTimeout(() => void refreshUser(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshUser, status]);

  const login = useCallback((userData: User) => {
    if (delayedLogoutTimeoutRef.current !== null) {
      window.clearTimeout(delayedLogoutTimeoutRef.current);
      delayedLogoutTimeoutRef.current = null;
    }
    hasShownSessionExpiredNoticeRef.current = false;
    setCookieUser(userData);
    setCookieProfileReady(true);
    setProfileError(null);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => notifySessionExpiredThenLogout();
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [notifySessionExpiredThenLogout]);

  const oidcLogin = useCallback((providerKey?: string, callbackUrl?: string) => {
    if (providerKey && typeof window !== 'undefined') {
      const apiBase = getApiUrl();
      const params = new URLSearchParams();
      params.set('callbackUrl', callbackUrl || '/');
      params.set('frontendOrigin', window.location.origin);
      window.location.href = `${apiBase}/auth/oidc/${encodeURIComponent(providerKey)}/start?${params.toString()}`;
      return;
    }

    nextAuthSignIn('oidc', { callbackUrl: callbackUrl || '/' });
  }, []);

  const user = status === 'authenticated' ? (fetchedUser || oidcUser) : cookieUser;
  const profileReady = status === 'authenticated' ? authenticatedProfileReady : status === 'unauthenticated' && cookieProfileReady;
  const isLoading = status === 'loading' || !profileReady && !profileError;

  return (
    <AuthContext.Provider value={{
      user,
      token: null,
      loading: isLoading,
      profileReady,
      profileError,
      login,
      logout,
      oidcLogin,
      refreshUser,
    }}>
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
