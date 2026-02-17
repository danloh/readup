import clsx from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragEndEvent,
} from '@dnd-kit/core';

import { Book, BooksGroup } from '@/types/book';
import { LibraryGroupByType, LibrarySortByType, LibraryViewModeType } from '@/types/settings';
import { useEnv } from '@/context/EnvContext';
import { useAutoFocus } from '@/hooks/useAutoFocus';
import { useSettingsStore } from '@/store/settingsStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useTranslation } from '@/hooks/useTranslation';
import { navigateToLibrary, navigateToReader } from '@/utils/nav';
import { saveSysSettings } from '@/helpers/settings';
import Spinner from '@/components/Spinner';
import BookshelfItem, { generateBookshelfItems } from './BookshelfItem';
import { 
  compareSortValues,
  createBookFilter, 
  createBookGroups, 
  createBookSorter, 
  createGroupSorter, 
  createWithinGroupSorter, 
  ensureLibraryGroupByType, 
  ensureLibrarySortByType, 
  getBookSortValue, 
  getGroupSortValue
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
  const { envConfig, appService } = useEnv();
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
  const { 
    setCurrentBookshelf, setLibrary, getGroupName, addGroup, updateBooks, library 
  } = useLibraryStore();

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
      if (params.get('groupBy') === LibraryGroupByType.Group) params.delete('groupBy');
      if (params.get('order') === 'desc') params.delete('order');
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
    if (groupBy === LibraryGroupByType.Group) {
      // Use existing generateBookshelfItems for group mode
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

  // DnD sensors
  const pointerSensor = useSensor(
    PointerSensor, { activationConstraint: { distance: 5 } }
  );
  const sensors = useSensors(pointerSensor);

  // Drag-n-Drop to group books
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    // ensure there is no `:` in book/group's hash/id, so just split
    const parseId = (dndId: string) => {
      const [type, id] = dndId.split(':');
      return { type, id };
    };

    const a = parseId(String(active.id));
    const b = parseId(String(over.id));

    // Only support dragging books (not groups)
    if (a.type !== 'book') return;

    const bookA = library.find((book) => book.hash === a.id);
    if (!bookA) return;

    if (b.type === 'book') {
      const bookB = library.find((book) => book.hash === b.id);
      if (!bookB) return;

      const newGroupName = `${bookA.title.substring(0, 5)}-${bookB.title.substring(0, 5)}`;
      const newGroup = addGroup(newGroupName);

      bookA.groupName = newGroupName;
      bookA.groupId = newGroup.id;
      bookB.groupName = newGroupName;
      bookB.groupId = newGroup.id;
      await updateBooks(envConfig, [bookA, bookB]);
    } else if (b.type === 'group') {
      const groupId = b.id;
      if (!groupId) return;
      const targetGroupName = getGroupName(groupId);
      if (!targetGroupName) return;
      bookA.groupName = targetGroupName;
      bookA.groupId = groupId;
      await updateBooks(envConfig, [bookA]);
    }
    // nav to group view if not groupBy Groups
    const groupBy = settings.libraryGroupBy;
    if (groupBy !== 'group') {
      await saveSysSettings(envConfig, 'libraryGroupBy', 'group');
      const params = new URLSearchParams(searchParams?.toString());
      params.delete('groupBy');
      params.delete('group');
      navigateToLibrary(router, `${params.toString()}`);
    }
  };

  const sortedBookshelfItems = useMemo(() => {
    const sortOrderMultiplier = sortOrder === 'asc' ? 1 : -1;

    // Separate into ungrouped books and groups
    const ungroupedBooks = currentBookshelfItems.filter((item): item is Book => 'format' in item);
    const groups = currentBookshelfItems.filter((item): item is BooksGroup => 'books' in item);

    // Sort books within each group
    const withinGroupSorter = createWithinGroupSorter(groupBy, sortBy, uiLanguage);
    groups.forEach((group) => {
      group.books.sort((a, b) => withinGroupSorter(a, b) * sortOrderMultiplier);
    });

    // Sort ungrouped books - use within-group sorter if we're inside a group
    // (for series, this ensures books are sorted by series index)
    const bookSorter = createBookSorter(sortBy, uiLanguage);
    if (groupId && groupBy !== LibraryGroupByType.Group && groupBy !== LibraryGroupByType.None) {
      ungroupedBooks.sort((a, b) => withinGroupSorter(a, b) * sortOrderMultiplier);
    } else {
      ungroupedBooks.sort((a, b) => bookSorter(a, b) * sortOrderMultiplier);
    }

    // Merge groups and ungrouped books, then sort them together
    const allItems: (Book | BooksGroup)[] = [...groups, ...ungroupedBooks];
    const groupSorter = createGroupSorter(sortBy, uiLanguage);

    allItems.sort((a, b) => {
      const isAGroup = 'books' in a;
      const isBGroup = 'books' in b;

      // If both are groups, use group sorter
      if (isAGroup && isBGroup) {
        return groupSorter(a, b) * sortOrderMultiplier;
      }

      // If both are books, use book sorter
      if (!isAGroup && !isBGroup) {
        return bookSorter(a, b) * sortOrderMultiplier;
      }

      // One is a group, one is a book - compare their sort values
      if (isAGroup && !isBGroup) {
        const groupValue = getGroupSortValue(a, sortBy);
        const bookValue = getBookSortValue(b, sortBy);
        return compareSortValues(groupValue, bookValue, uiLanguage) * sortOrderMultiplier;
      } else if (!isAGroup && isBGroup) {
        const bookValue = getBookSortValue(a, sortBy);
        const groupValue = getGroupSortValue(b, sortBy);
        return compareSortValues(bookValue, groupValue, uiLanguage) * sortOrderMultiplier;
      }
      return 0;
    });

    return allItems;
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
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
          {sortedBookshelfItems.map((item) => {
            const dndId = 'format' in item ? `book:${item.hash}` : `group:${item.id}`;

            const DraggableWrapper: React.FC<{ 
              id: string; 
              children: React.ReactNode 
            }> = ({ id, children }) => {
              const { 
                attributes, 
                listeners, 
                setNodeRef: setDragRef, 
                transform 
              } = useDraggable({ id });
              const { setNodeRef: setDropRef } = useDroppable({ id });
              const setRef = (node: HTMLElement | null) => {
                setDragRef(node);
                setDropRef(node);
              };

              const style = transform
                ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
                : undefined;

              return (
                <div ref={setRef} style={style} {...attributes} {...listeners}>
                  {children}
                </div>
              );
            };

            return (
              <DraggableWrapper 
                key={`library-item-${'hash' in item ? item.hash : item.id}`} 
                id={dndId}
              >
                <BookshelfItem
                  item={item}
                  mode={viewMode as LibraryViewModeType}
                  setLoading={setLoading}
                  handleShowDetailsBook={handleShowDetailsBook}
                />
              </DraggableWrapper>
            );
          })}
        </div>
      </DndContext>
      {loading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )}
    </div>
  );
};

export default Bookshelf;
