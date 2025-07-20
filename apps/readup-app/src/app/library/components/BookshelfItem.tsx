import clsx from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import { navigateToLibrary, navigateToReader, showReaderWindow } from '@/utils/nav';
import { useEnv } from '@/context/EnvContext';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useLongPress } from '@/hooks/useLongPress';
import { Menu, MenuItem } from '@tauri-apps/api/menu';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { getOSPlatform } from '@/utils/misc';
import { getLocalBookFilename } from '@/utils/book';
import { LibraryViewModeType } from '@/types/settings';
import { BOOK_UNGROUPED_ID, BOOK_UNGROUPED_NAME } from '@/services/constants';
import { FILE_REVEAL_LABELS, FILE_REVEAL_PLATFORMS } from '@/utils/os';
import { Book, BookGroupType, BooksGroup } from '@/types/book';
import BookItem from './BookItem';
import GroupItem from './GroupItem';

export type BookshelfItem = Book | BooksGroup;

export const generateGridItems = (books: Book[]): (Book | BooksGroup)[] => {
  const groups: BooksGroup[] = books.reduce((acc: BooksGroup[], book: Book) => {
    if (book.deletedAt) return acc;
    book.groupId = book.groupId || BOOK_UNGROUPED_ID;
    book.groupName = book.groupName || BOOK_UNGROUPED_NAME;
    const groupIndex = acc.findIndex((group) => group.id === book.groupId);
    const booksGroup = acc[acc.findIndex((group) => group.id === book.groupId)];
    if (booksGroup) {
      booksGroup.books.push(book);
      booksGroup.updatedAt = Math.max(acc[groupIndex]!.updatedAt, book.updatedAt);
    } else {
      acc.push({
        id: book.groupId,
        name: book.groupName,
        books: [book],
        updatedAt: book.updatedAt,
      });
    }
    return acc;
  }, []);
  groups.forEach((group) => {
    group.books.sort((a, b) => b.updatedAt - a.updatedAt);
  });
  const ungroupedBooks: Book[] =
    groups.find((group) => group.name === BOOK_UNGROUPED_NAME)?.books || [];
  const groupedBooks: BooksGroup[] = groups.filter((group) => group.name !== BOOK_UNGROUPED_NAME);
  return [...ungroupedBooks, ...groupedBooks].sort((a, b) => b.updatedAt - a.updatedAt);
};

export const generateListItems = (books: Book[]): (Book | BooksGroup)[] => {
  return books.filter((book) => !book.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const generateGroupsList = (items: Book[]): BookGroupType[] => {
  return items
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .reduce((acc: BookGroupType[], item: Book) => {
      if (item.deletedAt) return acc;
      if (
        item.groupId &&
        item.groupName &&
        item.groupId !== BOOK_UNGROUPED_ID &&
        item.groupName !== BOOK_UNGROUPED_NAME &&
        !acc.find((group) => group.id === item.groupId)
      ) {
        acc.push({ id: item.groupId, name: item.groupName });
      }
      return acc;
    }, []) as BookGroupType[];
};

interface BookshelfItemProps {
  mode: LibraryViewModeType;
  item: BookshelfItem;
  transferProgress: number | null;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  handleBookDownload: (book: Book) => Promise<boolean>;
  handleBookDelete: (book: Book) => Promise<boolean>;
  handleShowDetailsBook: (book: Book) => void;
}

const BookshelfItem: React.FC<BookshelfItemProps> = ({
  mode,
  item,
  transferProgress,
  setLoading,
  handleBookDownload,
  handleBookDelete,
  handleShowDetailsBook,
}) => {
  const _ = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { envConfig, appService } = useEnv();
  const { settings } = useSettingsStore();
  const { updateBook } = useLibraryStore();

  const showBookDetailsModal = async (book: Book) => {
    if (await makeBookAvailable(book)) {
      handleShowDetailsBook(book);
    }
  };

  const makeBookAvailable = async (book: Book) => {
    if (book.uploadedAt && !book.downloadedAt) {
      if (await appService?.isBookAvailable(book)) {
        if (!book.downloadedAt || !book.coverDownloadedAt) {
          book.downloadedAt = Date.now();
          book.coverDownloadedAt = Date.now();
          updateBook(envConfig, book);
        }
        return true;
      }
      let available = false;
      const loadingTimeout = setTimeout(() => setLoading(true), 200);
      try {
        available = await handleBookDownload(book);
        updateBook(envConfig, book);
      } finally {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        setLoading(false);
        return available;
      }
    }
    return true;
  };

  const handleBookClick = async (book: Book) => {
    if (!(await makeBookAvailable(book))) return;
    if (appService?.hasWindow && settings.openBookInNewWindow) {
      showReaderWindow(appService, [book.hash]);
    } else {
      navigateToReader(router, [book.hash]);
    }
  };

  const handleGroupClick = (group: BooksGroup) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('group', group.id);
    navigateToLibrary(router, `${params.toString()}`);
  };

  const bookContextMenuHandler = async (book: Book) => {
    if (!appService?.hasContextMenu) return;
    const osPlatform = getOSPlatform();
    const fileRevealLabel =
      FILE_REVEAL_LABELS[osPlatform as FILE_REVEAL_PLATFORMS] || FILE_REVEAL_LABELS.default;

    const showBookInFinderMenuItem = await MenuItem.new({
      text: _(fileRevealLabel),
      action: async () => {
        const folder = `${settings.localBooksDir}/${getLocalBookFilename(book)}`;
        revealItemInDir(folder);
      },
    });

    const menu = await Menu.new();
    menu.append(showBookInFinderMenuItem);
    menu.popup();
  };

  const groupContextMenuHandler = async (group: BooksGroup) => {
    if (!appService?.hasContextMenu) return;

    const deleteGroupMenuItem = await MenuItem.new({
      text: _('Delete'),
      action: async () => {
        for (const book of group.books) {
          await handleBookDelete(book);
        }
      },
    });
    const menu = await Menu.new();
    menu.append(deleteGroupMenuItem);
    menu.popup();
  };

  const { pressing, handlers } = useLongPress({
    onTap: () => {
      if ('format' in item) {
        handleBookClick(item as Book);
      } else {
        handleGroupClick(item as BooksGroup);
      }
    },
    onContextMenu: () => {
      if ('format' in item) {
        bookContextMenuHandler(item as Book);
      } else {
        groupContextMenuHandler(item as BooksGroup);
      }
    },
  });

  return (
    <div className={clsx(mode === 'list' && 'sm:hover:bg-base-300/50 px-4 sm:px-6')}>
      <div
        className={clsx(
          'group',
          mode === 'grid' && 'sm:hover:bg-base-300/50 flex h-full flex-col px-0 py-4 sm:px-4',
          mode === 'list' && 'border-base-300 flex flex-col border-b py-2',
          pressing ? (mode === 'grid' ? 'scale-95' : 'scale-98') : 'scale-100',
        )}
        style={{
          transition: 'transform 0.2s',
        }}
        {...handlers}
      >
        <div className='flex-grow'>
          {'format' in item ? (
            <BookItem
              mode={mode}
              book={item}
              transferProgress={transferProgress}
              showBookDetailsModal={showBookDetailsModal}
            />
          ) : (
            <GroupItem group={item} />
          )}
        </div>
      </div>
    </div>
  );
};

export default BookshelfItem;
