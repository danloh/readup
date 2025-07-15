import clsx from 'clsx';
import { LiaInfoCircleSolid } from 'react-icons/lia';

import { Book } from '@/types/book';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { LibraryViewModeType } from '@/types/settings';
import { formatAuthors } from '@/utils/book';
import ReadingProgress from './ReadingProgress';
import BookCover from '@/components/BookCover';

interface BookItemProps {
  book: Book;
  mode: LibraryViewModeType;
  transferProgress: number | null;
  showBookDetailsModal: (book: Book) => void;
}

const BookItem: React.FC<BookItemProps> = ({
  book,
  mode,
  transferProgress,
  showBookDetailsModal,
}) => {
  const iconSize15 = useResponsiveSize(15);

  const stopEvent = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className={clsx(
        'book-item flex',
        mode === 'grid' && 'h-full flex-col justify-end',
        mode === 'list' && 'h-28 flex-row gap-4 overflow-hidden',
      )}
    >
      <div
        className={clsx(
          'relative flex aspect-[28/41] items-center justify-center cursor-pointer',
          mode === 'list' && 'min-w-20',
        )}
      >
        <BookCover mode={mode} book={book} />
      </div>
      <div
        className={clsx(
          'flex w-full flex-col p-0',
          mode === 'grid' && 'pt-2',
          mode === 'list' && 'py-2',
        )}
      >
        <div className={clsx('min-w-0 flex-1', mode === 'list' && 'flex flex-col gap-2')}>
          <h4
            className={clsx(
              'overflow-hidden text-ellipsis font-semibold',
              mode === 'grid' && 'block whitespace-nowrap text-[0.6em] text-xs',
              mode === 'list' && 'line-clamp-2 text-base',
            )}
          >
            {book.title}
          </h4>
          {mode === 'list' && (
            <p className='text-neutral-content line-clamp-1 text-sm'>
              {formatAuthors(book.author, book.primaryLanguage) || ''}
            </p>
          )}
        </div>
        <div
          className={clsx('flex items-center', book.progress ? 'justify-between' : 'justify-end')}
          style={{
            height: `${iconSize15}px`,
            minHeight: `${iconSize15}px`,
          }}
        >
          {book.progress && <ReadingProgress book={book} />}
          <div className='flex items-center justify-center gap-x-2'>
            <button
              className='show-detail-button -m-2 p-2'
              onPointerDown={(e) => stopEvent(e)}
              onPointerUp={(e) => stopEvent(e)}
              onPointerMove={(e) => stopEvent(e)}
              onPointerCancel={(e) => stopEvent(e)}
              onPointerLeave={(e) => stopEvent(e)}
              onClick={() => showBookDetailsModal(book)}
            >
              <div className='pt-[1px]'>
                <LiaInfoCircleSolid size={iconSize15} />
              </div>
            </button>
            {transferProgress == null ? null : (
              transferProgress === 100 ? null : (
                <div
                  className='radial-progress'
                  style={
                    {
                      '--value': transferProgress,
                      '--size': `${iconSize15}px`,
                      '--thickness': '2px',
                    } as React.CSSProperties
                  }
                  role='progressbar'
                ></div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookItem;
