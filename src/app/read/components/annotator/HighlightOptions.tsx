import clsx from 'clsx';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { FaCheck } from 'react-icons/fa';
import { MdLibraryAddCheck } from 'react-icons/md';

import { HighlightColor, HighlightStyle } from '@/types/book';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeStore } from '@/store/themeStore';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { saveSysSettings } from '@/helpers/settings';
import { useEnv } from '@/context/EnvContext';
import { stubTranslation as _ } from '@/utils/misc';
import { useTranslation } from '@/hooks/useTranslation';

const styles = [_('highlight'), _('underline'), _('squiggly')] as HighlightStyle[];
const defaultColors = [
  _('red'),
  _('violet'),
  _('blue'),
  _('green'),
  _('yellow'),
] as HighlightColor[];

interface HighlightOptionsProps {
  isVertical: boolean;
  popupWidth: number;
  popupHeight: number;
  triangleDir: 'up' | 'down' | 'left' | 'right';
  selectedStyle: HighlightStyle;
  selectedColor: HighlightColor;
  onHandleHighlight: (update: boolean) => void;
  globalToggleAvailable?: boolean;
  globalToggleActive?: boolean;
  onToggleGlobal?: () => void;
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
  globalToggleAvailable = false,
  globalToggleActive = false,
  onToggleGlobal,
}) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const { isDarkMode } = useThemeStore();
  const globalReadSettings = settings.globalReadSettings;
  const isEink = settings.globalViewSettings.isEink;
  const isColorEink = settings.globalViewSettings.isColorEink;
  const isBwEink = isEink && !isColorEink;
  const einkBgColor = isDarkMode ? '#000000' : '#ffffff';
  const einkFgColor = isDarkMode ? '#ffffff' : '#000000';
  const customColors = globalReadSettings.customHighlightColors;
  const [selectedStyle, setSelectedStyle] = React.useState<HighlightStyle>(_selectedStyle);
  const [selectedColor, setSelectedColor] = React.useState<HighlightColor>(_selectedColor);
  const size16 = useResponsiveSize(16);
  const size28 = useResponsiveSize(28);
  const highlightOptionsHeightPx = useResponsiveSize(OPTIONS_HEIGHT_PIX);
  const highlightOptionsPaddingPx = useResponsiveSize(OPTIONS_PADDING_PIX);
  const optionsRef = useRef<HTMLDivElement>(null);
  const preferBefore = triangleDir === 'up' || triangleDir === 'left';
  const [placeBefore, setPlaceBefore] = useState(preferBefore);
  const optionsOffset = highlightOptionsHeightPx + highlightOptionsPaddingPx;

  useLayoutEffect(() => {
    const popup = optionsRef.current?.offsetParent;
    const frame = popup instanceof HTMLElement ? popup.offsetParent : null;
    if (!popup || !frame) return;
    const updatePlacement = () => {
      const rect = popup.getBoundingClientRect();
      const bounds = frame.getBoundingClientRect();
      const before = isVertical
        ? rect.left - Math.max(0, bounds.left)
        : rect.top - Math.max(0, bounds.top);
      const after = isVertical
        ? Math.min(window.innerWidth, bounds.right) - rect.right
        : Math.min(window.innerHeight, bounds.bottom) - rect.bottom;
      // The toolbar is clamped separately. Keep its floating style/color row
      // inside the book cell too, even when the selection fills the page.
      setPlaceBefore(
        preferBefore
          ? before >= optionsOffset || before >= after
          : after < optionsOffset && before > after,
      );
    };
    updatePlacement();
    // Popup adjusts its position after measuring its height; selection drags
    // and scrolling also move it without resizing the options themselves.
    const observer = new MutationObserver(updatePlacement);
    observer.observe(popup, { attributes: true, attributeFilter: ['style'] });
    const resizeObserver = new ResizeObserver(updatePlacement);
    resizeObserver.observe(frame);
    window.addEventListener('resize', updatePlacement);
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePlacement);
    };
  }, [isVertical, preferBefore, optionsOffset]);

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
      ref={optionsRef}
      className={clsx(
        'highlight-options absolute flex items-center justify-between',
        isVertical ? 'flex-col' : 'flex-row',
      )}
      style={{
        width: `${popupWidth}px`,
        height: `${popupHeight}px`,
        ...(isVertical
          ? { left: `${optionsOffset * (placeBefore ? -1 : 1)}px` }
          : { top: `${optionsOffset * (placeBefore ? -1 : 1)}px` }),
      }}
    >
      <div
        className={clsx('flex gap-2', isVertical ? 'flex-col' : 'flex-row')}
        style={isVertical ? { width: size28 } : { height: size28 }}
      >
        {styles.map((style) => (
          <button
            key={style}
            aria-label={_('Select {{style}} style', { style: _(style) })}
            onClick={() => handleSelectStyle(style)}
            className='not-eink:bg-gray-700 eink-bordered flex items-center justify-center rounded-full p-0'
            style={{ width: size28, height: size28, minHeight: size28 }}
          >
            <div
              style={{
                width: size16,
                height: size16,
                ...(style === 'highlight' &&
                  selectedStyle === 'highlight' && {
                    backgroundColor: isBwEink ? einkFgColor : customColors[selectedColor],
                    color: isBwEink ? einkBgColor : '#d1d5db',
                    paddingTop: '1px',
                  }),
                ...(style === 'highlight' &&
                  selectedStyle !== 'highlight' && {
                    backgroundColor: '#d1d5db',
                    paddingTop: '1px',
                  }),
                ...((style === 'underline' || style === 'squiggly') && {
                  color: isBwEink ? einkFgColor : '#d1d5db',
                  textDecoration: 'underline',
                  textDecorationColor:
                    selectedStyle === style
                      ? isBwEink
                        ? einkFgColor
                        : customColors[selectedColor]
                      : '#d1d5db',
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

      {globalToggleAvailable && (
        <button
          type='button'
          aria-label={_('Apply to every occurrence in the book')}
          aria-pressed={globalToggleActive}
          title={_('Apply to every occurrence in the book')}
          onClick={() => onToggleGlobal?.()}
          className={clsx(
            'not-eink:bg-gray-700 eink-bordered flex items-center justify-center rounded-full p-0 transition-colors',
            globalToggleActive
              ? 'not-eink:text-blue-400'
              : 'not-eink:text-gray-400 hover:not-eink:text-gray-200',
          )}
          style={{ width: size28, height: size28, minHeight: size28 }}
        >
          <MdLibraryAddCheck size={size16} />
        </button>
      )}

      <div
        className={clsx(
          'not-eink:bg-gray-700 eink-bordered flex items-center justify-center gap-2 rounded-3xl',
          isVertical ? 'flex-col py-2' : 'flex-row px-2',
        )}
        style={isVertical ? { width: size28 } : { height: size28 }}
      >
        {defaultColors
          .filter((c) => (isBwEink ? selectedColor === c : true))
          .map((color) => (
            <button
              key={color}
              aria-label={_('Select {{color}} color', { color: _(color) })}
              onClick={() => handleSelectColor(color)}
              style={{
                width: size16,
                height: size16,
                backgroundColor: isBwEink ? einkFgColor : customColors[color] || color,
              }}
              className='flex items-center justify-center rounded-full p-0'
            >
              {selectedColor === color && (
                <FaCheck
                  size={size16}
                  className={clsx(!isBwEink && 'text-base-content')}
                  style={isBwEink ? { color: einkBgColor } : undefined}
                />
              )}
            </button>
          ))
        }
      </div>
    </div>
  );
};

export default HighlightOptions;
