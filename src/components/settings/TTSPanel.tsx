import React, { useEffect, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useResetViewSettings } from '@/hooks/useResetSettings';
import { useTranslation } from '@/hooks/useTranslation';
import { saveViewSettings } from '@/helpers/settings';
import { SettingsPanelPanelProp } from './SettingsDialog';
import { TTSMediaMetadataMode } from '@/services/tts/types';
import { BoxedList, SectionTitle, SettingsRow, SettingsSelect } from './primitives';
import ColorInput from './ColorInput';

const TTSPanel: React.FC<SettingsPanelPanelProp> = ({ bookKey, onRegisterReset }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { getViewSettings } = useReaderStore();
  const { settings } = useSettingsStore();
  const viewSettings = getViewSettings(bookKey) || settings.globalViewSettings;

  const [ttsMediaMetadata, setTtsMediaMetadata] = useState<TTSMediaMetadataMode>(
    viewSettings.ttsMediaMetadata ?? 'sentence',
  );

  const [ttsHighlightColor, setTtsHighlightColor] = useState(viewSettings.ttsHighlightColor);

  const resetToDefaults = useResetViewSettings();

  const handleReset = () => {
    resetToDefaults({
      ttsMediaMetadata: setTtsMediaMetadata as React.Dispatch<React.SetStateAction<string>>,
    });
  };

  useEffect(() => {
    onRegisterReset(handleReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ttsMediaMetadata === viewSettings.ttsMediaMetadata) return;
    saveViewSettings(envConfig, bookKey, 'ttsMediaMetadata', ttsMediaMetadata, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsMediaMetadata]);

  const handleMediaMetadataChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setTtsMediaMetadata(event.target.value as TTSMediaMetadataMode);
  };

  return (
    <div className='my-4 w-full space-y-6'>
      <div 
        className='flex items-center justify-between'
        data-setting-id='settings.color.ttsHighlightStyle'
      >
        <SectionTitle className='mb-2'>{_('TTS Highlight Color')}</SectionTitle>
        <div className='flex items-center gap-2'>
          <div
            className='border-base-300 h-6 w-6 rounded-full border-2 shadow-sm'
            style={{ backgroundColor: ttsHighlightColor }}
          />
          <ColorInput
            label=''
            value={ttsHighlightColor}
            compact={true}
            pickerPosition='right'
            onChange={(value: string) => {
              setTtsHighlightColor(value);
              saveViewSettings(envConfig, bookKey, 'ttsHighlightColor', value);
            }}
          />
        </div>
      </div>

      <BoxedList title={_('Media Info')} data-setting-id='settings.tts.mediaMetadata'>
        <SettingsRow label={_('Update Frequency')}>
          <SettingsSelect
            value={ttsMediaMetadata}
            onChange={handleMediaMetadataChange}
            ariaLabel={_('Update Frequency')}
            options={[
              { value: 'sentence', label: _('Every Sentence') },
              { value: 'paragraph', label: _('Every Paragraph') },
              { value: 'chapter', label: _('Every Chapter') },
            ]}
          />
        </SettingsRow>
      </BoxedList>
    </div>
  );
};

export default TTSPanel;
