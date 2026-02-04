import clsx from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Book, BooksGroup } from '@/types/book';
import { LibraryGroupByType, LibrarySortByType, LibraryViewModeType } from '@/types/settings';
import { useEnv } from '@/context/EnvContext';
import { useAutoFocus } from '@/hooks/useAutoFocus';
import { useSettingsStore } from '@/store/settingsStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useTranslation } from '@/hooks/useTranslation';
import { navigateToLibrary, navigateToReader } from '@/utils/nav';
import Spinner from '@/components/Spinner';
import BookshelfItem, { generateBookshelfItems } from './BookshelfItem';
import { 
  createBookFilter, 
  createBookGroups, 
  createBookSorter, 
  createGroupSorter, 
  createWithinGroupSorter, 
  ensureLibraryGroupByType, 
  ensureLibrarySortByType 
} from './libraryUtils';

interface BookshelfProps {
  libraryBooks: Book[];
  handleShowDetailsBook: (book: Book) => void;
}

const Bookshelf: React.FC<BookshelfProps> = ({
  libraryBooks,
  handleShowDetailsBook,
}) => {
  const _ = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { appService } = useEnv();
  const { settings } = useSettingsStore();

  const groupId = searchParams?.get('group') || '';
  const queryTerm = searchParams?.get('q') || null;
  const viewMode = searchParams?.get('view') || settings.libraryViewMode;
  const sortBy = ensureLibrarySortByType(searchParams?.get('sort'), settings.librarySortBy);
  const sortOrder = searchParams?.get('order') || (settings.librarySortAscending ? 'asc' : 'desc');
  const groupBy = ensureLibraryGroupByType(searchParams?.get('groupBy'), settings.libraryGroupBy);

  const [loading, setLoading] = useState(false);
  const [importBookUrl] = useState(searchParams?.get('url') || '');

  const isImportingBook = useRef(false);
  const autofocusRef = useAutoFocus<HTMLDivElement>();
  const { setCurrentBookshelf, setLibrary, getGroupName } = useLibraryStore();

  const uiLanguage = localStorage?.getItem('i18nextLng') || '';

  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      if (params.get('sort') === LibrarySortByType.Updated) params.delete('sort');
      if (params.get('groupBy') === LibraryGroupByType.Manual) params.delete('groupBy');
      if (params.get('order') === 'desc') params.delete('order');
      if (params.get('cover') === 'crop') params.delete('cover');
      if (params.get('view') === 'grid') params.delete('view');

      const newParamString = params.toString();
      const currentParamString = searchParams?.toString() || '';

      if (newParamString !== currentParamString) {
        navigateToLibrary(router, newParamString);
      }
    },
    [router, searchParams],
  );

  const filteredBooks = useMemo(() => {
    const bookFilter = createBookFilter(queryTerm);
    return queryTerm ? libraryBooks.filter((book) => bookFilter(book)) : libraryBooks;
  }, [libraryBooks, queryTerm]);

  const currentBookshelfItems = useMemo(() => {
    if (groupBy === LibraryGroupByType.Manual) {
      // Use existing generateBookshelfItems for manual mode
      const groupName = getGroupName(groupId) || '';
      if (groupId && !groupName) {
        return [];
      }
      return generateBookshelfItems(filteredBooks, groupName);
    } else {
      // Use new createBookGroups for series/author/none modes
      const allItems = createBookGroups(filteredBooks, groupBy);

      // If navigating into a specific group, show only that group's books
      if (groupId) {
        const targetGroup = allItems.find(
          (item): item is BooksGroup => 'books' in item && item.id === groupId,
        );
        if (targetGroup) {
          // Return the books from the target group as individual items
          return targetGroup.books;
        }
        // Group not found, return empty
        return [];
      }

      return allItems;
    }
  }, [filteredBooks, groupBy, groupId, getGroupName]);

  useEffect(() => {
    if (groupId && currentBookshelfItems.length === 0) {
      updateUrlParams({ group: null });
    } else {
      updateUrlParams({});
    }
  }, [searchParams, groupId, currentBookshelfItems.length, updateUrlParams]);

  const sortedBookshelfItems = useMemo(() => {
    const sortOrderMultiplier = sortOrder === 'asc' ? 1 : -1;

    // Separate into ungrouped books and groups
    const ungroupedBooks = currentBookshelfItems.filter((item): item is Book => 'format' in item);
    const groups = currentBookshelfItems.filter((item): item is BooksGroup => 'books' in item);

    // Sort groups by aggregate value
    const groupSorter = createGroupSorter(sortBy, uiLanguage);
    groups.sort((a, b) => groupSorter(a, b) * sortOrderMultiplier);

    // Sort books within each group
    const withinGroupSorter = createWithinGroupSorter(groupBy, sortBy, uiLanguage);
    groups.forEach((group) => {
      group.books.sort((a, b) => withinGroupSorter(a, b) * sortOrderMultiplier);
    });

    // Sort ungrouped books - use within-group sorter if we're inside a group
    // (for series, this ensures books are sorted by series index)
    if (groupId && groupBy !== LibraryGroupByType.Manual && groupBy !== LibraryGroupByType.None) {
      ungroupedBooks.sort((a, b) => withinGroupSorter(a, b) * sortOrderMultiplier);
    } else {
      const bookSorter = createBookSorter(sortBy, uiLanguage);
      ungroupedBooks.sort((a, b) => bookSorter(a, b) * sortOrderMultiplier);
    }

    // Return groups first, then ungrouped books
    return [...groups, ...ungroupedBooks];
  }, [sortOrder, sortBy, groupBy, groupId, uiLanguage, currentBookshelfItems]);

  useEffect(() => {
    if (isImportingBook.current) return;
    isImportingBook.current = true;

    if (importBookUrl && appService) {
      const importBook = async () => {
        console.log('Importing book from URL:', importBookUrl);
        const book = await appService.importBook(importBookUrl, libraryBooks);
        if (book) {
          setLibrary(libraryBooks);
          appService.saveLibraryBooks(libraryBooks);
          navigateToReader(router, [book.hash]);
        }
      };
      importBook();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importBookUrl, appService]);

  useEffect(() => {
    setCurrentBookshelf(currentBookshelfItems);
  }, [currentBookshelfItems, setCurrentBookshelf]);

  return (
    <div className='bookshelf'>
      <div
        ref={autofocusRef}
        tabIndex={-1}
        className={clsx(
          'bookshelf-items transform-wrapper focus:outline-none',
          viewMode === 'grid' && 'grid flex-1 grid-cols-3 gap-x-4 px-4 sm:gap-x-0 sm:px-2',
          viewMode === 'grid' && 'sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-12',
          viewMode === 'list' && 'flex flex-col',
        )}
        role='main'
        aria-label={_('Bookshelf')}
      >
        {sortedBookshelfItems.map((item) => (
          <BookshelfItem
            key={`library-item-${'hash' in item ? item.hash : item.id}`}
            item={item}
            mode={viewMode as LibraryViewModeType}
            setLoading={setLoading}
            handleShowDetailsBook={handleShowDetailsBook}
          />
        ))}
      </div>
      {loading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )}
    </div>
  );
};

export default Bookshelf;
