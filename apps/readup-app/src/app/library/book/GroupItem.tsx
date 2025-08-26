import clsx from 'clsx';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { BooksGroup } from '@/types/book';
import BookCover from '@/app/library/book/BookCover';

interface GroupItemProps {
  group: BooksGroup;
}

const GroupItem: React.FC<GroupItemProps> = ({ group }) => {
  const iconSize15 = useResponsiveSize(15);

  return (
    <div className='group-item flex h-full flex-col justify-end cursor-pointer'>
      <div className='bg-base-100 relative flex aspect-[28/41] items-center justify-center overflow-hidden p-2 shadow-md'>
        <div className='grid w-full grid-cols-2 grid-rows-2 gap-1 overflow-hidden'>
          {group.books.slice(0, 4).map((book) => (
            <div key={book.hash} className='relative aspect-[28/41] h-full w-full'>
              <BookCover book={book} isPreview />
            </div>
          ))}
        </div>
      </div>
      <div className={clsx('flex w-full flex-col pt-2')}>
        <div className='min-w-0 flex-1'>
          <h4 className='block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold'>
            {group.name}
          </h4>
        </div>
        <div className='placeholder' style={{ height: `${iconSize15}px` }}></div>
      </div>
    </div>
  );
};

export default GroupItem;
