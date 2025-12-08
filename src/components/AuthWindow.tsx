import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/context/AuthContext';
import { eventDispatcher } from '@/utils/event';
import Dialog from './Dialog';

export const setAuthDialogVisible = (visible: boolean) => {
  const dialog = document.getElementById('auth_window');
  if (dialog) {
    const event = new CustomEvent('setDialogVisibility', {
      detail: { visible },
    });
    dialog.dispatchEvent(event);
  }
};

export const AuthWindow = () => {
  const _ = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const handleClose = () => {
    setIsOpen(false);
  };

  const { login } = useAuth();
  const [host, setHost] = useState('bsky.social');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const res = await login(handle, password, host); 
      if (res) {
        handleClose();
      } else {
        // toast 
        eventDispatcher.dispatch('toast', {
          message: 'Failed Signing in',
          timeout: 2000,
          type: 'warning',
        });
      }
    },
    [host, handle, password]
  );

  useEffect(() => {
    const handleCustomEvent = (event: CustomEvent) => {
      setIsOpen(event.detail.visible);
    };

    const el = document.getElementById('auth_window');
    if (el) {
      el.addEventListener('setDialogVisibility', handleCustomEvent as EventListener);
    }

    return () => {
      if (el) {
        el.removeEventListener('setDialogVisibility', handleCustomEvent as EventListener);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog
      id='auth_window'
      isOpen={isOpen}
      title={_('Welcome to Readup')}
      onClose={handleClose}
      boxClassName='sm:!w-96 sm:h-auto'
    >
      <div className='auth-content flex flex-col items-center justify-center'>
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
              className="text-sm text-success" 
              href="https://bsky.app/settings/app-passwords" 
              target="_blank"
            >
              Go to generate the app password
            </a>
            <button type="submit" className="btn btn-primary">
              Sign in with Bluesky
            </button>
          </form>
        </div>
      </div>
    </Dialog>
  );
};
