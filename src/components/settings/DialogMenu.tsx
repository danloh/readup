import clsx from 'clsx';
import React from 'react';
import { MdCheck } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import { useReaderStore } from '@/store/readerStore';
import { useEnv } from '@/context/EnvContext';
import { saveViewSettings } from '@/helpers/settings';
import MenuItem from '@/components/MenuItem';
import { SettingsPanelType } from './SettingsDialog';
import Menu from '../Menu';

interface DialogMenuProps {
  bookKey: string;
  activePanel: SettingsPanelType;
  setIsDropdownOpen?: (open: boolean) => void;
  onReset: () => void;
  resetLabel?: string;
}

const DialogMenu: React.FC<DialogMenuProps> = ({ 
  bookKey,
  setIsDropdownOpen, 
  onReset, 
  resetLabel 
}) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey);
  const isSettingsGlobal = viewSettings?.isGlobal ?? true;

  const handleToggleGlobal = () => {
    saveViewSettings(envConfig, bookKey, 'isGlobal', !isSettingsGlobal, true, false);
    setIsDropdownOpen?.(false);
  };

  const handleResetToDefaults = () => {
    onReset();
    setIsDropdownOpen?.(false);
  };

  return (
    <Menu className={clsx('dialog-menu dropdown-content no-triangle z-20 mt-2 shadow-2xl')}>
      <MenuItem
        label={_('Global Settings')}
        tooltip={isSettingsGlobal ? _('Apply to All Books') : _('Apply to This Book')}
        disabled={!bookKey}
        buttonClass='tooltip'
        Icon={isSettingsGlobal ? MdCheck : null}
        onClick={handleToggleGlobal}
      />
      <MenuItem label={resetLabel || _('Reset Settings')} onClick={handleResetToDefaults} />
    </Menu>
  );
};

export default DialogMenu;
