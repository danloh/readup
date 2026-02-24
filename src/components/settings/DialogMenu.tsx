import clsx from 'clsx';
import React from 'react';
import { MdCheck } from 'react-icons/md';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SettingsPanelType } from './SettingsDialog';
import MenuItem from '@/components/MenuItem';
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
  const { isFontLayoutSettingsGlobal, setFontLayoutSettingsGlobal } = useSettingsStore();

  const handleToggleGlobal = () => {
    setFontLayoutSettingsGlobal(!isFontLayoutSettingsGlobal);
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
        tooltip={isFontLayoutSettingsGlobal ? _('Apply to All Books') : _('Apply to This Book')}
        disabled={!bookKey}
        buttonClass='tooltip'
        Icon={isFontLayoutSettingsGlobal ? MdCheck : null}
        onClick={handleToggleGlobal}
      />
      <MenuItem label={resetLabel || _('Reset Settings')} onClick={handleResetToDefaults} />
    </Menu>
  );
};

export default DialogMenu;
