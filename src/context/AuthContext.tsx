'use client';

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
// import posthog from 'posthog-js';
import { AuthToken, createSession, resolveDid, User } from '@/helpers/auth';

interface AuthContextType {
  token: AuthToken | null;
  user: User | null;
  login: (handle: string, passwd: string, host: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<AuthToken | null>(() => {
    if (typeof window !== 'undefined') {
      const token =  localStorage.getItem('token');
      return token ? JSON.parse(token) as AuthToken : null
    }
    return null;
  });

  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const userJson = localStorage.getItem('user');
      return userJson ? JSON.parse(userJson) : null;
    }
    return null;
  });

  useEffect(() => {
    const syncSession = (session: { token: AuthToken; user: User } | null) => {
      if (session) {
        console.log('Syncing session');
        const { token, user } = session;
        localStorage.setItem('token', JSON.stringify(token));
        localStorage.setItem('user', JSON.stringify(user));
        // posthog.identify(user.id);
        setToken(token);
        setUser(user);
      } else {
        console.log('Clearing session');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }
    };
    const refreshSession = async () => {
      try {
        // TODO: refresh session
      } catch {
        syncSession(null);
      }
    };

    refreshSession();
  }, []);

  const login = async (handle: string, passwd: string, host: string) => {
    console.log('Logging in');
    const res = await createSession(handle, passwd, host)
    if (res) {
      setToken(res);
      localStorage.setItem('token', JSON.stringify(res));
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
