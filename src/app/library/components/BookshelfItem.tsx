import clsx from 'clsx';
import { useCallback } from 'react';
import { Menu, MenuItem } from '@tauri-apps/api/menu';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

import { navigateToReader, showReaderWindow } from '@/utils/nav';
import { useEnv } from '@/context/EnvContext';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useLongPress } from '@/hooks/useLongPress';
import { useAppRouter } from '@/hooks/useAppRouter';
import { getOSPlatform } from '@/utils/misc';
import { throttle } from '@/utils/throttle';
import { eventDispatcher } from '@/utils/event';
import { LibraryViewModeType } from '@/types/settings';
import { BOOK_UNGROUPED_ID, BOOK_UNGROUPED_NAME } from '@/services/constants';
import { FILE_REVEAL_LABELS, FILE_REVEAL_PLATFORMS } from '@/utils/os';
import { md5Fingerprint } from '@/utils/md5';
import { Book, BooksGroup } from '@/types/book';
import BookItem from './BookItem';
import GroupItem from './GroupItem';

export const generateBookshelfItems = (
  books: Book[],
  parentGroupName: string,
): (Book | BooksGroup)[] => {
  const groupsMap = new Map<string, BooksGroup>();

  for (const book of books) {
    if (book.deletedAt) continue;

    const groupName = book.groupName || BOOK_UNGROUPED_NAME;
    if (
      parentGroupName &&
      groupName !== parentGroupName &&
      !groupName.startsWith(parentGroupName + '/')
    ) {
      continue;
    }

    const relativePath = parentGroupName 
      ? groupName.slice(parentGroupName.length + 1) 
      : groupName;
    // Get the immediate child group name (or empty if book is directly in parent)
    const slashIndex = relativePath.indexOf('/');
    const immediateChild = slashIndex > 0 
      ? relativePath.slice(0, slashIndex) 
      : relativePath;
    // Determine if this book belongs directly to the parent group
    const isDirectChild =
      groupName === parentGroupName || (groupName === BOOK_UNGROUPED_NAME && !parentGroupName);
    // Build the full group name for this level
    const fullGroupName = isDirectChild
      ? BOOK_UNGROUPED_NAME
      : parentGroupName
        ? `${parentGroupName}/${immediateChild}`
        : immediateChild;

    const mapKey = fullGroupName;
    const existingGroup = groupsMap.get(mapKey);
    if (existingGroup) {
      existingGroup.books.push(book);
      existingGroup.updatedAt = Math.max(existingGroup.updatedAt, book.updatedAt);
    } else {
      groupsMap.set(mapKey, {
        id: isDirectChild ? BOOK_UNGROUPED_ID : md5Fingerprint(fullGroupName),
        name: fullGroupName,
        displayName: isDirectChild ? BOOK_UNGROUPED_NAME : immediateChild,
        books: [book],
        updatedAt: book.updatedAt,
      });
    }
  }

  for (const group of groupsMap.values()) {
    group.books.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const ungroupedGroup = groupsMap.get(BOOK_UNGROUPED_NAME);
  const ungroupedBooks = ungroupedGroup?.books || [];
  const groupedBooks = Array.from(groupsMap.values()).filter(
    (group) => group.name !== BOOK_UNGROUPED_NAME,
  );

  return [...ungroupedBooks, ...groupedBooks].sort((a, b) => b.updatedAt - a.updatedAt);
};

interface BookshelfItemProps {
  mode: LibraryViewModeType;
  item: Book | BooksGroup;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  handleShowDetailsBook: (book: Book) => void;
  handleLibraryNavigation: (targetGroup: string) => void;
}

const BookshelfItem: React.FC<BookshelfItemProps> = ({
  mode,
  item,
  setLoading,
  handleShowDetailsBook,
  handleLibraryNavigation,
}) => {
  const _ = useTranslation();
  const router = useAppRouter();
  const { envConfig, appService } = useEnv();
  const { settings } = useSettingsStore();
  const { updateBook } = useLibraryStore();

  const showBookDetailsModal = async (book: Book) => {
    // if (await makeBookAvailable(book)) {
    //   handleShowDetailsBook(book);
    // }
    handleShowDetailsBook(book);
  };

  // Download book to makeBookAvailable
  const handleBookDownload = async (book: Book) => {
    try {
      await appService?.downloadBook(book, false);
      await updateBook(envConfig, book);
      eventDispatcher.dispatch('toast', {
        type: 'info',
        timeout: 2000,
        message: _('Book downloaded: {{title}}', { title: book.title }),
      });
      return true;
    } catch {
      eventDispatcher.dispatch('toast', {
        message: _('Failed to download book: {{title}}', { title: book.title }),
        type: 'error',
      });
      return false;
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

  const handleBookClick = useCallback(
    async (book: Book) => {
      const available = await makeBookAvailable(book);
      if (!available) return;
      if (appService?.hasWindow && settings.openBookInNewWindow) {
        showReaderWindow(appService, [book.hash]);
      } else {
        setTimeout(() => {
          navigateToReader(router, [book.hash]);
        }, 0);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.openBookInNewWindow, appService],
  );

  const handleGroupClick = useCallback(
    (group: BooksGroup) => {
      handleLibraryNavigation(group.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleLibraryNavigation],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleOpenItem = useCallback(
    throttle(() => {
      if ('format' in item) {
        handleBookClick(item as Book);
      } else {
        handleGroupClick(item as BooksGroup);
      }
    }, 100),
    [handleBookClick, handleGroupClick],
  );

  const bookContextMenuHandler = async (book: Book) => {
    if (!appService?.hasContextMenu) return;
    const osPlatform = getOSPlatform();
    const fileRevealLabel =
      FILE_REVEAL_LABELS[osPlatform as FILE_REVEAL_PLATFORMS] || FILE_REVEAL_LABELS.default;

    const showBookInFinderMenuItem = await MenuItem.new({
      text: _(fileRevealLabel),
      action: async () => {
        const folder = `${settings.localBooksDir}/${book.hash}`;
        revealItemInDir(folder);
      },
    });

    const menu = await Menu.new();
    menu.append(showBookInFinderMenuItem);
    menu.popup();
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleContextMenu = useCallback(
    throttle(() => {
      if ('format' in item) {
        bookContextMenuHandler(item as Book);
      } else {
        // groupContextMenuHandler(item as BooksGroup);
      }
    }, 100),
    [settings.localBooksDir],
  );

  const { pressing, handlers } = useLongPress({
    onTap: () => {
      handleOpenItem();
    },
    onContextMenu: () => {
      if (appService?.hasContextMenu) {
        handleContextMenu();
      } else if (appService?.isAndroidApp) {
        // handleSelectItem();
      }
    },
  }, [handleOpenItem, handleContextMenu]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenItem();
    }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      handleContextMenu();
    }
  };

  return (
    <div className={clsx(mode === 'list' && 'sm:hover:bg-base-300/50 px-4 sm:px-6')}>
      <div
        className={clsx(
          'visible-focus-inset-2 group',
          mode === 'grid' && 'hover:bg-base-300/50 flex h-full flex-col p-2 rounded-md',
          mode === 'list' && 'border-base-300 flex flex-col border-b py-2',
          appService?.isMobileApp && 'no-context-menu',
          pressing && mode === 'grid' ? 'not-eink:scale-95' : 'scale-100',
        )}
        role='button'
        tabIndex={0}
        aria-label={'format' in item ? item.title : item.name}
        style={{ transition: 'transform 0.2s', }}
        onKeyDown={handleKeyDown}
        {...handlers}
      >
        <div className='flex h-full flex-col justify-end'>
          {'format' in item ? (
            <BookItem
              mode={mode}
              book={item}
              showBookDetailsModal={showBookDetailsModal}
            />
          ) : (
            <GroupItem mode={mode} group={item} />
          )}
        </div>
      </div>
    </div>
  );
};

export default BookshelfItem;
