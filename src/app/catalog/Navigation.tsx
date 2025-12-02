'use client';

import clsx from 'clsx';
import { useCallback } from 'react';
import { IoChevronBack, IoChevronForward, IoHome } from 'react-icons/io5';
import { RiToolsFill } from 'react-icons/ri';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useTrafficLight } from '@/hooks/useTrafficLight';

interface NavigationProps {
  currentURL: string;
  startURL?: string;
  onNavigate: (url: string) => void;
  onBack?: () => void;
  onForward?: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onShowCatalog?: () => void;
}

export function Navigation({
  startURL,
  onNavigate,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  onShowCatalog,
}: NavigationProps) {
  const _ = useTranslation();
  const { appService } = useEnv();

  const { isTrafficLightVisible } = useTrafficLight();

  const handleGoHome = useCallback(() => {
    if (startURL) {
      onNavigate(startURL);
    }
  }, [startURL, onNavigate]);

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
        <button className='btn btn-ghost btn-sm' onClick={handleGoHome} title={_('Home')}>
          <IoHome className='h-5 w-5' />
        </button>
      </div>
    </header>
  );
}
