import React from 'react';
import { RiFontSize } from 'react-icons/ri';

import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import Button from '@/components/Button';

interface SettingsTogglerProps {
  bookKey: string;
}

const SettingsToggler: React.FC<SettingsTogglerProps> = ({ bookKey }) => {
  const _ = useTranslation();
  const { setHoveredBookKey } = useReaderStore();
  const { isFontLayoutSettingsDialogOpen, setFontLayoutSettingsDialogOpen } = useSettingsStore();
  const { setSettingsDialogBookKey } = useSettingsStore();
  const handleToggleSettings = () => {
    setHoveredBookKey('');
    setSettingsDialogBookKey(bookKey);
    setFontLayoutSettingsDialogOpen(!isFontLayoutSettingsDialogOpen);
  };
  return (
    <Button
      icon={<RiFontSize className='text-base-content' />}
      onClick={handleToggleSettings}
      tooltip={_('Font & Layout')}
      tooltipDirection='bottom'
      label={_('Font & Layout')}
    ></Button>
  );
};

export default SettingsToggler;
