'use client';

import { FormEvent, useCallback, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/context/AuthContext';
import { eventDispatcher } from '@/utils/event';

type Props = {
 handleClose?: () => void;
};

export default function AuthPage({handleClose}: Props) {
  const _ = useTranslation();
  const { login, startOAuthLogin } = useAuth();
  const [authMode, setAuthMode] = useState<'password' | 'oauth'>('password');
  const [host, setHost] = useState('bsky.social');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleOAuthLogin = useCallback(async () => {
    setIsLoading(true);
    try {
      // Store host in sessionStorage for the callback page to use
      sessionStorage.setItem('oauth_host', host);
      
      await startOAuthLogin(host);
      // The library redirects to Bluesky, so this only returns on error
    } catch (e) {
      sessionStorage.removeItem('oauth_host');
      eventDispatcher.dispatch('toast', {
        message: `Error: ${e}`,
        timeout: 2000,
        type: 'error',
      });
      setIsLoading(false);
    }
  }, [host, startOAuthLogin, _]);

  return (
    <div className='auth-content flex flex-col items-center justify-center'>
      <h1 className="title text-center text-2xl my-4">{_('Join with atproto')}</h1>
      <div className="card mx-auto p-4 w-full max-w-md">
        {/* Auth Mode Tabs */}
        <div className="tabs tabs-bordered mb-6 hidden">
          <button
            className={`tab ${authMode === 'password' ? 'tab-active' : ''}`}
            onClick={() => setAuthMode('password')}
          >
            {_('App Password')}
          </button>
          <button
            className={`tab ${authMode === 'oauth' ? 'tab-active' : ''}`}
            onClick={() => setAuthMode('oauth')}
          >
            {_('OAuth')}
          </button>
        </div>

        {/* Password Authentication Mode */}
        {authMode === 'password' && (
          <form
            className="flex flex-col gap-2" 
            onSubmit={onSubmit}
          >
            <label className="w-full flex items-center gap-2">
              <span className="text-accent">Service</span> 
              <input
                type="text"
                name="host"
                id="host" 
                placeholder="e.g. bsky.social"
                value={host}
                onChange={(event) => setHost(event.target.value || 'bsky.social')}
                className="input input-sm border-none w-full" 
                disabled={isLoading}
              />
            </label>
            <label className="w-full flex items-center gap-2">
              <span className="text-accent">Handle</span>
              <input
                type="text"
                name="handle"
                id="handle" 
                placeholder="e.g. my.bsky.social"
                className="input input-sm border-none w-full" 
                onChange={(event) => setHandle(event.target.value)}
                required
                disabled={isLoading}
              />
            </label>
            <label className="w-full flex items-center gap-2">
              <span className="text-accent">Password</span>
              <input
                type="password"
                name="pass"
                id="pass" 
                className="input input-sm border-none w-full" 
                placeholder="App Password" 
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={isLoading}
              />
            </label>
            <a 
              className="text-sm text-success px-2" 
              href="https://bsky.app/settings/app-passwords" 
              target="_blank"
              rel="noopener noreferrer"
            >
              {_('Go to generate the app password')}
            </a>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? _('Signing in...') : _('Sign in with atproto')}
            </button>
            <a 
              className="text-xs text-success text-center px-1" 
              href="https://bsky.app" 
              target="_blank"
              rel="noopener noreferrer"
            >
              {_("No ATmosphere account? Let's start with Bluesky")}
            </a>
          </form>
        )}

        {/* OAuth Authentication Mode */}
        {authMode === 'oauth' && (
          <div className="flex flex-col gap-4">
            <label className="w-full flex items-center gap-2">
              <span className="text-accent">Service</span> 
              <input
                type="text"
                name="host-oauth"
                id="host-oauth" 
                placeholder="e.g. bsky.social"
                value={host}
                onChange={(event) => setHost(event.target.value || 'bsky.social')}
                className="w-full input input-sm border-none"
                disabled={isLoading}
              />
            </label>
            
            <div className="alert alert-info">
              <p className="text-sm">
                {_('OAuth allows you to sign in securely without sharing your app password. You will be redirected to Bluesky to authorize this app.')}
              </p>
            </div>

            <button 
              type="button"
              onClick={handleOAuthLogin}
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? _('Connecting...') : _('Sign in with OAuth')}
            </button>

            <a 
              className="text-xs text-success text-center px-1" 
              href="https://bsky.app" 
              target="_blank"
              rel="noopener noreferrer"
            >
              {_("No ATmosphere account? Let's start with Bluesky")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
