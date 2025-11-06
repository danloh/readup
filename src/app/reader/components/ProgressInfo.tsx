import clsx from 'clsx';
import React from 'react';
import { Insets } from '@/types/misc';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { PageInfo, TimeInfo } from '@/types/book';

function formatReadingProgress(
  current: number | undefined,
  total: number | undefined,
  template: string,
): string {
  if (current !== undefined && total !== undefined && total > 0 && current >= 0) {
    return template
      .replace('{current}', String(current + 1))
      .replace('{total}', String(total))
      .replace('{percent}', (((current + 1) / total) * 100).toFixed(1));
  } else {
    return '';
  }
}

interface PageInfoProps {
  bookKey: string;
  bookFormat: string;
  section?: PageInfo;
  pageinfo?: PageInfo;
  timeinfo?: TimeInfo;
  horizontalGap: number;
  contentInsets: Insets;
  gridInsets: Insets;
}

const ProgressInfoView: React.FC<PageInfoProps> = ({
  bookKey,
  bookFormat,
  section,
  pageinfo,
  timeinfo,
  horizontalGap,
  contentInsets,
  gridInsets,
}) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { getView, getViewSettings } = useReaderStore();
  const view = getView(bookKey);
  const viewSettings = getViewSettings(bookKey)!;

  const showDoubleBorder = viewSettings.vertical && viewSettings.doubleBorder;
  const isScrolled = viewSettings.scrolled;
  const isVertical = viewSettings.vertical;

  const formatTemplate = isVertical
    ? '{current} · {total} · {percent}%'
    : '{current} / {total} / {percent}%';

  const progressInfo = ['PDF', 'CBZ'].includes(bookFormat)
    ? formatReadingProgress(section?.current, section?.total, formatTemplate)
    : formatReadingProgress(pageinfo?.current, pageinfo?.total, formatTemplate);

  const timeLeft = timeinfo ? _('{{time}}m', { time: Math.round(timeinfo.section) }) : '';
  const { page = 0, pages = 0 } = view?.renderer || {};
  const pageLeft = pages - 1 > page ? _('{{count}}p', { count: pages - 1 - page }) : '';
  const remainingInfo = `${timeLeft}${timeLeft && pageLeft ? ' § ' : ''}${pageLeft}`;

  return (
    <div
      className={clsx(
        'progressinfo absolute bottom-0 flex items-center justify-between',
        'text-neutral-content font-sans text-xs font-extralight',
        isVertical ? 'writing-vertical-rl' : 'w-full',
        isScrolled && !isVertical && 'bg-base-100',
      )}
      style={
        isVertical
          ? {
              bottom: `${contentInsets.bottom * 1.5}px`,
              left: showDoubleBorder
                ? `calc(${contentInsets.left}px)`
                : `calc(${Math.max(0, contentInsets.left - 32)}px)`,
              width: showDoubleBorder ? '32px' : `${horizontalGap}%`,
              height: `calc(100% - ${((contentInsets.top + contentInsets.bottom) / 2) * 3}px)`,
            }
          : {
              paddingInlineStart: `calc(${horizontalGap / 2}% + ${contentInsets.left}px)`,
              paddingInlineEnd: `calc(${horizontalGap / 2}% + ${contentInsets.right}px)`,
              paddingBottom: appService?.hasSafeAreaInset ? `${gridInsets.bottom * 0.33}px` : 0,
            }
      }
    >
      <div
        className={clsx(
          'flex items-center justify-center gap-1',
          isVertical ? 'h-full' : 'h-[52px] w-full',
        )}
      >
        <span className='text-start truncate'>{remainingInfo}</span>
        <span className='ms-auto text-end truncate'>{progressInfo}</span>
      </div>
    </div>
  );
};

export default ProgressInfoView;
