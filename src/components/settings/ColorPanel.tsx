import clsx from 'clsx';
import React, { useState, useEffect } from 'react';
import { MdOutlineLightMode, MdOutlineDarkMode } from 'react-icons/md';
import { MdRadioButtonUnchecked, MdRadioButtonChecked } from 'react-icons/md';
import { CgColorPicker } from 'react-icons/cg';
import { GrSystem } from "react-icons/gr";
import { PiPlus } from 'react-icons/pi';
import {
  applyCustomTheme,
  CustomTheme,
  generateDarkPalette,
  generateLightPalette,
  Theme,
  themes,
} from '@/styles/themes';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { 
  CODE_LANGUAGES, CodeLanguage, manageSyntaxHighlighting 
} from '@/utils/highlightjs';
import { HighlightColor } from '@/types/book';
import { HIGHLIGHT_COLOR_HEX } from '@/services/constants';
import { saveViewSettings } from '@/helpers/settings';
import { useResetViewSettings } from '@/hooks/useResetSettings';
import ThemeEditor from './ThemeEditor';
import ColorInput from './ColorInput';
import { SettingsPanelPanelProp } from './SettingsDialog';
import ReadingRulerSettings from './ReadingRulerSettings';
import { 
  BoxedList, 
  SectionTitle, 
  SettingLabel, 
  SettingsRow, 
  SettingsSelect, 
  SettingsSwitchRow 
} from './primitives';

