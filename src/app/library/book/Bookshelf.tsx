import clsx from 'clsx';
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Book, BooksGroup } from '@/types/book';
import { LibraryViewModeType } from '@/types/settings';
import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useLibraryStore } from '@/store/libraryStore';
import { navigateToLibrary, navigateToReader } from '@/utils/nav';
import { formatTitle } from '@/utils/book';
import Spinner from '@/components/Spinner';
import BookshelfItem, { generateBookshelfItems } from './BookshelfItem';
import { createBookFilter, createBookSorter } from './libraryUtils';

interface BookshelfProps {
  libraryBooks: Book[];
  handleShowDetailsBook: (book: Book) => void;
}

const Bookshelf: React.FC<BookshelfProps> = ({
  libraryBooks,
  handleShowDetailsBook,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { appService } = useEnv();
  const { settings } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const [queryTerm, setQueryTerm] = useState<string | null>(null);
  const [navBooksGroup, setNavBooksGroup] = useState<BooksGroup | null>(null);
  const [groupId, setGroupId] = useState(searchParams?.get('group') || '');
  const [importBookUrl] = useState(searchParams?.get('url') || '');
  const [viewMode, setViewMode] = useState(searchParams?.get('view') || settings.libraryViewMode);
  const [sortBy, setSortBy] = useState(searchParams?.get('sort') || settings.librarySortBy);
  const [sortOrder, setSortOrder] = useState(
    searchParams?.get('order') || (settings.librarySortAscending ? 'asc' : 'desc'),
  );

  const isImportingBook = useRef(false);

  const { setCurrentBookshelf, setLibrary } = useLibraryStore();

  const bookFilter = useMemo(() => createBookFilter(queryTerm), [queryTerm]);
  const uiLanguage = localStorage?.getItem('i18nextLng') || '';
  const bookSorter = useMemo(() => createBookSorter(sortBy, uiLanguage), [sortBy, uiLanguage]);

  const filteredBooks = useMemo(() => {
    return queryTerm ? libraryBooks.filter((book) => bookFilter(book)) : libraryBooks;
  }, [libraryBooks, queryTerm, bookFilter]);

  const allBookshelfItems = useMemo(() => {
    return generateBookshelfItems(filteredBooks);
  }, [filteredBooks]);

  const sortedBookshelfItems = useMemo(() => {
    const sortOrderMultiplier = sortOrder === 'asc' ? 1 : -1;
    const currentBookshelfItems = navBooksGroup ? navBooksGroup.books : allBookshelfItems;
    return currentBookshelfItems.sort((a, b) => {
      if (sortBy === 'updated') {
        return (
          (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * sortOrderMultiplier
        );
      } else if ('name' in a || 'name' in b) {
        const aName = 'name' in a ? a.name : formatTitle(a.title);
        const bName = 'name' in b ? b.name : formatTitle(b.title);
        return aName.localeCompare(bName, uiLanguage || navigator.language) * sortOrderMultiplier;
      } else if (!('name' in a || 'name' in b)) {
        return bookSorter(a, b) * sortOrderMultiplier;
      } else {
        return 0;
      }
    });
  }, [sortOrder, sortBy, uiLanguage, navBooksGroup, allBookshelfItems, bookSorter]);

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
    if (navBooksGroup) {
      setCurrentBookshelf(navBooksGroup.books);
    } else {
      setCurrentBookshelf(allBookshelfItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryBooks, navBooksGroup]);

  useEffect(() => {
    const group = searchParams?.get('group') || '';
    const query = searchParams?.get('q') || '';
    const view = searchParams?.get('view') || settings.libraryViewMode;
    const sort = searchParams?.get('sort') || settings.librarySortBy;
    const order = searchParams?.get('order') || (settings.librarySortAscending ? 'asc' : 'desc');

    setGroupId(group);
    setQueryTerm(query || null);
    setViewMode(view);
    setSortBy(sort);
    setSortOrder(order);
  }, [searchParams, settings]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString());
    let hasChanges = false;

    if (queryTerm) {
      if (params.get('q') !== queryTerm) {
        params.set('q', queryTerm);
        hasChanges = true;
      }
    } else {
      if (params.has('q')) {
        params.delete('q');
        hasChanges = true;
      }
    }

    if (sortBy !== 'updated' && params.get('sort') !== sortBy) {
      params.set('sort', sortBy);
      hasChanges = true;
    }

    if (sortBy === 'updated') {
      params.delete('sort');
      hasChanges = true;
    }

    if (sortOrder === 'desc') {
      params.delete('order');
      hasChanges = true;
    }

    if (viewMode === 'grid') {
      params.delete('view');
      hasChanges = true;
    }

    if (groupId) {
      const booksGroup = allBookshelfItems.find(
        (item) => 'name' in item && item.id === groupId,
      ) as BooksGroup;
      if (booksGroup) {
        params.delete('group');
        hasChanges = true;
      } else if (params.get('group') !== groupId) {
        params.set('group', groupId);
        hasChanges = true;
      }
    } else if (params.has('group')) {
      params.delete('group');
      hasChanges = true;
    }

    if (hasChanges) {
      navigateToLibrary(router, params.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTerm, sortBy, sortOrder, viewMode, groupId]);

  return (
    <div className='bookshelf'>
      <div
        className={clsx(
          'bookshelf-items transform-wrapper',
          viewMode === 'grid' && 'grid flex-1 grid-cols-3 gap-x-4 px-4 sm:gap-x-0 sm:px-2',
          viewMode === 'grid' && 'sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-12',
          viewMode === 'list' && 'flex flex-col',
        )}
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
