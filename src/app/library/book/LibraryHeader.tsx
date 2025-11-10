import clsx from 'clsx';
import React, { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSearch } from 'react-icons/fa';
import { PiDotsThreeCircle } from 'react-icons/pi';
import { LiaFileImportSolid } from 'react-icons/lia';
import { MdArrowBackIosNew } from 'react-icons/md';
import { IoMdCloseCircle } from 'react-icons/io';

import { useTranslation } from '@/hooks/useTranslation';
import { useLibraryStore } from '@/store/libraryStore';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { navigateToLibrary } from '@/utils/nav';
import { debounce } from '@/utils/debounce';
import Dropdown from '@/components/Dropdown';
import ViewMenu from './ViewMenu';

interface LibraryHeaderProps {
  onImportBooks: () => void;
}

const LibraryHeader: React.FC<LibraryHeaderProps> = ({onImportBooks}) => {
  const _ = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentBookshelf } = useLibraryStore();

  const [searchQuery, setSearchQuery] = useState(searchParams?.get('q') ?? '');

  const iconSize18 = useResponsiveSize(18);
  const iconSize20 = useResponsiveSize(20);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdateQueryParam = useCallback(
    debounce((value: string) => {
      const params = new URLSearchParams(searchParams?.toString());
      if (value) {
        params.set('q', value);
      } else {
        params.delete('q');
      }
      router.push(`?${params.toString()}`);
    }, 500),
    [searchParams],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    debouncedUpdateQueryParam(newQuery);
  };

  const isInGroupView = !!searchParams?.get('group');
  const currentBooksCount = currentBookshelf.reduce(
    (acc, item) => acc + ('books' in item ? item.books.length : 1),
    0,
  );

  return (
    <div className='library-head bg-base-200 z-10 flex h-[48px] w-full items-center p-2'>
      <div className='flex w-full items-center justify-between space-x-6 sm:space-x-12'>
        <div className='exclude-title-bar-mousedown relative flex w-full items-center pl-4'>
          {isInGroupView && (
            <button
              onClick={() => {
                navigateToLibrary(router);
              }}
              className='ml-[-6px] mr-4 flex h-7 min-h-7 w-7 items-center p-0'
            >
              <div className='tooltip tooltip-bottom' data-tip={_('Go Back')}>
                <MdArrowBackIosNew size={iconSize20} />
              </div>
            </button>
          )}
          <div className='relative flex h-9 w-full items-center sm:h-7'>
            <span className='absolute left-3 text-base-content/50'>
              <FaSearch className='h-4 w-4' />
            </span>
            <input
              type='text'
              value={searchQuery}
              placeholder={
                currentBooksCount > 1
                  ? _('Search in {{count}} Book(s)...', {
                      count: currentBooksCount,
                    })
                  : _('Search Books...')
              }
              onChange={handleSearchChange}
              spellCheck='false'
              className={clsx(
                'input rounded-badge bg-base-300/50 h-9 w-full pl-10 pr-10 sm:h-7',
                'font-sans text-sm font-light',
                'placeholder:text-base-content/50',
                'border-none focus:outline-none focus:ring-0',
              )}
            />
          </div>
          <div className='absolute right-4 flex items-center space-x-2 text-base-content/50'>
            {searchQuery && (
              <button
                type='button'
                onClick={() => {
                  setSearchQuery('');
                  debouncedUpdateQueryParam('');
                }}
                className='text-base-content/40 hover:text-base-content/60 pe-1'
                aria-label={_('Clear Search')}
              >
                <IoMdCloseCircle className='h-4 w-4' />
              </button>
            )}
          </div>
        </div>
        <div className='flex h-full items-center gap-x-2'>
          <div className='tooltip tooltip-bottom' data-tip={_('Import Books')}>
            <button
              type='button'
              className='btn btn-ghost h-8 min-h-8 w-8 p-0'
              onClick={onImportBooks}
              aria-label={_('Import Books')}
            >
              <LiaFileImportSolid className='m-0.5 h-5 w-5' />
            </button>
          </div>
          <Dropdown
            className='exclude-title-bar-mousedown dropdown-bottom dropdown-end'
            buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0'
            toggleButton={<PiDotsThreeCircle size={iconSize18} />}
          >
            <ViewMenu />
          </Dropdown>
        </div>
      </div>
    </div>
  );
};

export default LibraryHeader;
