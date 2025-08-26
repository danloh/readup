import clsx from 'clsx';
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Book, BooksGroup } from '@/types/book';
import { LibraryViewModeType } from '@/types/settings';
import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useLibraryStore } from '@/store/libraryStore';
import { navigateToLibrary, navigateToReader } from '@/utils/nav';
import { formatAuthors, formatTitle } from '@/utils/book';
import Spinner from '@/components/Spinner';
import BookshelfItem, { generateGridItems, generateListItems } from './BookshelfItem';

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
  const [importBookUrl] = useState(searchParams?.get('url') || '');
  const [viewMode, setViewMode] = useState(searchParams?.get('view') || settings.libraryViewMode);
  const [sortBy, setSortBy] = useState(searchParams?.get('sort') || settings.librarySortBy);
  const [sortOrder, setSortOrder] = useState(
    searchParams?.get('order') || (settings.librarySortAscending ? 'asc' : 'desc'),
  );

  const isImportingBook = useRef(false);

  const { setCurrentBookshelf, setLibrary } = useLibraryStore();
  const allBookshelfItems =
    viewMode === 'grid' ? generateGridItems(libraryBooks) : generateListItems(libraryBooks);

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

    const params = new URLSearchParams(searchParams?.toString());
    if (query) {
      params.set('q', query);
      setQueryTerm(query);
    } else {
      params.delete('q');
      setQueryTerm(null);
    }
    if (sort) {
      params.set('sort', sort);
      setSortBy(sort);
    } else {
      params.delete('sort');
    }
    if (order) {
      params.set('order', order);
      setSortOrder(order);
    } else {
      params.delete('order');
    }
    if (view) {
      params.set('view', view);
      setViewMode(view);
    } else {
      params.delete('view');
    }
    if (sort === 'updated' && order === 'desc' && view === 'grid') {
      params.delete('sort');
      params.delete('order');
      params.delete('view');
    }
    if (group) {
      const booksGroup = allBookshelfItems.find(
        (item) => 'name' in item && item.id === group,
      ) as BooksGroup;
      if (booksGroup) {
        setNavBooksGroup(booksGroup);
        params.set('group', group);
      } else {
        params.delete('group');
        navigateToLibrary(router, `${params.toString()}`);
      }
    } else {
      setNavBooksGroup(null);
      params.delete('group');
      navigateToLibrary(router, `${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, libraryBooks]);

  const bookFilter = (item: Book, queryTerm: string) => {
    if (item.deletedAt) return false;
    const searchTerm = new RegExp(queryTerm, 'i');
    const title = formatTitle(item.title);
    const authors = formatAuthors(item.author);
    return (
      searchTerm.test(title) ||
      searchTerm.test(authors) ||
      searchTerm.test(item.format) ||
      (item.groupName && searchTerm.test(item.groupName)) ||
      (item.metadata?.description && searchTerm.test(item.metadata?.description))
    );
  };
  const bookSorter = (a: Book, b: Book) => {
    const uiLanguage = localStorage?.getItem('i18nextLng') || '';
    switch (sortBy) {
      case 'title':
        const aTitle = formatTitle(a.title);
        const bTitle = formatTitle(b.title);
        return aTitle.localeCompare(bTitle, uiLanguage || navigator.language);
      case 'author':
        const aAuthors = formatAuthors(a.author, a?.primaryLanguage || 'en', true);
        const bAuthors = formatAuthors(b.author, b?.primaryLanguage || 'en', true);
        return aAuthors.localeCompare(bAuthors, uiLanguage || navigator.language);
      case 'updated':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case 'created':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'format':
        return a.format.localeCompare(b.format, uiLanguage || navigator.language);
      default:
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }
  };
  const sortOrderMultiplier = sortOrder === 'asc' ? 1 : -1;
  const currentBookshelfItems = navBooksGroup ? navBooksGroup.books : allBookshelfItems;
  const filteredBookshelfItems = currentBookshelfItems
    .filter((item) => {
      if ('name' in item) return item.books.some((book) => bookFilter(book, queryTerm || ''));
      else if (queryTerm) return bookFilter(item, queryTerm);
      return true;
    })
    .sort((a, b) => {
      const uiLanguage = localStorage?.getItem('i18nextLng') || '';
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
        {filteredBookshelfItems.map((item) => (
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
