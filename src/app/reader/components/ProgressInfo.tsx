import clsx from 'clsx';
import React, { useMemo } from 'react';
import { Insets } from '@/types/misc';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useBookDataStore } from '@/store/bookDataStore';
import { TOCItem } from '@/libs/document';
import { SIZE_PER_LOC, SIZE_PER_TIME_UNIT } from '@/services/constants';

function formatProgress(
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
  toc: TOCItem[];
  horizontalGap: number;
  contentInsets: Insets;
  gridInsets: Insets;
}

const ProgressInfoView: React.FC<PageInfoProps> = ({
  bookKey,
  toc,
  horizontalGap,
  contentInsets,
  gridInsets,
}) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { getProgress, getViewSettings } = useReaderStore();
  const { getBookData } = useBookDataStore();
  const viewSettings = getViewSettings(bookKey)!;
  const bookData = getBookData(bookKey); 
  const progress = getProgress(bookKey);
  
  const showDoubleBorder = viewSettings.vertical && viewSettings.doubleBorder;
  const isScrolled = viewSettings.scrolled;
  const isVertical = viewSettings.vertical;
  const isEink = viewSettings.isEink;

  const formatTemplate = isVertical
    ? '{current} · {total} · {percent}%'
    : '{current} / {total} / {percent}%';

  const { section, pageinfo } = progress || {};
  const pageInfo = bookData?.isFixedLayout ? section : pageinfo;
  const progressInfo = formatProgress(pageInfo?.current, pageInfo?.total, formatTemplate);

  const activeHref = useMemo(() => progress?.sectionHref || null, [progress?.sectionHref]);
  const activeTOCItem = useMemo(() => {
    if (!activeHref) return null;
    for (const item of toc) {
      if (item.href === activeHref) return item;
      const subitem = item.subitems?.find((sub) => sub.href === activeHref);
      if (subitem) return subitem;
    }
    return null;
  }, [activeHref, toc]);
  const current = pageInfo?.current || 0;
  const total = activeTOCItem?.location ? activeTOCItem.location.next : pageInfo?.total || 0;
  const pages = Math.max(total - current, 0);
  const timeLeft = total - 1 >= current
    ? _('{{time}}m', { time: Math.round((pages * SIZE_PER_LOC) / SIZE_PER_TIME_UNIT) })
    : '';
  const pageLeft = total - 1 >= current ? _('{{count}}p', { count: pages }) : '';
  const remainingInfo = `${timeLeft}${timeLeft && pageLeft ? ' § ' : ''}${pageLeft}`;

  return (
    <div
      role='presentation'
      className={clsx(
        'progressinfo absolute bottom-0 flex items-center justify-between font-sans',
        isEink ? 'text-sm font-normal' : 'text-neutral-content text-xs font-extralight',
        isVertical ? 'writing-vertical-rl' : 'w-full',
        isScrolled && !isVertical && 'bg-base-100',
      )}
      aria-label={
        [
          progress
            ? _('On {{current}} of {{total}} page', {
                current: current + 1,
                total: total,
              })
            : '',
          timeLeft,
          pageLeft,
        ]
        .filter(Boolean)
        .join(', ')
      }
      style={
        isVertical
          ? {
              bottom: `${(contentInsets.bottom - gridInsets.bottom) * 1.5}px`,
              left: showDoubleBorder
                ? `calc(${contentInsets.left}px)`
                : `calc(${Math.max(0, contentInsets.left - 32)}px)`,
              width: showDoubleBorder ? '32px' : `${contentInsets.left}px`,
              height: `calc(100% - ${((contentInsets.top + contentInsets.bottom) / 2) * 3}px)`,
            }
          : {
              paddingInlineStart: `calc(${horizontalGap / 2}% + ${contentInsets.left / 2}px)`,
              paddingInlineEnd: `calc(${horizontalGap / 2}% + ${contentInsets.right / 2}px)`,
              paddingBottom: appService?.hasSafeAreaInset ? `${gridInsets.bottom * 0.33}px` : 0,
            }
      }
    >
      <div
        className={clsx(
          'flex items-center justify-center gap-1',
          isVertical ? 'h-full' : 'h-[42px] w-full',
        )}
      >
        <span className='text-start truncate'>{remainingInfo}</span>
        <span className='ms-auto text-end truncate'>{progressInfo}</span>
      </div>
    </div>
  );
};

export default ProgressInfoView;
