import clsx from 'clsx';
import React from 'react';
import { Insets } from '@/types/misc';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { eventDispatcher } from '@/utils/event';

interface SectionInfoProps {
  bookTitle?: string;
  section?: string;
  bookKey: string;
  showDoubleBorder: boolean;
  isScrolled: boolean;
  isVertical: boolean;
  isEink: boolean;
  horizontalGap: number;
  contentInsets: Insets;
  gridInsets: Insets;
}

const SectionInfo: React.FC<SectionInfoProps> = ({
  bookTitle,
  section,
  bookKey,
  showDoubleBorder,
  isScrolled,
  isVertical,
  isEink,
  horizontalGap,
  contentInsets,
  gridInsets,
}) => {
  const { appService } = useEnv();
  const { hoveredBookKey, getView, getViewSettings, setHoveredBookKey } = useReaderStore();
  const { systemUIVisible, statusBarHeight } = useThemeStore();
  const viewSettings = getViewSettings(bookKey)!;
  const topInset = Math.max(
    gridInsets.top,
    appService?.isAndroidApp && systemUIVisible ? statusBarHeight / 2 : 0,
  );

  const handleNotchClick = () => {
    if (eventDispatcher.dispatchSync('iframe-single-click')) return;
    if (isScrolled) {
      getView(bookKey)?.renderer.scrollToAnchor?.(0, 'anchor', true);
    }
  };

  const handleSectionClick = () => {
    if (eventDispatcher.dispatchSync('iframe-single-click')) return;
    setHoveredBookKey(bookKey);
  };

  return (
    <>
      <div
        role='none'
        tabIndex={-1}
        onClick={handleNotchClick}
        className={clsx(
          'notch-area absolute inset-0 z-10',
          isScrolled && !isVertical && 'notch-masked bg-base-100',
        )}
        style={{ clipPath: `inset(0 0 calc(100% - ${topInset}px) 0)`, }}
      />
      <div
        role='none'
        tabIndex={-1}
        onClick={handleSectionClick}
        className={clsx(
          'sectioninfo absolute flex items-center overflow-hidden font-sans',
          isEink ? 'text-sm font-normal' : 'text-neutral-content text-xs font-light',
          isVertical ? 'writing-vertical-rl max-h-[85%]' : 'top-0',
        )}
        style={
          isVertical
            ? {
                top: `${(contentInsets.top - gridInsets.top) * 1.5}px`,
                bottom: `${(contentInsets.bottom - gridInsets.bottom) * 1.5}px`,
                right: showDoubleBorder
                  ? `calc(${contentInsets.right}px)`
                  : `calc(${Math.max(0, contentInsets.right - 32)}px)`,
                width: showDoubleBorder ? '32px' : `${contentInsets.right}px`,
              }
            : {
                top: `${topInset}px`,
                paddingInline: `calc(${horizontalGap / 2}% + ${contentInsets.left / 2}px)`,
                width: '100%',
                height: `${viewSettings.marginTopPx}px`,
              }
        }
      >
        <span
          aria-label={`${bookTitle ? `${bookTitle} § ` : ''}${section || ''}`}
          className={clsx(
            'text-center',
            isVertical ? '' : 'line-clamp-1',
            !isVertical &&
              (hoveredBookKey == bookKey || (hoveredBookKey && appService?.isMobile)) &&
              'hidden',
          )}
        >
          {`${bookTitle ? `${bookTitle} § ` : ''}${section || ''}`}
        </span>
      </div>
    </>
  );
};

export default SectionInfo;
