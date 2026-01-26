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
import Select from '@/components/Select';
import { HighlightColor } from '@/types/book';
import { HIGHLIGHT_COLOR_HEX } from '@/services/constants';
import { saveViewSettings } from '@/helpers/settings';
import { useResetViewSettings } from '@/hooks/useResetSettings';
import { useEinkMode } from '@/hooks/useEinkMode';
import ThemeEditor from './ThemeEditor';
import ColorInput from './ColorInput';
import { SettingsPanelPanelProp } from './SettingsDialog';
import ReadingRulerSettings from './ReadingRulerSettings';

const ColorPanel: React.FC<SettingsPanelPanelProp> = ({ bookKey, onRegisterReset }) => {
  const _ = useTranslation();
  const { 
    themeMode, themeColor, isDarkMode, setThemeMode, setThemeColor, saveCustomTheme 
  } = useThemeStore();
  const { envConfig, appService } = useEnv();
  const { settings, setSettings } = useSettingsStore();
  const { getView, getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey) || settings.globalViewSettings;
  const { applyEinkMode } = useEinkMode();
  const [isEink, setIsEink] = useState(viewSettings.isEink);
  const [invertImgColor, setInvertImgColor] = useState(viewSettings.invertImgColor);

  const iconSize16 = useResponsiveSize(16);
  const iconSize24 = useResponsiveSize(24);
  const [editTheme, setEditTheme] = useState<CustomTheme | null>(null);
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [showCustomThemeEditor, setShowCustomThemeEditor] = useState(false);
  const [overrideColor, setOverrideColor] = useState(viewSettings.overrideColor);
  const [ttsHighlightColor, setTtsHighlightColor] = useState(viewSettings.ttsHighlightColor);
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
      isEink: setIsEink,
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
    saveViewSettings(envConfig, bookKey, 'isEink', isEink);
    if (isEink) {
      getView(bookKey)?.renderer.setAttribute('eink', '');
    } else {
      getView(bookKey)?.renderer.removeAttribute('eink');
    }
    applyEinkMode(isEink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEink]);

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
        isCustomizale: true,
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
          <div className='flex items-center justify-between'>
            <b className='font-medium'>{_('Theme Mode')}</b>
            <div className='flex gap-4'>
              <div className='tooltip tooltip-bottom' data-tip={_('Light Mode')}>
                <button
                  className={`btn btn-ghost btn-circle btn-sm ${themeMode === 'light' ? 'btn-active bg-base-300' : ''}`}
                  onClick={() => setThemeMode('light')}
                >
                  <MdOutlineLightMode />
                </button>
              </div>
              <div className='tooltip tooltip-bottom' data-tip={_('Dark Mode')}>
                <button
                  className={`btn btn-ghost btn-circle btn-sm ${themeMode === 'dark' ? 'btn-active bg-base-300' : ''}`}
                  onClick={() => setThemeMode('dark')}
                >
                  <MdOutlineDarkMode />
                </button>
              </div>
              <div className='tooltip tooltip-bottom' data-tip={_('Auto Mode')}>
                <button
                  className={`btn btn-ghost btn-circle btn-sm ${themeMode === 'auto' ? 'btn-active bg-base-300' : ''}`}
                  onClick={() => setThemeMode('auto')}
                >
                  <GrSystem />
                </button>
              </div>
            </div>
          </div>

          {(appService?.isAndroidApp || appService?.appPlatform === 'web') && (
            <div className='flex items-center justify-between'>
              <b className=''>{_('E-Ink Mode')}</b>
              <input
                type='checkbox'
                className='toggle toggle-success h-5'
                checked={isEink}
                onChange={() => setIsEink(!isEink)}
              />
            </div>
          )}

          <div className='flex items-center justify-between'>
            <b className=''>{_('Invert Image Colors')}</b>
            <input
              type='checkbox'
              className='toggle toggle-success h-5'
              checked={invertImgColor}
              onChange={() => setInvertImgColor(!invertImgColor)}
            />
          </div>

          <div className='flex items-center justify-between'>
            <b className=''>{_('Override Book Color')}</b>
            <input
              type='checkbox'
              className='toggle toggle-success h-5'
              checked={overrideColor}
              onChange={() => setOverrideColor(!overrideColor)}
            />
          </div>

          <div className='flex items-center justify-between'>
            <b className=''>{_('Enable Code Highlighting')}</b>
            <input
              type='checkbox'
              className='toggle toggle-success h-5'
              checked={codeHighlighting}
              onChange={() => setcodeHighlighting(!codeHighlighting)}
            />
          </div>
          <div className='flex items-center justify-between'>
            <b className=''>{_('Code Language')}</b>
            <Select
              value={codeLanguage}
              onChange={(event) => setCodeLanguage(event.target.value as CodeLanguage)}
              options={CODE_LANGUAGES.map((lang) => ({
                value: lang,
                label: lang === 'auto-detect' ? _('Auto') : lang,
              }))}
              disabled={!codeHighlighting}
            />
          </div>

          <div className='flex items-center justify-between'>
            <b className='mb-2 font-medium'>{_('TTS Highlight Color')}</b>
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

          <div>
            <h2 className='mb-2 font-medium'>{_('Available Highlight Colors')}</h2>
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
          />

          <div>
            <h2 className='mb-2 font-medium'>{_('Theme Color')}</h2>
            <div className='grid grid-cols-3 gap-4'>
              {themes.concat(customThemes).map(({ name, label, colors, isCustomizale }) => (
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
                  {isCustomizale && themeColor === name && (
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
        </>
      )}
    </div>
  );
};

export default ColorPanel;
