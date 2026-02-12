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
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      const s = session as {
        user?: { id?: string; name?: string; email?: string; role?: string };
        idToken?: string;
        accessToken?: string;
      };
      
      // Bridging OIDC session to AuthContext
      const oidcUser: User = {
        id: s.user?.id || s.user?.email || 'oidc',
        username: s.user?.name || s.user?.email || 'OIDC User',
        email: s.user?.email || '',
        role: s.user?.role || 'user',
      };
      
      const authToken = s.idToken || s.accessToken || null;
      
      // Use setTimeout to avoid synchronous state update in effect which causes cascading renders
      const timer = setTimeout(() => {
        setUser(oidcUser);
        setToken(authToken);
        
        if (authToken) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('token', authToken);
            localStorage.setItem('user', JSON.stringify(oidcUser));
          }
        }
      }, 0);
      
      return () => clearTimeout(timer);
    } else if (status === 'unauthenticated') {
      // Fallback to local storage for traditional login
      if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        if (storedUser && storedToken) {
          try {
            const parsedUser = JSON.parse(storedUser);
            const timer = setTimeout(() => {
              setUser(parsedUser);
              setToken(storedToken);
            }, 0);
            return () => clearTimeout(timer);
          } catch {
            const timer = setTimeout(() => {
              setUser(null);
              setToken(null);
            }, 0);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            return () => clearTimeout(timer);
          }
        }
      }
    }
  }, [session, status]);

  // Check token validity on mount or when token changes
  useEffect(() => {
    const checkTokenValidity = async () => {
      if (token) {
        try {
          const { fetchApi } = await import('@/lib/api');
          const response = await fetchApi('/token/validate');
          if (response.status === 401) {
            logout();
          }
        } catch (error) {
          console.error('Failed to validate token:', error);
        }
      }
    };

    if (token) {
      checkTokenValidity();
    }
  }, [token]);

  const login = (token: string, userData: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
    }
    setUser(userData);
    setToken(token);
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setUser(null);
    setToken(null);
    if (status === 'authenticated') {
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
  }, [status]); // Add status as dependency to ensure logout logic has latest status

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
