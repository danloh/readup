import React, { useEffect, useState } from 'react';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useResetViewSettings } from '@/hooks/useResetSettings';
import { RELOAD_BEFORE_SAVED_TIMEOUT_MS,TRANSLATOR_LANGS } from '@/services/constants';
import { getLangOptions, LangSelect } from '@/components/Select';
import { getTranslators } from '@/services/translators';
import { saveViewSettings } from '@/helpers/settings';
import { SettingsPanelPanelProp } from './SettingsDialog';
import CustomDictionaries from './CustomDictionaries';
import { 
  BoxedList, 
  NavigationRow, 
  SettingsRow, 
  SettingsSelect, 
  SettingsSwitchRow 
} from './primitives';

const LangPanel: React.FC<SettingsPanelPanelProp> = ({ bookKey, onRegisterReset }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { getViewSettings, setViewSettings, recreateViewer } = useReaderStore();
  const { settings, activeSettingsItemId, setActiveSettingsItemId } = useSettingsStore();
  const { setUILang } = useThemeStore();
  const viewSettings = getViewSettings(bookKey) || settings.globalViewSettings;

  const [translationEnabled, setTranslationEnabled] = useState(viewSettings.translationEnabled);
  const [translationProvider, setTranslationProvider] = useState(viewSettings.translationProvider);
  const [translateTargetLang, setTranslateTargetLang] = useState(viewSettings.translateTargetLang);
  const [showTranslateSource, setShowTranslateSource] = useState(viewSettings.showTranslateSource);
  const [ttsReadAloudText, setTtsReadAloudText] = useState(viewSettings.ttsReadAloudText);
  const [showCustomDictionaries, setShowCustomDictionaries] = useState(false);

  // Deep-link: callers (e.g. the dictionary popup's manage icon) can set
  // activeSettingsItemId to `'settings.language.dictionaries.manage'` to
  // jump straight into the Manage Dictionaries sub-page on open. Clear the
  // id once consumed so SettingsDialog's scroll-to-element fallback
  // (which runs on a 100ms timeout) doesn't re-fire.
  useEffect(() => {
    if (activeSettingsItemId === 'settings.language.dictionaries.manage') {
      setShowCustomDictionaries(true);
      setActiveSettingsItemId(null);
    }
  }, [activeSettingsItemId, setActiveSettingsItemId]);

  const resetToDefaults = useResetViewSettings();

  const handleReset = () => {
    resetToDefaults({
      translationEnabled: setTranslationEnabled,
      translationProvider: setTranslationProvider,
      translateTargetLang: setTranslateTargetLang,
      showTranslateSource: setShowTranslateSource,
      ttsReadAloudText: setTtsReadAloudText,
    });
    setUILang('');
  };

  useEffect(() => {
    onRegisterReset(handleReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTranslationProviderOptions = () => {
    const translators = getTranslators();
    const availableProviders = translators.map((t) => {
      return { value: t.name, label: t.label };
    });
    return availableProviders;
  };

  const getCurrentTranslationProviderOption = () => {
    const value = translationProvider;
    const allProviders = getTranslationProviderOptions();
    const availableTranslators = getTranslators();
    const currentProvider = availableTranslators.find((t) => t.name === value)
      ? value
      : availableTranslators[0]?.name;
    return allProviders.find((p) => p.value === currentProvider) || allProviders[0]!;
  };

  const handleSelectTranslationProvider = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const option = event.target.value;
    setTranslationProvider(option);
    saveViewSettings(envConfig, bookKey, 'translationProvider', option, false, false);
    viewSettings.translationProvider = option;
    setViewSettings(bookKey, { ...viewSettings });
  };

  const getCurrentTargetLangOption = () => {
    const value = translateTargetLang;
    const availableOptions = getLangOptions(TRANSLATOR_LANGS, _('System Language'));
    return availableOptions.find((o) => o.value === value) || availableOptions[0]!;
  };

  const handleSelectTargetLang = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const option = event.target.value;
    setTranslateTargetLang(option);
    saveViewSettings(envConfig, bookKey, 'translateTargetLang', option, false, false);
    viewSettings.translateTargetLang = option;
    setViewSettings(bookKey, { ...viewSettings });
  };

  const handleSelectTTSText = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const option = event.target.value;
    setTtsReadAloudText(option);
    saveViewSettings(envConfig, bookKey, 'ttsReadAloudText', option, false, false);
  };

  const getTTSTextOptions = () => {
    return [
      { value: 'both', label: _('Source and Translated') },
      { value: 'translated', label: _('Translated Only') },
      { value: 'source', label: _('Source Only') },
    ];
  };

  useEffect(() => {
    if (translationEnabled === viewSettings.translationEnabled) return;
    saveViewSettings(envConfig, bookKey, 'translationEnabled', translationEnabled, true, false);
    if (!showTranslateSource && translationEnabled) {
      setTimeout(() => recreateViewer(envConfig, bookKey), RELOAD_BEFORE_SAVED_TIMEOUT_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translationEnabled]);

  useEffect(() => {
    if (showTranslateSource === viewSettings.showTranslateSource) return;
    saveViewSettings(envConfig, bookKey, 'showTranslateSource', showTranslateSource, false, false);
    setTimeout(() => recreateViewer(envConfig, bookKey), RELOAD_BEFORE_SAVED_TIMEOUT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTranslateSource]);

  useEffect(() => {
    if (ttsReadAloudText === viewSettings.ttsReadAloudText) return;
    saveViewSettings(envConfig, bookKey, 'ttsReadAloudText', ttsReadAloudText, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsReadAloudText]);

  if (showCustomDictionaries) {
    return (
      <div className='my-4 w-full'>
        <CustomDictionaries onBack={() => setShowCustomDictionaries(false)} />
      </div>
    );
  }

  return (
    <div className='my-4 w-full space-y-4'>
      <BoxedList title={_('Language')} data-setting-id='settings.language.interfaceLanguage'>
        <SettingsRow label={_('Language')}>
          <LangSelect />
        </SettingsRow>
      </BoxedList>

      <BoxedList
        title={_('Dictionaries')}
        data-setting-id='settings.language.dictionaries'
        cardClassName='overflow-hidden'
      >
        <NavigationRow
          title={_('Manage Dictionaries')}
          onClick={() => setShowCustomDictionaries(true)}
          className='h-14'
        />
      </BoxedList>

      <BoxedList title={_('Translation')} data-setting-id='settings.language.translationEnabled'>
        <SettingsSwitchRow
          label={_('Enable Translation')}
          checked={translationEnabled}
          onChange={() => setTranslationEnabled(!translationEnabled)}
          disabled={!bookKey}
        />
        <SettingsSwitchRow
          label={_('Show Source Text')}
          checked={showTranslateSource}
          onChange={() => setShowTranslateSource(!showTranslateSource)}
        />
        <SettingsRow label={_('TTS Text')} data-setting-id='settings.language.ttsTextTranslation'>
          <SettingsSelect
            value={ttsReadAloudText}
            onChange={handleSelectTTSText}
            ariaLabel={_('TTS Text')}
            options={getTTSTextOptions()}
          />
        </SettingsRow>
        <SettingsRow
          label={_('Translation Service')}
          data-setting-id='settings.language.translationProvider'
        >
          <SettingsSelect
            value={getCurrentTranslationProviderOption().value}
            onChange={handleSelectTranslationProvider}
            ariaLabel={_('Translation Service')}
            options={getTranslationProviderOptions()}
          />
        </SettingsRow>
        <SettingsRow label={_('Translate To')} data-setting-id='settings.language.targetLanguage'>
          <SettingsSelect
            value={getCurrentTargetLangOption().value}
            onChange={handleSelectTargetLang}
            ariaLabel={_('Translate To')}
            options={getLangOptions(TRANSLATOR_LANGS, _('System Language'))}
          />
        </SettingsRow>
      </BoxedList>
    </div>
  );
};

export default LangPanel;
