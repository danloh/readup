'use client';

import { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import type { AtpAgent } from '@atproto/api';
import {
  AuthToken,
  createSession,
  getAgent,
  refreshSession,
  resetAgent,
  resolveIdentity,
  User,
} from '@/services/bsky/auth';
import {
  completeOrphanedNativeCallback,
  hasPendingNativeSignIn,
  isOAuthSessionDeadError,
  logoutOAuthSession,
  restoreOAuthSession,
  signInNative,
  signInWithRedirect,
  type OAuthSession,
} from '@/services/bsky/oauth';
import { getOAuthClientKind, isNativeOAuthCallbackUrl } from '@/services/bsky/oauth-config';
import { isTauriAppPlatform } from '@/services/environment';
import { eventDispatcher } from '@/utils/event';

interface AuthContextType {
  user: User | null;
  login: (handle: string, passwd: string, host: string) => Promise<boolean>;
  /**
   * Sign in with OAuth. `identifier` is a handle, DID or service URL (empty
   * means bsky.social). On the web this redirects away and never resolves;
   * in the app it resolves once the browser hands the result back.
   */
  loginWithOAuth: (identifier: string) => Promise<boolean>;
  completeOAuthLogin: (session: OAuthSession) => Promise<boolean>;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const saveUser = (user: User | null) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
};

const readUser = (): User | null => {
  try {
    const userJson = localStorage.getItem('user');
    return userJson ? (JSON.parse(userJson) as User) : null;
  } catch {
    return null;
  }
};

async function isMobileApp(): Promise<boolean> {
  const { type } = await import('@tauri-apps/plugin-os');
  return ['android', 'ios'].includes(type());
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() =>
    typeof window !== 'undefined' ? readUser() : null,
  );

  const syncSession = useCallback((user: User | null) => {
    resetAgent();
    saveUser(user);
    setUser(user);
  }, []);

  useEffect(() => {
    const restore = async () => {
      const stored = readUser();
      if (!stored) return;

      if (stored.oauth) {
        try {
          await restoreOAuthSession(stored.did);
        } catch (e) {
          // offline or server hiccup: keep the user, retry on next request
          if (isOAuthSessionDeadError(e)) {
            console.log('OAuth session expired or revoked');
            syncSession(null);
          } else {
            console.log('error restoring OAuth session: ', e);
          }
        }
        return;
      }

      try {
        syncSession(await refreshSession());
      } catch (e) {
        console.log('error on refresh session: ', e);
        if (!readUser()) setUser(null);
      }
    };
    restore();
  }, [syncSession]);

  const completeOAuthLogin = useCallback(
    async (session: OAuthSession) => {
      try {
        const identity = await resolveIdentity(session.did);
        syncSession({
          host: new URL(session.serverMetadata.issuer).host,
          did: session.did,
          handle: identity.handle || session.did,
          email: '',
          accessJwt: '',
          refreshJwt: '',
          service: identity.pds,
          oauth: true,
        });
        return true;
      } catch (error) {
        console.error('OAuth login completion error:', error);
        return false;
      }
    },
    [syncSession],
  );

  // The OS may restart the app while the user is authorizing in the browser;
  // then the deep link arrives with no sign-in waiting for it.
  useEffect(() => {
    if (!isTauriAppPlatform()) return;
    const onIncoming = async (event: CustomEvent) => {
      const urls = (event.detail?.urls ?? []) as string[];
      const url = urls.find(isNativeOAuthCallbackUrl);
      if (!url || hasPendingNativeSignIn()) return;
      try {
        await completeOAuthLogin(await completeOrphanedNativeCallback(url));
      } catch (e) {
        console.warn('Ignoring stale OAuth callback:', e);
      }
    };
    eventDispatcher.on('app-incoming-url', onIncoming);
    return () => eventDispatcher.off('app-incoming-url', onIncoming);
  }, [completeOAuthLogin]);

  const login = async (handle: string, passwd: string, host: string) => {
    const res: AuthToken | undefined = await createSession(handle.trim().replace(/^@/, ''), passwd, host);
    if (!res) {
      console.log('Failed to Log in');
      return false;
    }
    const identity = await resolveIdentity(res.did);
    syncSession({
      host,
      did: res.did,
      handle: res.handle,
      email: res.email || '',
      accessJwt: res.accessJwt,
      refreshJwt: res.refreshJwt,
      service: identity.pds,
    });
    return true;
  };

  const loginWithOAuth = async (identifier: string) => {
    if (getOAuthClientKind() !== 'native') {
      if (window.location.hostname === 'localhost') {
        throw new Error(
          `OAuth in development needs the loopback IP: open http://127.0.0.1:${window.location.port}`,
        );
      }
      return signInWithRedirect(identifier);
    }
    const session = await signInNative(identifier, await isMobileApp());
    return completeOAuthLogin(session);
  };

  const logout = () => {
    console.log('Logging out');
    const current = readUser() ?? user;
    if (current?.oauth) {
      logoutOAuthSession(current.did).catch((e) => console.log('OAuth revoke failed:', e));
    } else if (current?.did) {
      // invalidate the refresh token server-side, best effort
      getAgent()
        .then((agent) => (agent as AtpAgent).logout?.())
        .catch(() => {});
    }
    syncSession(null);
  };

  const refresh = async () => {
    const current = readUser();
    if (!current || current.oauth) return;
    try {
      syncSession(await refreshSession());
    } catch (e) {
      console.log('Error on refresh session: ', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, login, loginWithOAuth, completeOAuthLogin, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
