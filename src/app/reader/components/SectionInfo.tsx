import clsx from 'clsx';
import React from 'react';
import { Insets } from '@/types/misc';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';

interface SectionInfoProps {
  bookTitle?: string;
  section?: string;
  bookKey: string;
  showDoubleBorder: boolean;
  isScrolled: boolean;
  isVertical: boolean;
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
  horizontalGap,
  contentInsets,
  gridInsets,
}) => {
  const { appService } = useEnv();
  const { hoveredBookKey, setHoveredBookKey } = useReaderStore();
  const { systemUIVisible, statusBarHeight } = useThemeStore();
  const topInset = Math.max(
    gridInsets.top,
    appService?.isAndroidApp && systemUIVisible ? statusBarHeight / 2 : 0,
  );

  return (
    <>
      <div
        className={clsx(
          'absolute left-0 right-0 top-0 z-10',
          isScrolled && !isVertical && 'bg-base-100',
        )}
        style={{ height: `${topInset}px` }}
      />
      <div
        onClick={() => setHoveredBookKey(bookKey)}
        className={clsx(
          'sectioninfo absolute flex items-center overflow-hidden',
          'text-neutral-content font-sans text-xs font-light',
          isVertical ? 'writing-vertical-rl max-h-[85%]' : 'top-0 h-[44px]',
          isScrolled && !isVertical && 'bg-base-100',
        )}
        role='none'
        style={
          isVertical
            ? {
                top: `${contentInsets.top * 1.5}px`,
                right: showDoubleBorder
                  ? `calc(${contentInsets.right}px)`
                  : `calc(${Math.max(0, contentInsets.right - 32)}px)`,
                width: showDoubleBorder ? '32px' : `${contentInsets.right}px`,
                height: `calc(100% - ${contentInsets.top + contentInsets.bottom}px)`,
              }
            : {
                top: `${topInset}px`,
                paddingInline: `calc(${horizontalGap / 2}% + ${contentInsets.left / 2}px)`,
                width: '100%',
              }
        }
      >
        <span
          aria-label={`${bookTitle ? `${bookTitle} § ` : ''}${section || ''}`}
          className={clsx(
            'text-center',
            isVertical ? '' : 'line-clamp-1',
            !isVertical && hoveredBookKey == bookKey && 'hidden',
          )}
        >
          {`${bookTitle ? `${bookTitle} § ` : ''}${section || ''}`}
        </span>
      </div>
    </>
  );
};

export default SectionInfo;
