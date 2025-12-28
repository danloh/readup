import clsx from 'clsx';
import React from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { HighlightColor, HighlightStyle } from '@/types/book';
import { useSettingsStore } from '@/store/settingsStore';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { saveSysSettings } from '@/helpers/settings';
import { useEnv } from '@/context/EnvContext';

const styles = ['highlight', 'underline', 'squiggly'] as HighlightStyle[];
const colors = ['red', 'violet', 'blue', 'green', 'yellow'] as HighlightColor[];

interface HighlightOptionsProps {
  isVertical: boolean;
  popupWidth: number;
  popupHeight: number;
  triangleDir: 'up' | 'down' | 'left' | 'right';
  selectedStyle: HighlightStyle;
  selectedColor: HighlightColor;
  onHandleHighlight: (update: boolean) => void;
}

const OPTIONS_HEIGHT_PIX = 28;
const OPTIONS_PADDING_PIX = 16;

const HighlightOptions: React.FC<HighlightOptionsProps> = ({
  isVertical,
  popupWidth,
  popupHeight,
  triangleDir,
  selectedStyle: _selectedStyle,
  selectedColor: _selectedColor,
  onHandleHighlight,
}) => {
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const globalReadSettings = settings.globalReadSettings;
  const customColors = globalReadSettings.customHighlightColors;
  const [selectedStyle, setSelectedStyle] = React.useState<HighlightStyle>(_selectedStyle);
  const [selectedColor, setSelectedColor] = React.useState<HighlightColor>(_selectedColor);
  const size16 = useResponsiveSize(16);
  const size28 = useResponsiveSize(28);
  const highlightOptionsHeightPx = useResponsiveSize(OPTIONS_HEIGHT_PIX);
  const highlightOptionsPaddingPx = useResponsiveSize(OPTIONS_PADDING_PIX);

  const handleSelectStyle = async (style: HighlightStyle) => {
    const newGlobalReadSettings = { ...globalReadSettings, highlightStyle: style };
    await saveSysSettings(envConfig, 'globalReadSettings', newGlobalReadSettings);
    setSelectedStyle(style);
    setSelectedColor(globalReadSettings.highlightStyles[style]);
    onHandleHighlight(true);
  };

  const handleSelectColor = async (color: HighlightColor) => {
    const newGlobalReadSettings = {
      ...globalReadSettings,
      highlightStyle: selectedStyle,
      highlightStyles: { ...globalReadSettings.highlightStyles, [selectedStyle]: color },
    };
    await saveSysSettings(envConfig, 'globalReadSettings', newGlobalReadSettings);
    setSelectedColor(color);
    onHandleHighlight(true);
  };

  return (
    <div
      className={clsx(
        'highlight-options absolute flex items-center justify-between',
        isVertical ? 'flex-col' : 'flex-row',
      )}
      style={{
        width: `${popupWidth}px`,
        height: `${popupHeight}px`,
        ...(isVertical
          ? {
              left: `${
                (highlightOptionsHeightPx + highlightOptionsPaddingPx) *
                (triangleDir === 'left' ? -1 : 1)
              }px`,
            }
          : {
              top: `${
                (highlightOptionsHeightPx + highlightOptionsPaddingPx) *
                (triangleDir === 'up' ? -1 : 1)
              }px`,
            }),
      }}
    >
      <div
        className={clsx('flex gap-2', isVertical ? 'flex-col' : 'flex-row')}
        style={isVertical ? { width: size28 } : { height: size28 }}
      >
        {styles.map((style) => (
          <button
            key={style}
            onClick={() => handleSelectStyle(style)}
            className='flex items-center justify-center rounded-full bg-gray-700 p-0'
            style={{ width: size28, height: size28, minHeight: size28 }}
          >
            <div
              style={{
                width: size16,
                height: size16,
                ...(style === 'highlight' &&
                  selectedStyle === 'highlight' && {
                    backgroundColor: customColors[selectedColor],
                    paddingTop: '1px',
                  }),
                ...(style === 'highlight' &&
                  selectedStyle !== 'highlight' && {
                    backgroundColor: '#d1d5db',
                    paddingTop: '1px',
                  }),
                ...((style === 'underline' || style === 'squiggly') && {
                  color: '#d1d5db',
                  textDecoration: 'underline',
                  textDecorationColor:
                    selectedStyle === style ? customColors[selectedColor] : '#d1d5db',
                  ...(style === 'squiggly' && { textDecorationStyle: 'wavy' }),
                }),
              }}
              className='w-4 p-0 text-center leading-none'
            >
              T
            </div>
          </button>
        ))}
      </div>

      <div
        className={clsx(
          'flex items-center justify-center gap-2 rounded-3xl bg-gray-700',
          isVertical ? 'flex-col py-2' : 'flex-row px-2',
        )}
        style={isVertical ? { width: size28 } : { height: size28 }}
      >
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => handleSelectColor(color)}
            style={{
              width: size16,
              height: size16,
              backgroundColor: selectedColor !== color ? customColors[color] : 'transparent',
            }}
            className='rounded-full p-0'
          >
            {selectedColor === color && (
              <FaCheckCircle size={size16} style={{ fill: customColors[color] }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default HighlightOptions;
