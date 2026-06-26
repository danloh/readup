import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { LiaInfoCircleSolid } from 'react-icons/lia';

import { Book } from '@/types/book';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { LibraryViewModeType } from '@/types/settings';
import { formatAuthors, formatDescription, formatSeries } from '@/utils/book';
import { useTranslation } from '@/hooks/useTranslation';
import BookCover from '@/app/library/components/BookCover';
import ReadingProgress from './ReadingProgress';

interface BookItemProps {
  book: Book;
  mode: LibraryViewModeType;
  showBookDetailsModal: (book: Book) => void;
}

const BookItem: React.FC<BookItemProps> = ({
  book,
  mode,
  showBookDetailsModal,
}) => {
  const _ = useTranslation();
  const iconSize16 = useResponsiveSize(16);

  const [coverAspect, setCoverAspect] = useState<number | null>(null);
  useEffect(() => {
    setCoverAspect(null);
  }, [book.hash, book.metadata?.coverImageUrl, book.coverImageUrl]);

  const CELL_ASPECT_RATIO = 28 / 41;
  const fitCoverInGrid = mode === 'grid' && coverAspect !== null;
  const shouldShrinkWidth = fitCoverInGrid && coverAspect! < CELL_ASPECT_RATIO;
  const bookitemMainStyle = fitCoverInGrid
    ? {
        aspectRatio: coverAspect!,
        ...(shouldShrinkWidth ? { width: `${(coverAspect! / CELL_ASPECT_RATIO) * 100}%` } : {}),
      }
    : undefined;

  const seriesText = formatSeries(book.metadata?.series, book.metadata?.seriesIndex);

  return (
    <div
      className={clsx(
        'book-item flex',
        mode === 'list' ? 'library-list-item' : 'library-grid-item',
        mode === 'grid' && 'h-full flex-col justify-end',
        mode === 'list' && 'min-h-28 flex-row gap-4 overflow-hidden',
      )}
    >
      <div
        className={clsx(
          'bookitem-main relative flex items-center justify-center cursor-pointer rounded overflow-hidden',
          !fitCoverInGrid && 'aspect-[28/41]',
          mode === 'grid' && 'items-end',
          mode === 'list' && 'min-w-20 items-center',
        )}
        style={bookitemMainStyle}
      >
        <BookCover 
          mode={mode} 
          book={book} 
          imageClassName='rounded shadow-md' 
          onAspectRatioChange={setCoverAspect} 
        />
      </div>
      <div
        className={clsx(
          'flex w-full flex-col p-0',
          mode === 'grid' && 'pt-2',
          mode === 'list' && 'gap-1',
        )}
      >
        <div className={clsx('min-w-0 flex-1', mode === 'list' && 'flex flex-col gap-1')}>
          <h4
            className={clsx(
              'overflow-hidden text-ellipsis font-semibold',
              mode === 'grid' && 'block whitespace-nowrap text-[0.6em] text-xs',
              mode === 'list' && 'line-clamp-1 text-base',
            )}
            title={formatDescription(book.metadata?.description)}
          >
            {book.title}
          </h4>
          {mode === 'list' && (
            <p className='text-neutral-content line-clamp-1 text-sm'>
              {formatAuthors(book.author, book.primaryLanguage) || ''}
            </p>
          )}
        </div>
        {mode === 'list' && seriesText && (
          <p className='text-neutral-content line-clamp-1 text-sm'>{seriesText}</p>
        )}
        {mode === 'list' && (
          <h4 
            className='text-neutral-content line-clamp-1 text-xs' 
            title={formatDescription(book.metadata?.description)}
          >
            {formatDescription(book.metadata?.description)}
          </h4>
        )}
        <div
          className={clsx(
            'flex items-center', 
            book.progress ? 'justify-between' : 'justify-end'
          )}
          style={{ height: `${iconSize16}px`,minHeight: `${iconSize16}px` }}
        >
          {book.progress && <ReadingProgress book={book} />}
          <div className='flex items-center justify-center gap-x-2 opacity-20'>
            <button
              aria-label={_('Show Book Details')}
              className='show-detail-button -m-2 p-2'
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                showBookDetailsModal(book);
              }}
            >
              <div className='pt-[1px]'>
                <LiaInfoCircleSolid size={iconSize16} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookItem;
