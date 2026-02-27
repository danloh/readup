import clsx from 'clsx';
import { Insets } from '@/types/misc';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useBookDataStore } from '@/store/bookDataStore';
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
      .replace(
        '{percent}',
        (((current + 1) / total) * 100).toFixed(
          current + 1 < total && total > 100 ? 1 : 0,
        ),
      );
  } else {
    return '';
  }
}

interface PageInfoProps {
  bookKey: string;
  horizontalGap: number;
  contentInsets: Insets;
  gridInsets: Insets;
}

const ProgressInfoView: React.FC<PageInfoProps> = ({
  bookKey,
  horizontalGap,
  contentInsets,
  gridInsets,
}) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { getProgress, getViewSettings, getView } = useReaderStore();
  const view = getView(bookKey);
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

  const { page = 0, pages = 0 } = view?.renderer || {};
  const pagesLeft = Math.max(pages - page - 1, 0);
  const calcTime = Math.round((pagesLeft * SIZE_PER_LOC) / SIZE_PER_TIME_UNIT)
  const timeLeft = pages - 1 > page ? _('{{time}}m', { time: calcTime }) : '';
  const pageLeft = pages - 1 > page ? _('{{count}}p', { count: pagesLeft }) : '';
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
                current: page + 1,
                total: pages,
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
        <span className='remaining-info-label text-start truncate'>{remainingInfo}</span>
        <span className='progress-info-label ms-auto text-end truncate'>{progressInfo}</span>
      </div>
    </div>
  );
};

export default ProgressInfoView;
