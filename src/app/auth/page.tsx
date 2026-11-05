'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/context/AuthContext';
import { eventDispatcher } from '@/utils/event';
import { cancelNativeSignIn } from '@/services/bsky/oauth';

type Props = {
 handleClose?: () => void;
};

export default function AuthPage({handleClose}: Props) {
  const _ = useTranslation();
  const { login, loginWithOAuth } = useAuth();
  const [authMode, setAuthMode] = useState<'password' | 'oauth'>('oauth');
  const [identifier, setIdentifier] = useState('');
  const [host, setHost] = useState('bsky.social');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // stop waiting for the browser if the dialog closes mid sign-in
  useEffect(() => () => cancelNativeSignIn(), []);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsLoading(true);
      try {
        const res = await login(handle, password, host); 
        if (res) {
          handleClose && handleClose();
        } else {
          // toast 
          eventDispatcher.dispatch('toast', {
            message: _('Failed to sign in'),
            timeout: 2000,
            type: 'warning',
          });
        }
      } catch(e) {
        eventDispatcher.dispatch('toast', {
          message: `Error: ${e}`,
          timeout: 2000,
          type: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [host, handle, password, login, _]
  );

  const handleOAuthLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsLoading(true);
      try {
        // web: redirects away; app: resolves after the browser hands back
        const ok = await loginWithOAuth(identifier);
        if (ok) {
          handleClose && handleClose();
        } else {
          eventDispatcher.dispatch('toast', {
            message: _('Failed to sign in'),
            timeout: 2000,
            type: 'warning',
          });
        }
      } catch (e) {
        eventDispatcher.dispatch('toast', {
          message: `Error: ${e instanceof Error ? e.message : e}`,
          timeout: 3000,
          type: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [identifier, loginWithOAuth, handleClose, _],
  );

  return (
    <div className='auth-content flex flex-col items-center justify-center'>
      <h1 className="title text-center text-2xl my-4">{_('Join with atproto')}</h1>
      <div className="card mx-auto p-4 w-full max-w-md">
        {/* Auth Mode Tabs */}
        <div className="tabs tabs-bordered mb-6" role="tablist">
          <button
            type="button"
            role="tab"
            className={`tab ${authMode === 'oauth' ? 'tab-active' : ''}`}
            onClick={() => setAuthMode('oauth')}
          >
            {_('OAuth')}
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${authMode === 'password' ? 'tab-active' : ''}`}
            onClick={() => setAuthMode('password')}
          >
            {_('App Password')}
          </button>
        </div>

        {/* Password Authentication Mode */}
        {authMode === 'password' && (
          <form
            className="flex flex-col gap-2" 
            onSubmit={onSubmit}
          >
            <label className="w-full flex flex-col gap-2">
              <span className="text-primary">Service</span> 
              <input
                type="text"
                name="host"
                id="host" 
                placeholder="e.g. bsky.social"
                value={host}
                onChange={(event) => setHost(event.target.value || 'bsky.social')}
                className="input input-sm input-primary w-full" 
                disabled={isLoading}
              />
            </label>
            <label className="w-full flex flex-col gap-2">
              <span className="text-primary">Handle</span>
              <input
                type="text"
                name="handle"
                id="handle" 
                placeholder="e.g. my.bsky.social"
                className="input input-sm input-primary w-full" 
                onChange={(event) => setHandle(event.target.value)}
                required
                disabled={isLoading}
              />
            </label>
            <label className="w-full flex flex-col gap-2">
              <span className="text-primary">Password</span>
              <input
                type="password"
                name="pass"
                id="pass" 
                className="input input-sm input-primary w-full" 
                placeholder="App Password" 
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={isLoading}
              />
            </label>
            <a 
              className="text-sm text-success px-1" 
              href="https://bsky.app/settings/app-passwords" 
              target="_blank"
              rel="noopener noreferrer"
            >
              {_('Go to generate the app password')}
            </a>
            <button 
              type="submit" 
              className="btn btn-primary btn-sm btn-wide w-full"
              disabled={isLoading}
            >
              {isLoading ? _('Signing in...') : _('Sign in with atproto')}
            </button>
            <a 
              className="text-xs text-center px-1" 
              href="https://bsky.app" 
              target="_blank"
              rel="noopener noreferrer"
            >
              {_("No atproto account? Let's start with Bluesky")}
            </a>
          </form>
        )}

        {/* OAuth Authentication Mode */}
        {authMode === 'oauth' && (
          <form className="flex flex-col gap-4" onSubmit={handleOAuthLogin}>
            <label className="w-full flex flex-col gap-2">
              <span className="text-primary">{_('Handle')}</span>
              <input
                type="text"
                name="identifier"
                id="identifier"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="e.g. my.bsky.social"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full input input-sm input-primary"
                disabled={isLoading}
              />
            </label>

            <p className="text-sm opacity-80">
              {_('Sign in on your account server without sharing a password. Leave the handle empty to choose the account on Bluesky.')}
            </p>

            <button
              type="submit"
              className="btn btn-primary btn-sm w-full"
              disabled={isLoading}
            >
              {isLoading ? _('Waiting for authorization...') : _('Sign in with atproto')}
            </button>

            <a
              className="text-xs text-success text-center px-1"
              href="https://bsky.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              {_("No atproto account? Let's start with Bluesky")}
            </a>
          </form>
        )}
      </div>
    </div>
  );
};
