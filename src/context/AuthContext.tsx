'use client';

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
// import posthog from 'posthog-js';
import { AuthToken, createSession, refreshSession, resolveDid, User } from '@/services/bsky/auth';
import { startOAuthFlow, getAuthorizationCode } from '@/services/bsky/oauth';

interface AuthContextType {
  user: User | null;
  login: (handle: string, passwd: string, host: string) => Promise<boolean>;
  loginWithOAuth: (code: string, codeVerifier: string, host: string, clientId: string) => Promise<boolean>;
  startOAuthLogin: (clientId: string, host?: string) => Promise<void>;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const userJson = localStorage.getItem('user');
      return userJson ? JSON.parse(userJson) : null;
    }
    return null;
  });

  useEffect(() => {
    const syncSession = (user: User | null | undefined) => {
      if (user) {
        console.log('Syncing session');
        // posthog.identify(user.handle);
        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        console.log('Clearing session');
        localStorage.removeItem('user');
        setUser(null);
      }
    };
    const refreshSess = async () => {
      try {
        // refresh session
        const usr = await refreshSession();
        syncSession(usr);
      } catch (e) {
        console.log('error on refresh session: ', e);
      }
    };

    refreshSess();
  }, []);

  const login = async (handle: string, passwd: string, host: string) => {
    const res: AuthToken | undefined = await createSession(handle, passwd, host);
    if (res) {
      // build User
      let serv = await resolveDid(res.did);
      if (serv) {
        const newUser: User = {
          host,
          did: res.did,
          handle: res.handle,
          email: res.email || '',
          accessJwt: res.accessJwt,
          refreshJwt: res.refreshJwt,
          service: serv,
        };

        setUser(newUser);
        localStorage.setItem('user', JSON.stringify(newUser));
      }
      return true;
    } else {
      console.log('Failed to Log in');
      return false;
    }
  };

  const startOAuthLogin = async (clientId: string, host: string = 'bsky.social') => {
    const redirectUri = `${window.location.origin}/auth/callback`;
    await startOAuthFlow({ clientId, redirectUri, host });
  };

  const loginWithOAuth = async (
    code: string, 
    codeVerifier: string, 
    host: string, 
    clientId: string
  ) => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      
      // Call backend API to exchange code for tokens
      const response = await fetch('/api/auth/oauth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          codeVerifier,
          redirectUri,
          host,
          clientId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to exchange authorization code');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'OAuth authentication failed');
      }

      // Create user object from OAuth response
      const newUser: User = {
        host,
        did: data.data.did,
        handle: data.data.handle,
        email: data.data.email || '',
        accessJwt: data.data.accessToken,
        refreshJwt: data.data.refreshToken || '',
        service: data.data.service,
      };

      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
      return true;
    } catch (error) {
      console.error('OAuth login error:', error);
      return false;
    }
  };

  const logout = () => {
    console.log('Logging out');
    localStorage.removeItem('user');
    setUser(null);
  };

  const refresh = async () => {
    try {
      // refresh session and save to localStorage
      const usr = await refreshSession();
      setUser(usr);
      localStorage.setItem('user', JSON.stringify(usr));
    } catch (e) {
      console.log('Error on refresh session: ', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithOAuth, startOAuthLogin, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
