import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MdCheck } from 'react-icons/md';
import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { LibrarySortByType, LibraryViewModeType } from '@/types/settings';
import { navigateToLibrary } from '@/utils/nav';
import Menu from '@/components/Menu';
import MenuItem from '@/components/MenuItem';
import { saveSysSettings } from '@/helpers/settings';

interface ViewMenuProps {
  setIsDropdownOpen?: (isOpen: boolean) => void;
}

const ViewMenu: React.FC<ViewMenuProps> = ({ setIsDropdownOpen }) => {
  const _ = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();

  const viewMode = settings.libraryViewMode;
  const sortBy = settings.librarySortBy;
  const isAscending = settings.librarySortAscending;

  const viewOptions = [
    { label: _('List'), value: 'list' },
    { label: _('Grid'), value: 'grid' },
  ];

  const sortByOptions = [
    { label: _('Title'), value: 'title' },
    { label: _('Author'), value: 'author' },
    { label: _('Format'), value: 'format' },
    { label: _('Date Read'), value: 'updated' },
    { label: _('Date Added'), value: 'created' },
    { label: _('Date Published'), value: 'published' },
  ];

  const sortingOptions = [
    { label: _('Ascending'), value: true },
    { label: _('Descending'), value: false },
  ];

  const handleSetViewMode = async (value: LibraryViewModeType) => {
    await saveSysSettings(envConfig, 'libraryViewMode', value);
    setIsDropdownOpen?.(false);

    const params = new URLSearchParams(searchParams?.toString());
    params.set('view', value);
    navigateToLibrary(router, `${params.toString()}`);
  };

  const handleSetSortBy = async (value: LibrarySortByType) => {
    await saveSysSettings(envConfig, 'librarySortBy', value);
    setIsDropdownOpen?.(false);

    const params = new URLSearchParams(searchParams?.toString());
    params.set('sort', value);
    navigateToLibrary(router, `${params.toString()}`);
  };

  const handleSetSortAscending = async (value: boolean) => {
    await saveSysSettings(envConfig, 'librarySortAscending', value);
    setIsDropdownOpen?.(false);

    const params = new URLSearchParams(searchParams?.toString());
    params.set('order', value ? 'asc' : 'desc');
    navigateToLibrary(router, `${params.toString()}`);
  };

  return (
    <Menu
      label={_('View Menu')}
      className='view-menu dropdown-content no-triangle z-20 mt-2 shadow-2xl'
      onCancel={() => setIsDropdownOpen?.(false)}
    >
      {viewOptions.map((option) => (
        <MenuItem
          key={option.value}
          label={option.label}
          buttonClass='h-8'
          Icon={viewMode === option.value ? MdCheck : undefined}
          onClick={() => handleSetViewMode(option.value as LibraryViewModeType)}
        />
      ))}
      <hr aria-hidden='true' className='border-base-200 my-1' />
      <MenuItem
        label={_('Sort by...')}
        buttonClass='h-8'
        labelClass='text-sm sm:text-xs'
        disabled
      />
      {sortByOptions.map((option) => (
        <MenuItem
          key={option.value}
          label={option.label}
          buttonClass='h-8'
          Icon={sortBy === option.value ? MdCheck : undefined}
          onClick={() => handleSetSortBy(option.value as LibrarySortByType)}
        />
      ))}
      <hr aria-hidden='true' className='border-base-200 my-1' />
      {sortingOptions.map((option) => (
        <MenuItem
          key={option.value.toString()}
          label={option.label}
          buttonClass='h-8'
          Icon={isAscending === option.value ? MdCheck : undefined}
          onClick={() => handleSetSortAscending(option.value)}
        />
      ))}
    </Menu>
  );
};

export default ViewMenu;
