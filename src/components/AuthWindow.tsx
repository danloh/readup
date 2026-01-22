import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import AuthPage from '@/app/auth/page';
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
      <AuthPage handleClose={handleClose} />
    </Dialog>
  );
};
