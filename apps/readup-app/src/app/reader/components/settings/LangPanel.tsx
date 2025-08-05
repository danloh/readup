import React, { useEffect, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useAuth } from '@/context/AuthContext';
import { useReaderStore } from '@/store/readerStore';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { saveAndReload } from '@/utils/reload';
import { TRANSLATOR_LANGS } from '@/services/constants';
import Select, { getLangOptions, LangSelect } from '@/components/Select';
import { getTranslators } from '@/services/translators';
import { saveViewSettings } from '../../utils/viewSettingsHelper';
import { SettingsPanelPanelProp } from './SettingsDialog';
import { useResetViewSettings } from '../../hooks/useResetSettings';

const LangPanel: React.FC<SettingsPanelPanelProp> = ({ bookKey, onRegisterReset }) => {
  const _ = useTranslation();
  const { token } = useAuth();
  const { envConfig } = useEnv();
  const { getViewSettings, setViewSettings } = useReaderStore();
  const { setUILang } = useThemeStore();
  const viewSettings = getViewSettings(bookKey)!;

  const [translationEnabled, setTranslationEnabled] = useState(viewSettings.translationEnabled!);
  const [translationProvider, setTranslationProvider] = useState(viewSettings.translationProvider!);
  const [translateTargetLang, setTranslateTargetLang] = useState(viewSettings.translateTargetLang!);
  const [showTranslateSource, setShowTranslateSource] = useState(viewSettings.showTranslateSource!);

  const resetToDefaults = useResetViewSettings();

  const handleReset = () => {
    resetToDefaults({
      translationEnabled: setTranslationEnabled,
      translationProvider: setTranslationProvider,
      translateTargetLang: setTranslateTargetLang,
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
      let label = t.label;
      if (t.authRequired && !token) {
        label = `${label} (${_('Login Required')})`;
      } else if (t.quotaExceeded) {
        label = `${label} (${_('Quota Exceeded')})`;
      }
      return { value: t.name, label };
    });
    return availableProviders;
  };

  const getCurrentTranslationProviderOption = () => {
    const value = translationProvider;
    const allProviders = getTranslationProviderOptions();
    const availableTranslators = getTranslators().filter(
      (t) => (t.authRequired ? !!token : true) && !t.quotaExceeded,
    );
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

  useEffect(() => {
    if (translationEnabled === viewSettings.translationEnabled) return;
    saveViewSettings(envConfig, bookKey, 'translationEnabled', translationEnabled, true, false);
    viewSettings.translationEnabled = translationEnabled;
    setViewSettings(bookKey, { ...viewSettings });
    if (!showTranslateSource && !translationEnabled) {
      saveAndReload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translationEnabled]);

  useEffect(() => {
    if (showTranslateSource === viewSettings.showTranslateSource) return;
    saveViewSettings(envConfig, bookKey, 'showTranslateSource', showTranslateSource, false, false);
    saveAndReload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTranslateSource]);

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='flex items-center justify-between'>
        <b className=''>{_('Interface Language')}</b>
        <LangSelect />
      </div>
      <div className='flex items-center justify-between'>
        <b className=''>{_('Enable Translation')}</b>
        <input
          type='checkbox'
          className='toggle toggle-success h-5'
          checked={translationEnabled}
          onChange={() => setTranslationEnabled(!translationEnabled)}
        />
      </div>
      <div className='flex items-center justify-between'>
        <b className=''>{_('Show Source Text')}</b>
        <input
          type='checkbox'
          className='toggle toggle-success h-5'
          checked={showTranslateSource}
          disabled={!translationEnabled}
          onChange={() => setShowTranslateSource(!showTranslateSource)}
        />
      </div>
      <div className='flex items-center justify-between'>
        <b className=''>{_('Translate To')}</b>
        <Select
          value={getCurrentTargetLangOption().value}
          onChange={handleSelectTargetLang}
          options={getLangOptions(TRANSLATOR_LANGS, _('System Language'))}
          disabled={!translationEnabled}
        />
      </div>
      <div className='w-full'>
        <Select
          className="w-full"
          value={getCurrentTranslationProviderOption().value}
          onChange={handleSelectTranslationProvider}
          options={getTranslationProviderOptions()}
          disabled={!translationEnabled}
        />
      </div>
    </div>
  );
};

export default LangPanel;
