'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IoChevronBack, IoChevronForward, IoHome } from 'react-icons/io5';
import { IoMdCloseCircle } from 'react-icons/io';
import { FaSearch } from 'react-icons/fa';
import { RiToolsFill } from 'react-icons/ri';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { debounce } from '@/utils/debounce';
import { useSettingsStore } from '@/store/settingsStore';

interface NavigationProps {
  onBack?: () => void;
  onForward?: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoStart: () => void;
  onShowCatalog?: () => void;
  searchTerm?: string;
  onSearch: (queryTerm: string) => void;
  hasSearch: boolean;
}

export function Navigation({
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  onGoStart,
  onShowCatalog,
  onSearch,
  searchTerm,
  hasSearch = false,
}: NavigationProps) {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { settings } = useSettingsStore();
  const viewSettings = settings.globalViewSettings;

  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSearchQuery(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    if (hasSearch && inputRef.current) {
      inputRef.current.focus();
    }
  }, [hasSearch]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdateQueryParam = useCallback(
    debounce((value: string) => {
      if (value) {
        onSearch(value);
      }
    }, 1000),
    [onSearch],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    debouncedUpdateQueryParam(newQuery);
  };

  return (
    <header
      className={clsx(
        'navbar min-h-0 px-2',
        'flex h-[42px] w-full items-center',
        appService?.isMobile ? '' : 'border-base-100',
      )}
    >
      <div className={clsx('justify-start gap-1 sm:gap-3')}>
        <div className='flex gap-1'>
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
        <button className='btn btn-ghost btn-xs px-1' onClick={onGoStart} title={_('Home')}>
          <IoHome className='h-5 w-5' />
        </button>
        <button className='btn btn-ghost btn-xs px-1' onClick={onShowCatalog} title={_('Catalog')}>
          <RiToolsFill className='h-5 w-5' />
        </button>
      </div>
      <div className='flex-grow px-3 sm:px-5'>
        <div className='relative flex w-full items-center'>
          <span className='text-base-content/50 absolute left-3'>
            <FaSearch className='h-4 w-4' />
          </span>
          <input
            type='text'
            ref={inputRef}
            value={searchQuery}
            placeholder={_('Search in OPDS Catalog...')}
            disabled={!hasSearch}
            onChange={handleSearchChange}
            spellCheck='false'
            className={clsx(
              'input rounded-badge h-9 w-full pl-10 pr-4 sm:h-7',
              viewSettings?.isEink
                ? 'border-1 border-base-content focus:border-base-content'
                : 'bg-base-300/45 border-none',
              'font-sans text-sm font-light',
              'placeholder:text-base-content/50 truncate',
              'focus:outline-none focus:ring-0',
            )}
          />
          <div className='text-base-content/50 absolute right-2 flex items-center space-x-2 sm:space-x-4'>
            {searchQuery && (
              <button
                type='button'
                onClick={() => {
                  setSearchQuery('');
                  onGoStart();
                }}
                className='text-base-content/40 hover:text-base-content/60 pe-1'
                aria-label={_('Clear search')}
              >
                <IoMdCloseCircle className='h-4 w-4' />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
