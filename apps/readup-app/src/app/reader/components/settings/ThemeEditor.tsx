import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { CustomTheme } from '@/styles/themes';
import { md5Fingerprint } from '@/utils/md5';
import { CUSTOM_THEME_TEMPLATES } from '@/services/constants';
import { useSettingsStore } from '@/store/settingsStore';
import clsx from 'clsx';
import ColorInput from './ColorInput';

type ThemeEditorProps = {
  customTheme: CustomTheme | null;
  onSave: (customTheme: CustomTheme) => void;
  onDelete: (customTheme: CustomTheme) => void;
  onCancel: () => void;
};

const ThemeEditor: React.FC<ThemeEditorProps> = ({ customTheme, onSave, onDelete, onCancel }) => {
  const _ = useTranslation();
  const { settings } = useSettingsStore();
  const template =
    CUSTOM_THEME_TEMPLATES[Math.floor(Math.random() * CUSTOM_THEME_TEMPLATES.length)]!;
  const [lightTextColor, setLightTextColor] = useState(
    customTheme?.colors.light.fg || template.light.fg,
  );
  const [lightBackgroundColor, setLightBackgroundColor] = useState(
    customTheme?.colors.light.bg || template.light.bg,
  );
  const [lightPrimaryColor, setLightPrimaryColor] = useState(
    customTheme?.colors.light.primary || template.light.primary,
  );
  const [darkTextColor, setDarkTextColor] = useState(
    customTheme?.colors.dark.fg || template.dark.fg,
  );
  const [darkBackgroundColor, setDarkBackgroundColor] = useState(
    customTheme?.colors.dark.bg || template.dark.bg,
  );
  const [darkPrimaryColor, setDarkPrimaryColor] = useState(
    customTheme?.colors.dark.primary || template.dark.primary,
  );

  const [themeName, setThemeName] = useState(customTheme?.label || _('Custom Theme'));

  const ThemePreview: React.FC<{
    textColor: string;
    backgroundColor: string;
    primaryColor: string;
    label: string;
  }> = ({ textColor, backgroundColor, primaryColor, label }) => (
    <div className='mb-2 mt-4'>
      <label className='mb-1 block text-sm font-medium'>{label}</label>
      <div
        className='border-base-300 overflow-hidden rounded border p-2'
        style={{
          backgroundColor: backgroundColor,
          color: textColor,
        }}
      >
        <p className='mb-2 whitespace-pre-line text-xs'>
          {_(
            "All the world's a stage,\nAnd all the men and women merely players;\nThey have their exits and their entrances,\nAnd one man in his time plays many parts,\nHis acts being seven ages.\n\n— William Shakespeare",
          )}
          {'\n\n'}
          <span
            className='mt-4 cursor-pointer italic'
            style={{
              color: primaryColor,
            }}
          >
            {_("(from 'As You Like It', Act II)")}
          </span>
        </p>
      </div>
    </div>
  );

  const getCustomTheme = () => {
    return {
      name: md5Fingerprint(themeName),
      label: themeName,
      colors: {
        light: {
          fg: lightTextColor,
          bg: lightBackgroundColor,
          primary: lightPrimaryColor,
        },
        dark: {
          fg: darkTextColor,
          bg: darkBackgroundColor,
          primary: darkPrimaryColor,
        },
      },
    };
  };

  return (
    <div className='mt-6 rounded-lg'>
      <div className='mb-4'>
        <div className='w-full mb-4 flex flex-wrap items-center justify-center gap-2'>
          <button
            className='btn btn-sm text-success px-2'
            onClick={() => onSave(getCustomTheme())}
          >
            {_('Save')}
          </button>
          {settings.globalReadSettings.customThemes.find(
            (theme) => theme.name === md5Fingerprint(themeName),
          ) && (
            <button
              className={clsx('btn btn-warning btn-xs px-2')}
              onClick={() => onDelete(getCustomTheme())}
            >
              {_('Delete')}
            </button>
          )}
          <button className='btn btn-sm text-warning px-2' onClick={onCancel}>
            {_('Cancel')}
          </button>
        </div>
        <div className='w-full mb-4 flex items-center justify-between'>
          <input
            type='text'
            value={themeName}
            onChange={(e) => setThemeName(e.target.value)}
            className='bg-base-100 text-base-content border-base-200 w-full rounded border p-2 text-sm'
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='bg-base-200 rounded-lg p-3'>
          <h3 className='mb-3 text-center font-medium'>{_('Light Mode')}</h3>

          <ColorInput label={_('Text Color')} value={lightTextColor} onChange={setLightTextColor} />

          <ColorInput
            label={_('Background Color')}
            value={lightBackgroundColor}
            onChange={setLightBackgroundColor}
          />

          <ColorInput
            label={_('Link Color')}
            value={lightPrimaryColor}
            onChange={setLightPrimaryColor}
          />

          <ThemePreview
            textColor={lightTextColor}
            backgroundColor={lightBackgroundColor}
            primaryColor={lightPrimaryColor}
            label={_('Preview')}
          />
        </div>

        <div className='bg-base-300 rounded-lg p-3'>
          <h3 className='mb-3 text-center font-medium'>{_('Dark Mode')}</h3>

          <ColorInput label={_('Text Color')} value={darkTextColor} onChange={setDarkTextColor} />

          <ColorInput
            label={_('Background Color')}
            value={darkBackgroundColor}
            onChange={setDarkBackgroundColor}
          />

          <ColorInput
            label={_('Link Color')}
            value={darkPrimaryColor}
            onChange={setDarkPrimaryColor}
          />

          <ThemePreview
            textColor={darkTextColor}
            backgroundColor={darkBackgroundColor}
            primaryColor={darkPrimaryColor}
            label={_('Preview')}
          />
        </div>
      </div>
    </div>
  );
};

export default ThemeEditor;