const ColorPanel: React.FC<SettingsPanelPanelProp> = ({ bookKey, onRegisterReset }) => {
  const _ = useTranslation();
  const { 
    themeMode, themeColor, isDarkMode, setThemeMode, setThemeColor, saveCustomTheme 
  } = useThemeStore();
  const { envConfig } = useEnv();
  const { settings, setSettings } = useSettingsStore();
  const { getView, getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey) || settings.globalViewSettings;
  const [invertImgColor, setInvertImgColor] = useState(viewSettings.invertImgColor);

  const iconSize16 = useResponsiveSize(16);
  const iconSize24 = useResponsiveSize(24);
  const [editTheme, setEditTheme] = useState<CustomTheme | null>(null);
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [showCustomThemeEditor, setShowCustomThemeEditor] = useState(false);
  const [overrideColor, setOverrideColor] = useState(viewSettings.overrideColor);
  
  const [codeHighlighting, setcodeHighlighting] = useState(viewSettings.codeHighlighting);
  const [codeLanguage, setCodeLanguage] = useState(viewSettings.codeLanguage);
  const [customHighlightColors, setCustomHighlightColors] = useState(
    settings.globalReadSettings.customHighlightColors,
  );

  const [readingRulerEnabled, setReadingRulerEnabled] = useState(viewSettings.readingRulerEnabled);
  const [readingRulerLines, setReadingRulerLines] = useState(viewSettings.readingRulerLines);
  const [readingRulerOpacity, setReadingRulerOpacity] = useState(viewSettings.readingRulerOpacity);
  const [readingRulerColor, setReadingRulerColor] = useState(viewSettings.readingRulerColor);

  const resetToDefaults = useResetViewSettings();

  const handleReset = () => {
    resetToDefaults({
      overrideColor: setOverrideColor,
      invertImgColor: setInvertImgColor,
      codeHighlighting: setcodeHighlighting,
      codeLanguage: setCodeLanguage,
      readingRulerEnabled: setReadingRulerEnabled,
      readingRulerLines: setReadingRulerLines,
      readingRulerOpacity: setReadingRulerOpacity,
    });
    setThemeColor('default');
    setThemeMode('auto');
    setCustomHighlightColors(HIGHLIGHT_COLOR_HEX);
  };

  useEffect(() => {
    onRegisterReset(handleReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (invertImgColor === viewSettings.invertImgColor) return;
    saveViewSettings(envConfig, bookKey, 'invertImgColor', invertImgColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invertImgColor]);

  useEffect(() => {
    if (overrideColor === viewSettings.overrideColor) return;
    saveViewSettings(envConfig, bookKey, 'overrideColor', overrideColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideColor]);

  useEffect(() => {
    let update = false; // check if we need to update syntax highlighting
    if (codeHighlighting !== viewSettings.codeHighlighting) {
      saveViewSettings(envConfig, bookKey, 'codeHighlighting', codeHighlighting);
      update = true;
    }
    if (codeLanguage !== viewSettings.codeLanguage) {
      saveViewSettings(envConfig, bookKey, 'codeLanguage', codeLanguage);
      update = true;
    }
    if (!update) return;
    const view = getView(bookKey);
    if (!view) return;
    const docs = view.renderer.getContents();
    docs.forEach(({ doc }) => manageSyntaxHighlighting(doc, viewSettings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeHighlighting, codeLanguage]);

  useEffect(() => {
    const customThemes = settings.globalReadSettings.customThemes ?? [];
    setCustomThemes(
      customThemes.map((customTheme) => ({
        name: customTheme.name,
        label: customTheme.label,
        colors: {
          light: generateLightPalette(customTheme.colors.light),
          dark: generateDarkPalette(customTheme.colors.dark),
        },
        isCustomizable: true,
      })),
    );
  }, [settings]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'readingRulerEnabled', readingRulerEnabled, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingRulerEnabled]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'readingRulerLines', readingRulerLines, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingRulerLines]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'readingRulerOpacity', readingRulerOpacity, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingRulerOpacity]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'readingRulerColor', readingRulerColor, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingRulerColor]);

  const handleSaveCustomTheme = (customTheme: CustomTheme) => {
    applyCustomTheme(customTheme);
    saveCustomTheme(envConfig, settings, customTheme);

    setSettings({ ...settings });
    setThemeColor(customTheme.name);
    setShowCustomThemeEditor(false);
  };

  const handleDeleteCustomTheme = (customTheme: CustomTheme) => {
    saveCustomTheme(envConfig, settings, customTheme, true);

    setSettings({ ...settings });
    setThemeColor('default');
    setShowCustomThemeEditor(false);
  };

  const handleEditTheme = (name: string) => {
    const customTheme = settings.globalReadSettings.customThemes.find((t) => t.name === name);
    if (customTheme) {
      setEditTheme(customTheme);
      setShowCustomThemeEditor(true);
    }
  };

  const modeSegments = [
    { 
      mode: 'auto' as const, 
      title: _('Auto Mode'), 
      onClick: () => setThemeMode('light'), 
      icon: <GrSystem /> },
    {
      mode: 'light' as const,
      title: _('Light Mode'),
      onClick: () => setThemeMode('light'),
      icon: <MdOutlineLightMode />,
    },
    {
      mode: 'dark' as const,
      title: _('Dark Mode'),
      onClick: () => setThemeMode('dark'),
      icon: <MdOutlineDarkMode />,
    },
  ];

  return (
    <div className='my-4 w-full space-y-4'>
      {showCustomThemeEditor ? (
        <ThemeEditor
          customTheme={editTheme}
          onSave={handleSaveCustomTheme}
          onDelete={handleDeleteCustomTheme}
          onCancel={() => setShowCustomThemeEditor(false)}
        />
      ) : (
        <>
          <div 
            className='flex items-center justify-between px-4' 
            data-setting-id='settings.color.themeMode'
          >
            <SettingLabel>{_('Theme Mode')}</SettingLabel>
            <div
              role='radiogroup'
              aria-label={_('Theme Mode')}
              className='bg-base-200 eink-bordered inline-flex items-center rounded-full p-1'
            >
              {modeSegments.map(({ mode, title, onClick, icon }) => {
                const active = themeMode === mode;
                return (
                  <button
                    key={mode}
                    type='button'
                    role='radio'
                    aria-checked={active}
                    aria-label={title}
                    title={title}
                    onClick={onClick}
                    className={clsx(
                      'flex h-9 min-w-[2.75rem] items-center justify-center rounded-full px-3 text-lg transition-colors',
                      'focus-visible:ring-base-content/15 focus-visible:outline-none focus-visible:ring-2',
                      active
                        ? 'bg-base-300 text-base-content eink-inverted shadow-sm'
                        : 'text-base-content/60 hover:text-base-content',
                    )}
                  >
                    {icon}
                  </button>
                );
              })}
            </div>
          </div>

          <label 
            data-setting-id='settings.color.invertImageColors'
            className={clsx(
              'flex items-center justify-between px-4',
              !isDarkMode && 'cursor-not-allowed opacity-50',
              isDarkMode && 'cursor-pointer',
            )}
          >
            <SettingLabel>{_('Invert Image Colors')}</SettingLabel>
            <input
              type='checkbox'
              className='toggle toggle-success h-5'
              checked={invertImgColor}
              onChange={() => setInvertImgColor(!invertImgColor)}
            />
          </label>

          <label 
            data-setting-id='settings.color.overrideBookColor'
            className='flex cursor-pointer items-center justify-between px-4'
          >
            <SettingLabel>{_('Override Book Color')}</SettingLabel>
            <input
              type='checkbox'
              className='toggle toggle-success h-5'
              checked={overrideColor}
              onChange={() => setOverrideColor(!overrideColor)}
            />
          </label>

          <div data-setting-id='settings.color.themeColor'>
            <SectionTitle className='mb-2'>{_('Theme Color')}</SectionTitle>
            <div className='grid grid-cols-3 gap-4'>
              {themes.concat(customThemes).map(({ name, label, colors, isCustomizable }) => (
                <button
                  key={name}
                  tabIndex={0}
                  onClick={() => setThemeColor(name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setThemeColor(name);
                    }
                    e.stopPropagation();
                  }}
                  className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg px-2 py-4 shadow-md ${
                    themeColor === name ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
                  }`}
                  style={{
                    backgroundColor: isDarkMode
                      ? colors.dark['base-100']
                      : colors.light['base-100'],
                    color: isDarkMode ? colors.dark['base-content'] : colors.light['base-content'],
                  }}
                >
                  <input
                    aria-label={_(label)}
                    type='radio'
                    name='theme'
                    value={name}
                    checked={themeColor === name}
                    onChange={() => setThemeColor(name)}
                    className='hidden'
                  />
                  {themeColor === name ? (
                    <MdRadioButtonChecked size={iconSize24} />
                  ) : (
                    <MdRadioButtonUnchecked size={iconSize24} />
                  )}
                  <span className='max-w-full truncate'>{_(label)}</span>
                  {isCustomizable && themeColor === name && (
                    <button onClick={() => handleEditTheme(name)}>
                      <CgColorPicker size={iconSize16} className='absolute right-2 top-2' />
                    </button>
                  )}
                </button>
              ))}
              <button
                className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-2 py-4 shadow-md`}
                onClick={() => setShowCustomThemeEditor(true)}
              >
                <PiPlus size={iconSize24} />
                <span className='max-w-full truncate'>{_('Custom')}</span>
              </button>
            </div>
          </div>

          <div data-setting-id='settings.color.highlightColors'>
            <SectionTitle className='mb-2'>{_('Highlight Colors')}</SectionTitle>
            <div className='card border-base-200 bg-base-100 overflow-visible border p-4 shadow'>
              <div className='grid grid-cols-3 gap-2 sm:grid-cols-5'>
                {(['red', 'violet', 'blue', 'green', 'yellow'] as HighlightColor[]).map(
                  (color, index, array) => {
                    const position =
                      index === 0 ? 'left' : index === array.length - 1 ? 'right' : 'center';
                    return (
                      <div key={color} className='flex flex-col items-center gap-2'>
                        <div
                          className='border-base-300 h-8 w-8 rounded-full border-2 shadow-sm'
                          style={{ backgroundColor: customHighlightColors[color] }}
                        />
                        <ColorInput
                          label=''
                          value={customHighlightColors[color]}
                          compact={true}
                          pickerPosition={position}
                          onChange={(value: string) => {
                            customHighlightColors[color] = value;
                            setCustomHighlightColors({ ...customHighlightColors });
                            settings.globalReadSettings.customHighlightColors =
                              customHighlightColors;
                            setSettings(settings);
                          }}
                        />
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>

          <ReadingRulerSettings
            enabled={readingRulerEnabled}
            lines={readingRulerLines}
            opacity={readingRulerOpacity}
            color={readingRulerColor}
            onEnabledChange={setReadingRulerEnabled}
            onLinesChange={setReadingRulerLines}
            onOpacityChange={setReadingRulerOpacity}
            onColorChange={setReadingRulerColor}
            data-setting-id='settings.color.readingRuler'
          />

          <BoxedList 
            title={_('Code Highlighting')} 
            data-setting-id={'settings.color.codeHighlighting'}
          >
            <SettingsSwitchRow
              label={_('Enable Highlighting')}
              checked={codeHighlighting}
              onChange={() => setcodeHighlighting(!codeHighlighting)}
            />
            <SettingsRow label={_('Code Language')}>
              <SettingsSelect
                value={codeLanguage}
                onChange={(event) => setCodeLanguage(event.target.value as CodeLanguage)}
                ariaLabel={_('Code Language')}
                disabled={!codeHighlighting}
                options={CODE_LANGUAGES.map((lang) => ({
                  value: lang,
                  label: lang === 'auto-detect' ? _('Auto') : lang,
                }))}
              />
            </SettingsRow>
          </BoxedList>
        </>
      )}
    </div>
  );
};

export default ColorPanel;
