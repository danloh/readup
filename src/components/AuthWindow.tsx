import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
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
  const { appService } = useEnv();

  const [isOpen, setIsOpen] = useState(false);

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

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog
      id='auth_window'
      isOpen={isOpen}
      title={_('Welcome to Readup')}
      onClose={handleClose}
      boxClassName='sm:!w-96 sm:h-auto'
    >
      <div className='about-content flex flex-col items-center justify-center'>
        <div className='flex flex-col items-center gap-2 px-8 py-2'>
          <div className='mb-2 mt-6'>
            <Image src='/icon.png' alt='App Logo' className='h-20 w-20' width={64} height={64} />
          </div>
          <div className='flex select-text flex-col items-center'>
            <h2 className='mb-2 text-2xl font-bold'>Readup</h2>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
