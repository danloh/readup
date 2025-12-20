'use client';

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
// import posthog from 'posthog-js';
import { AuthToken, createSession, refreshSession, resolveDid, User } from '@/services/bsky/auth';

interface AuthContextType {
  user: User | null;
  login: (handle: string, passwd: string, host: string) => Promise<boolean>;
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
        localStorage.setItem('user', JSON.stringify(user));
        // posthog.identify(user.id);
        setUser(user);
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
    console.log('Logging in');
    const res: AuthToken | undefined = await createSession(handle, passwd, host);
    console.log('Logg result: ', res);
    if (res) {
      // build User
      let serv = await resolveDid(res.did);
      if (serv) {
        const newUser: User = {
          host,
          did: res.did,
          handle: res.handle,
          email: res.email || '',
          access: res.accessJwt,
          refresh: res.refreshJwt,
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

  const logout = () => {
    console.log('Logging out');
    localStorage.removeItem('user');
    setUser(null);
  };

  const refresh = async () => {
    try {
      // refresh session
      const usr = await refreshSession();
      setUser(usr);
      localStorage.setItem('user', JSON.stringify(usr));
    } catch (e) {
      console.log('Error on refresh session: ', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
