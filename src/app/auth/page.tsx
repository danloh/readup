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
  const { login } = useAuth();
  const [host, setHost] = useState('bsky.social');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
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
      }
    },
    [host, handle, password]
  );

  return (
    <div className='auth-content flex flex-col items-center justify-center'>
      <h1 className="title text-center text-2xl my-4">{_('Join with atproto')}</h1>
      <div className="card mx-auto p-4 w-full mx-auto max-w-md">
        <form
          className="flex flex-col gap-4" 
          onSubmit={onSubmit}
        >
          <label className="w-full input flex items-center gap-2">
            <span className="text-accent">Service</span> 
            <input
              type="text"
              name="host"
              id="host" 
              placeholder="such as: bsky.social"
              value="bsky.social" 
              onChange={(event) => setHost(event.target.value || 'bsky.social')}
              className="grow" 
            />
          </label>
          <label className="w-full input flex items-center gap-2">
            <span className="text-accent">Handle</span>
            <input
              type="text"
              name="handle"
              id="handle" 
              placeholder="e.g. my.bsky.social"
              className="grow" 
              onChange={(event) => setHandle(event.target.value)}
              required
            />
          </label>
          <label className="w-full input flex items-center gap-2">
            <span className="text-accent">Password</span>
            <input
              type="password"
              name="pass"
              id="pass" 
              className="grow" 
              placeholder="App Password" 
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <a 
            className="text-sm text-success px-2" 
            href="https://bsky.app/settings/app-passwords" 
            target="_blank"
          >
            {_('Go to generate the app password')}
          </a>
          <button type="submit" className="btn btn-primary">
            {_('Sign in with atproto')}
          </button>
          <a 
            className="text-xs text-success text-center px-1" 
            href="https://bsky.app" 
            target="_blank"
          >
            {_("No ATmosphere account? Let's start with Bluesky")}
          </a>
        </form>
      </div>
    </div>
  );
};
