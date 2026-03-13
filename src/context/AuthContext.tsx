'use client';

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
// import posthog from 'posthog-js';
import { AuthToken, createSession, refreshSession, resolveDid, User } from '@/services/bsky/auth';
import { startOAuthFlow, logoutOAuthSession, type OAuthSession } from '@/services/bsky/oauth';
import { getOAuthClientId } from '@/services/bsky/oauth-config';

interface AuthContextType {
  user: User | null;
  login: (handle: string, passwd: string, host: string) => Promise<boolean>;
  startOAuthLogin: (host?: string) => Promise<void>;
  completeOAuthLogin: (session: OAuthSession, host: string) => Promise<boolean>;
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

  const startOAuthLogin = async (host: string = 'bsky.social') => {
    try {
      const clientId = getOAuthClientId();
      if (!clientId) {
        throw new Error(
          'OAuth client ID not configured. ' +
          'Set NEXT_PUBLIC_OAUTH_CLIENT_ID environment variable.'
        );
      }

      // Store host for the callback to use
      sessionStorage.setItem('oauth_host', host);

      // Start OAuth flow - this redirects to Bluesky
      await startOAuthFlow({ clientId, host });
    } catch (error) {
      sessionStorage.removeItem('oauth_host');
      console.error('OAuth login error:', error);
      throw error;
    }
  };

  const completeOAuthLogin = async (session: OAuthSession, host: string) => {
    try {
      // Resolve the DID to get the PDS service endpoint
      const service = await resolveDid(session.sub);

      const newUser: User = {
        host,
        did: session.sub,
        handle: session.handle,
        email: '',
        accessJwt: session.accessToken,
        refreshJwt: '',
        service,
      };

      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
      return true;
    } catch (error) {
      console.error('OAuth login completion error:', error);
      return false;
    }
  };

  const logout = () => {
    console.log('Logging out');
    try {
      // Logout from OAuth if user has an OAuth session
      if (user?.did) {
        logoutOAuthSession(user.did).catch(() => {
          // Silently fail if OAuth logout doesn't work
        });
      }
    } catch (e) {
      console.log('Error during OAuth logout:', e);
    }
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
    <AuthContext.Provider value={{ user, login, startOAuthLogin, completeOAuthLogin, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
