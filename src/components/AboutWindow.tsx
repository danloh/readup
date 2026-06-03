import { useEffect, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { checkForAppUpdates, checkAppReleaseNotes } from '@/helpers/updater';
import { parseWebViewInfo } from '@/utils/ua';
import { getAppVersion } from '@/utils/version';
import Dialog from './Dialog';
import Link from './Link';
import Logo from './Logo';

export const setAboutDialogVisible = (visible: boolean) => {
  const dialog = document.getElementById('about_window');
  if (dialog) {
    const event = new CustomEvent('setDialogVisibility', {
      detail: { visible },
    });
    dialog.dispatchEvent(event);
  }
};

type UpdateStatus = 'checking' | 'updating' | 'updated' | 'error';

export const AboutWindow = () => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [browserInfo, setBrowserInfo] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setBrowserInfo(parseWebViewInfo(appService));

    const handleCustomEvent = (event: CustomEvent) => {
      setIsOpen(event.detail.visible);
    };

    const el = document.getElementById('about_window');
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

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    try {
      const hasUpdate = await checkForAppUpdates(_, false);
      if (hasUpdate) {
        handleClose();
      } else {
        setUpdateStatus('updated');
      }
    } catch (error) {
      console.info('Error checking for updates:', error);
      setUpdateStatus('error');
    }
  };

  const handleShowRecentUpdates = async () => {
    const hasNotes = await checkAppReleaseNotes(false);
    if (hasNotes) {
      handleClose();
    } else {
      setUpdateStatus('error');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setUpdateStatus(null);
  };

  return (
    <Dialog
      id='about_window'
      isOpen={isOpen}
      title={_('About Readup')}
      onClose={handleClose}
      boxClassName='sm:!w-96 sm:h-auto'
    >
      <div className='about-content flex flex-col items-center justify-center'>
        <div className='flex flex-col items-center gap-2 px-8 py-2'>
          <div className='mb-2 mt-6'>
            <Logo width={64} height={64} />
          </div>
          <div className='flex select-text flex-col items-center'>
            <h2 className='mb-2 text-2xl font-bold'>Readup</h2>
            <p className='mb-4'>{_('Feed with Books')}</p>
            <p className='text-neutral-content text-center text-sm'>
              {_('Version {{version}}', { version: getAppVersion() })} {`(${browserInfo})`}
            </p>
          </div>
          <div className='h-5'>
            {!updateStatus && (
              <span
                className='btn btn-xs btn-primary cursor-pointer p-1 text-xs'
                onClick={appService?.hasUpdater ? handleCheckUpdate : handleShowRecentUpdates}
              >
                {_('Check Update')}
              </span>
            )}
            {updateStatus === 'updated' && (
              <p className='text-neutral-content mt-2 text-xs'>{_('Already the latest version')}</p>
            )}
            {updateStatus === 'checking' && (
              <p className='text-neutral-content mt-2 text-xs'>{_('Checking for updates...')}</p>
            )}
            {updateStatus === 'error' && (
              <p className='text-error mt-2 text-xs'>{_('Error checking for updates')}</p>
            )}
          </div>
        </div>
        <div className='divider py-12 sm:py-2'></div>

        <div className='flex flex-col items-center px-4 text-center' dir='ltr'>
          <p className='text-neutral-content text-sm'>
            © {new Date().getFullYear()} Readup Team
          </p>
          <p className='text-neutral-content text-xs mt-2'>
              Licensed under the{' '}
              <Link
                href='https://www.gnu.org/licenses/agpl-3.0.html'
                className='text-blue-500 underline'
              >
                GNU Affero General Public License v3.0
              </Link>
          </p>
        </div>
      </div>
    </Dialog>
  );
};
