'use client';

import clsx from 'clsx';
import { useCallback } from 'react';
import { IoChevronBack, IoChevronForward, IoHome, IoSearch } from 'react-icons/io5';
import { RiToolsFill } from 'react-icons/ri';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';

interface NavigationProps {
  currentURL: string;
  startURL?: string;
  onNavigate: (url: string) => void;
  onBack?: () => void;
  onForward?: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onShowCatalog?: () => void;
  onSearch: () => void;
  hasSearch: boolean;
}

export function Navigation({
  startURL,
  onNavigate,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  onShowCatalog,
  onSearch,
  hasSearch = false,
}: NavigationProps) {
  const _ = useTranslation();
  const { appService } = useEnv();

  const handleGoHome = useCallback(() => {
    if (startURL) {
      onNavigate(startURL);
    }
  }, [startURL, onNavigate]);

  const handleSearch = useCallback(() => {
    onSearch();
  }, [onSearch]);

  return (
    <header
      className={clsx(
        'navbar min-h-0 px-2',
        'flex h-[42px] w-full items-center',
        appService?.isMobile ? '' : 'border-base-300 bg-base-200 border-y',
      )}
    >
      <div className={clsx('navbar-start gap-1')}>
        {onBack && (
          <button
            className='btn btn-ghost btn-xs h-8 min-h-8 w-8 p-0 disabled:bg-transparent'
            onClick={onBack}
            disabled={!canGoBack}
            title={_('Back')}
          >
            <IoChevronBack className='h-5 w-5' />
          </button>
        )}
        {onForward && (
          <button
            className='btn btn-ghost btn-xs h-8 min-h-8 w-8 p-0 disabled:bg-transparent'
            onClick={onForward}
            disabled={!canGoForward}
            title={_('Forward')}
          >
            <IoChevronForward className='h-5 w-5' />
          </button>
        )}
      </div>
      <div className='navbar-end gap-2'>
        {hasSearch && (
          <button className='btn btn-ghost btn-sm' onClick={handleSearch} title={_('Search')}>
            <IoSearch className='h-5 w-5' />
          </button>
        )}
        <button 
          className='btn btn-ghost btn-xs h-8 min-h-8 w-8 p-0' 
          onClick={onShowCatalog} 
          title={_('Catalog')}
        >
          <RiToolsFill className='h-5 w-5' />
        </button>
        <button 
          className='btn btn-ghost btn-xs h-8 min-h-8 w-8 p-0' 
          onClick={handleGoHome} 
          title={_('Home')}
        >
          <IoHome className='h-5 w-5' />
        </button>
      </div>
    </header>
  );
}
