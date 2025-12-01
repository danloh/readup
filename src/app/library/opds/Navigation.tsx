'use client';

import clsx from 'clsx';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { BiLibrary } from 'react-icons/bi';
import { RiToolsFill } from 'react-icons/ri';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useTrafficLight } from '@/hooks/useTrafficLight';
import { navigateToLibrary } from '@/utils/nav';

interface NavigationProps {
  currentURL: string;
  onBack?: () => void;
  onForward?: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onShowCatalog?: () => void;
}

export function Navigation({
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  onShowCatalog,
}: NavigationProps) {
  const _ = useTranslation();
  const { appService } = useEnv();
  const router = useRouter();

  const { isTrafficLightVisible } = useTrafficLight();

  const handleGoLibrary = useCallback(() => {
    navigateToLibrary(router, '', {}, true);
  }, [router]);

  return (
    <header
      className={clsx(
        'navbar min-h-0 px-2',
        'flex h-[48px] w-full items-center',
        appService?.isMobile ? '' : 'border-base-300 bg-base-200 border-y',
      )}
    >
      <div className={clsx('navbar-start gap-1', isTrafficLightVisible && '!pl-16')}>
        {onBack && (
          <button
            className='btn btn-ghost btn-xs px-1 disabled:bg-transparent'
            onClick={onBack}
            disabled={!canGoBack}
            title={_('Back')}
          >
            <IoChevronBack className='h-5 w-5' />
          </button>
        )}
        {onForward && (
          <button
            className='btn btn-ghost btn-xs disabled:bg-transparent'
            onClick={onForward}
            disabled={!canGoForward}
            title={_('Forward')}
          >
            <IoChevronForward className='h-5 w-5' />
          </button>
        )}
      </div>

      <div className='navbar-center'>
        <b className='max-w-md truncate text-base font-semibold'>{_('OPDS Catalog')}</b>
      </div>

      <div className='navbar-end gap-2'>
        <button className='btn btn-ghost btn-xs' onClick={onShowCatalog} title={_('Catalog')}>
          <RiToolsFill className='h-5 w-5' />
        </button>
        <button className='btn btn-ghost btn-xs' onClick={handleGoLibrary} title={_('Library')}>
          <BiLibrary className='h-5 w-5' />
        </button>
      </div>
    </header>
  );
}
