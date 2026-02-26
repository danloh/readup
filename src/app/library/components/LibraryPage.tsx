import clsx from 'clsx';
import * as React from 'react';
import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { ReadonlyURLSearchParams, useSearchParams } from 'next/navigation';
import { useTransitionRouter } from 'next-view-transitions';
import { MdChevronRight } from 'react-icons/md';
import { LiaInfoCircleSolid } from 'react-icons/lia';
import { 
  OverlayScrollbarsComponent, OverlayScrollbarsComponentRef 
} from 'overlayscrollbars-react';
import 'overlayscrollbars/overlayscrollbars.css';

import { Book } from '@/types/book';
import { AppService } from '@/types/system';
import { EnhanceGroupByType, LibraryGroupByType } from '@/types/settings';
import { navigateToLibrary, navigateToReader } from '@/utils/nav';
import { listFormater } from '@/utils/book';
import { getDirPath, getFilename, joinPaths } from '@/utils/path';
import { eventDispatcher } from '@/utils/event';
import { parseOpenWithFiles } from '@/helpers/openWith';
import { isTauriAppPlatform } from '@/services/environment';
import { SUPPORTED_BOOK_EXTS } from '@/services/constants';
import { transferManager } from '@/services/transferManager';
import { useEnv } from '@/context/EnvContext';
import { useAuth } from '@/context/AuthContext';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeStore } from '@/store/themeStore';
import { useTransferStore } from '@/store/transferStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useUICSS } from '@/hooks/useUICSS';
import { SelectedFile, useFileSelector } from '@/hooks/useFileSelector';
import { useOpenWithBooks } from '@/hooks/useOpenWithBooks';
import useShortcuts from '@/hooks/useShortcuts';
import { useTransferQueue } from '@/hooks/useTransferQueue';
import { selectDirectory } from '@/utils/bridge';
import { requestStoragePermission } from '@/utils/permission';
import DropIndicator from '@/components/DropIndicator';
import ModalPortal from '@/components/ModalPortal';
import Spinner from '@/components/Spinner';
import { useDragDropImport } from '../hooks/useDragDropImport';
import BookDetailModal from './metadata/BookDetailModal';
import LibraryHeader from './LibraryHeader';
import Bookshelf from './Bookshelf';
import { 
  createBookGroups, 
  ensureLibraryGroupByType, 
  findGroupById, 
  getBreadcrumbs 
} from './libraryUtils';
import TransferQueuePanel from './TransferQueuePanel';
import GroupHeader from './GroupHeader';

const LibraryPageWithSearchParams = () => {
  const searchParams = useSearchParams();
  return <LibraryPageContent searchParams={searchParams} />;
};

const LibraryPageContent = (
  { searchParams }: { searchParams: ReadonlyURLSearchParams | null }
) => {
  const router = useTransitionRouter();
  const { envConfig, appService } = useEnv();
  const { user } = useAuth();
  const {
    library: libraryBooks,
    setLibrary,
    updateBooks,
    checkOpenWithBooks,
    checkLastOpenBooks,
    setCheckOpenWithBooks,
    setCheckLastOpenBooks,
    refreshGroups,
    getGroupId,
    getGroupName,
  } = useLibraryStore();
  const _ = useTranslation();
  const { selectFiles } = useFileSelector(appService, _);
  const { safeAreaInsets: insets } = useThemeStore();
  const { settings, setSettings } = useSettingsStore();
  const { setFontLayoutSettingsDialogOpen } = useSettingsStore();
  const { isTransferQueueOpen } = useTransferStore();
  const [loading, setLoading] = useState(false);
  const isInitiating = useRef(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [showDetailsBook, setShowDetailsBook] = useState<Book | null>(null);
  const [pendingNavigationBookIds, setPendingNavigationBookIds] = useState<string[] | null>(null);
  const [currentGroupPath, setCurrentGroupPath] = useState<string | undefined>(undefined);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState(currentGroupPath);

  const [currentSeriesAuthorGroup, setCurrentSeriesAuthorGroup] = useState<{
    groupBy: EnhanceGroupByType;
    groupName: string;
  } | null>(null);

  const viewSettings = settings.globalViewSettings;
  const osRef = useRef<OverlayScrollbarsComponentRef>(null);
  const containerRef: React.RefObject<HTMLDivElement | null> = useRef(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const getScrollKey = (group: string) => `library-scroll-${group || 'all'}`;

  const saveScrollPosition = (group: string) => {
    const viewport = osRef.current?.osInstance()?.elements().viewport;
    if (viewport) {
      const scrollTop = viewport.scrollTop;
      sessionStorage.setItem(getScrollKey(group), scrollTop.toString());
    }
  };

  const restoreScrollPosition = useCallback((group: string) => {
    const savedPosition = sessionStorage.getItem(getScrollKey(group));
    if (savedPosition) {
      const scrollTop = parseInt(savedPosition, 10);
      const viewport = osRef.current?.osInstance()?.elements().viewport;
      if (viewport) {
        viewport.scrollTop = scrollTop;
      }
    }
  }, []);

  // Unified navigation function that handles scroll position and direction
  const handleLibraryNavigation = useCallback(
    (targetGroup: string) => {
      const currentGroup = searchParams?.get('group') || '';

      // Save current scroll position BEFORE navigation
      saveScrollPosition(currentGroup);

      // Detect and set navigation direction
      const direction = currentGroup && !targetGroup ? 'back' : 'forward';
      document.documentElement.setAttribute('data-nav-direction', direction);

      // Build query params
      const params = new URLSearchParams(searchParams?.toString());
      if (targetGroup) {
        params.set('group', targetGroup);
      } else {
        params.delete('group');
      }

      navigateToLibrary(router, `${params.toString()}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, router],
  );

  useTheme({ systemUIVisible: true, appThemeColor: 'base-200' });
  useUICSS();

  useOpenWithBooks();
  useTransferQueue(libraryLoaded);

  const { isDragging } = useDragDropImport();

  useShortcuts({
    onOpenFontLayoutSettings: () => {
      setFontLayoutSettingsDialogOpen(true);
    },
    onOpenBooks: () => {
      handleImportBooksFromFiles();
    },
  });

  useEffect(() => {
    sessionStorage.setItem('lastLibraryParams', searchParams?.toString() || '');
  }, [searchParams]);

  useEffect(() => {
    const groupId = searchParams?.get('group') || '';
    const groupName = getGroupName(groupId);
    setCurrentGroupPath(groupName);
    setNewGroupName(groupName);
  }, [libraryBooks, searchParams, getGroupName]);

  useEffect(() => {
    const group = searchParams?.get('group') || '';
    restoreScrollPosition(group);
  }, [searchParams, restoreScrollPosition]);

  // Track current series/author group for navigation header
  useEffect(() => {
    const groupId = searchParams?.get('group') || '';
    const groupByParam = searchParams?.get('groupBy');
    const groupBy = ensureLibraryGroupByType(groupByParam, settings.libraryGroupBy);

    if (
      groupId &&
      ( groupBy === LibraryGroupByType.Series || 
        groupBy === LibraryGroupByType.Author || 
        groupBy === LibraryGroupByType.Status
      )
    ) {
      // Find the group to get its name
      const allGroups = createBookGroups(
        libraryBooks.filter((b) => !b.deletedAt),
        groupBy,
      );
      const targetGroup = findGroupById(allGroups, groupId);

      if (targetGroup) {
        setCurrentSeriesAuthorGroup({
          groupBy,
          groupName: targetGroup.displayName || targetGroup.name,
        });
      } else {
        setCurrentSeriesAuthorGroup(null);
      }
    } else {
      setCurrentSeriesAuthorGroup(null);
    }
  }, [libraryBooks, searchParams, settings.libraryGroupBy]);

  const handleImportBookFiles = useCallback(async (event: CustomEvent) => {
    const selectedFiles: SelectedFile[] = event.detail.files;
    const groupId: string = event.detail.groupId || '';
    if (selectedFiles.length === 0) return;
    await importBooks(selectedFiles, groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    eventDispatcher.on('import-book-files', handleImportBookFiles);
    return () => {
      eventDispatcher.off('import-book-files', handleImportBookFiles);
    };
  }, [handleImportBookFiles]);

  const handleRefreshLibrary = useCallback(async () => {
    const appService = await envConfig.getAppService();
    const settings = await appService.loadSettings();
    const library = await appService.loadLibraryBooks();
    setSettings(settings);
    setLibrary(library);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envConfig, appService]);

  useEffect(() => {
    if (appService?.hasWindow) {
      const currentWebview = getCurrentWebview();
      const unlisten = currentWebview.listen('close-reader-window', async () => {
        handleRefreshLibrary();
      });
      return () => {
        unlisten.then((fn) => fn());
      };
    }
    return;
  }, [appService, handleRefreshLibrary]);

  // support 'Open with ..' function
  const processOpenWithFiles = React.useCallback(
    async (appService: AppService, openWithFiles: string[], libraryBooks: Book[]) => {
      const settings = await appService.loadSettings();
      const bookIds: string[] = [];
      for (const file of openWithFiles) {
        console.log('Open with book:', file);
        try {
          const temp = appService.isMobile ? false : !settings.autoImportBooksOnOpen;
          const book = await appService.importBook(file, libraryBooks, true, true, false, temp);
          if (book) {
            bookIds.push(book.hash);
          }
          if (user && book && !temp && !book.uploadedAt && settings.autoUpload) {
            setTimeout(() => {
              console.log('Queueing upload for book:', book.title);
              transferManager.queueUpload(book);
              // wait for the initialization of the transfer manager and opening of the book
            }, 3000);
          }
        } catch (error) {
          console.log('Failed to import book:', file, error);
        }
      }
      setLibrary(libraryBooks);
      appService.saveLibraryBooks(libraryBooks);

      // console.log('Opening books:', bookIds);
      if (bookIds.length > 0) {
        setPendingNavigationBookIds(bookIds);
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleOpenLastBooks = async (
    appService: AppService,
    lastBookIds: string[],
    libraryBooks: Book[],
  ) => {
    if (lastBookIds.length === 0) return false;
    const bookIds: string[] = [];
    for (const bookId of lastBookIds) {
      const book = libraryBooks.find((b) => b.hash === bookId);
      if (book && (await appService.isBookAvailable(book))) {
        bookIds.push(book.hash);
      }
    }
    console.log('Opening last books:', bookIds);
    if (bookIds.length > 0) {
      setPendingNavigationBookIds(bookIds);
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (pendingNavigationBookIds) {
      const bookIds = pendingNavigationBookIds;
      setPendingNavigationBookIds(null);
      if (bookIds.length > 0) {
        navigateToReader(router, bookIds);
      }
    }
  }, [pendingNavigationBookIds, appService, router]);

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;

    // support 'Open with ..' function
    const handleOpenWithBooks = async (appService: AppService, library: Book[]) => {
      const openWithFiles = (await parseOpenWithFiles(appService)) || [];
      if (openWithFiles.length > 0) {
        return await processOpenWithFiles(appService, openWithFiles, library);
      }
      return false;
    };

    const loadingTimeout = setTimeout(() => setLoading(true), 300);
    const initLibrary = async () => {
      const appService = await envConfig.getAppService();
      const settings = await appService.loadSettings();
      setSettings(settings);

      // Reuse the library from the store when we return from the reader
      const library = libraryBooks.length > 0 ? libraryBooks : await appService.loadLibraryBooks();
      let opened = false;
      if (checkOpenWithBooks) {
        opened = await handleOpenWithBooks(appService, library);
      }
      setCheckOpenWithBooks(opened);
      if (!opened && checkLastOpenBooks && settings.openLastBooks) {
        opened = await handleOpenLastBooks(appService, settings.lastOpenBooks, library);
      }
      setCheckLastOpenBooks(opened);

      setLibrary(library);
      setLibraryLoaded(true);
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    };

    initLibrary();
    return () => {
      setCheckOpenWithBooks(false);
      setCheckLastOpenBooks(false);
      isInitiating.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const importBooks = async (files: SelectedFile[], groupId?: string) => {
    setLoading(true);
    const failedImports: Array<{ filename: string; errorMessage: string }> = [];
    const successfulImports: string[] = [];
    const errorMap: [string, string][] = [
      ['No chapters detected', _('No chapters detected')],
      ['Failed to parse EPUB', _('Failed to parse the EPUB file')],
      ['Unsupported format', _('This book format is not supported')],
      ['Failed to open file', _('Failed to open the book file')],
      ['Invalid or empty book file', _('The book file is empty')],
      ['Unsupported or corrupted book file', _('The book file is corrupted')],
    ];
    const { library } = useLibraryStore.getState();

    const processFile = async (selectedFile: SelectedFile): Promise<Book | null> => {
      const file = selectedFile.file || selectedFile.path;
      if (!file) return null;
      try {
        const book = await appService?.importBook(file, library);
        console.log('>> Imported book:', book);
        if (!book) return null;
        const { path, basePath } = selectedFile;
        if (groupId) {
          book.groupId = groupId;
          book.groupName = getGroupName(groupId);
        } else if (path && basePath) {
          const rootPath = getDirPath(basePath);
          const groupName = getDirPath(path).replace(rootPath, '').replace(/^\//, '');
          book.groupName = groupName;
          book.groupId = getGroupId(groupName);
        }

        if (user && !book.uploadedAt && settings.autoUpload) {
          console.log('Queueing upload for book:', book.title);
          transferManager.queueUpload(book);
        }
        successfulImports.push(book.title);
        return book;
      } catch (error) {
        const filename = typeof file === 'string' ? file : file.name;
        const baseFilename = getFilename(filename);
        const errorMessage =
          error instanceof Error
            ? errorMap.find(([str]) => error.message.includes(str))?.[1] || error.message
            : '';
        failedImports.push({ filename: baseFilename, errorMessage });
        console.error('Failed to import book:', filename, error);
        return null;
      }
    };

    const concurrency = 4;
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const importedBooks = (await Promise.all(batch.map(processFile))).filter((book) => !!book);
      await updateBooks(envConfig, importedBooks);
    }

    if (failedImports.length > 0) {
      const filenames = failedImports.map((f) => f.filename);
      const errorMessage = failedImports.find((f) => f.errorMessage)?.errorMessage || '';

      eventDispatcher.dispatch('toast', {
        message:
          _('Failed to import book(s): {{filenames}}', {
            filenames: listFormater(false).format(filenames),
          }) + (errorMessage ? `\n${errorMessage}` : ''),
        timeout: 5000,
        type: 'error',
      });
    } else if (successfulImports.length > 0) {
      eventDispatcher.dispatch('toast', {
        message: _('Successfully imported {{count}} book(s)', {
          count: successfulImports.length,
        }),
        timeout: 2000,
        type: 'success',
      });
    }

    setLoading(false);
  };

  const handleImportBooksFromFiles = async () => {
    console.log('Importing books from files...');
    selectFiles({ type: 'books', multiple: true }).then((result) => {
      if (result.files.length === 0 || result.error) return;
      const groupId = searchParams?.get('group') || '';
      importBooks(result.files, groupId);
    });
  };

  const handleImportBooksFromDirectory = async () => {
    if (!appService || !isTauriAppPlatform()) return;

    console.log('Importing books from directory...');
    let importDirectory: string | undefined = '';
    if (appService.isAndroidApp) {
      if (!(await requestStoragePermission())) return;
      const response = await selectDirectory();
      importDirectory = response.path;
    } else {
      const selectedDir = await appService.selectDirectory?.('read');
      importDirectory = selectedDir;
    }
    if (!importDirectory) {
      console.log('No directory selected');
      return;
    }
    const files = await appService.readDirectory(importDirectory, 'None');
    const supportedFiles = files.filter((file) => {
      const ext = file.path.split('.').pop()?.toLowerCase() || '';
      return SUPPORTED_BOOK_EXTS.includes(ext);
    });
    const toImportFiles = await Promise.all(
      supportedFiles.map(async (file) => {
        return {
          path: await joinPaths(importDirectory, file.path),
          basePath: importDirectory,
        };
      }),
    );
    importBooks(toImportFiles);
  };

  const handleShowDetailsBook = (book: Book) => {
    setShowDetailsBook(book);
  };

  const handleNavigateToPath = (path: string | undefined) => {
    const groupId = path ? getGroupId(path) || '' : '';
    handleLibraryNavigation(groupId);
  };

  const handleRenameGroup = async () => {
    const oldGroupName = currentGroupPath;
    if (!newGroupName || !oldGroupName) return;
    // Update the group name for all books in this group and nested groups
    libraryBooks.forEach((book) => {
      if (book.groupName === oldGroupName) {
        book.groupName = newGroupName;
        book.groupId = getGroupId(book.groupName);
        book.updatedAt = Date.now();
      } else if (book.groupName?.startsWith(oldGroupName + '/')) {
        book.groupName = book.groupName.replace(oldGroupName, newGroupName);
        book.groupId = getGroupId(book.groupName);
        book.updatedAt = Date.now();
      }
    });

    setLibrary([...libraryBooks]);
    await appService?.saveLibraryBooks(libraryBooks);
    refreshGroups();
    
    setShowGroupModal(false);
    handleNavigateToPath(newGroupName);
  };

  if (!appService || !insets || checkOpenWithBooks || checkLastOpenBooks) {
    return <div className={clsx('full-height', !appService?.isLinuxApp && 'bg-base-200')} />;
  }

  const showBookshelf = libraryLoaded || libraryBooks.length > 0;

  return (
    <div
      ref={pageRef}
      aria-label='Your Library'
      className={clsx(
        'library-page text-base-content full-height flex select-none flex-col overflow-hidden',
        viewSettings?.isEink ? 'bg-base-100' : 'bg-base-200',
      )}
    >
      <div 
        className='relative top-0 z-40 w-full' 
        role='banner'
        tabIndex={-1}
        aria-label={_('Library Header')}
      >
        <LibraryHeader 
          onImportBooksFromFiles={handleImportBooksFromFiles}
          onImportBooksFromDirectory={
            appService?.canReadExternalDir 
              ? handleImportBooksFromDirectory 
              : undefined
          }
        />
      </div>
      {loading && (
        <div className='fixed inset-0 z-40 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )}
      {currentGroupPath && (
        <div
          className={`transition-all duration-300 ease-in-out ${
            currentGroupPath ? 'opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className='flex flex-wrap items-center gap-y-1 px-4 text-base'>
            <button
              onClick={() => handleNavigateToPath(undefined)}
              className='hover:bg-base-300 text-base-content/85 rounded px-2 py-1'
            >
              {_('All')}
            </button>
            {getBreadcrumbs(currentGroupPath).map((crumb, index, array) => {
              const isLast = index === array.length - 1;
              return (
                <React.Fragment key={index}>
                  <MdChevronRight size={18} className='text-neutral-content' />
                  {isLast ? (
                    <span className='truncate rounded px-2 py-1'>{crumb.name}</span>
                  ) : (
                    <button
                      onClick={() => handleNavigateToPath(crumb.path)}
                      className='hover:bg-base-300 text-base-content/85 truncate rounded px-2 py-1'
                    >
                      {crumb.name}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
            <button
              aria-label={_('Show Group Details')}
              className='show-detail-button p-2'
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowGroupModal(!showGroupModal);
                console.log(currentGroupPath);
              }}
            >
              <LiaInfoCircleSolid size={18} />
            </button>
          </div>
        </div>
      )}
      {currentSeriesAuthorGroup && (
        <GroupHeader
          groupBy={currentSeriesAuthorGroup.groupBy}
          groupName={currentSeriesAuthorGroup.groupName}
        />
      )}
      {showBookshelf &&
        (libraryBooks.some((book) => !book.deletedAt) ? (
          <OverlayScrollbarsComponent
            defer
            aria-label=''
            ref={osRef}
            className='flex-grow'
            options={{ scrollbars: { autoHide: 'scroll' } }}
            events={{
              initialized: (instance) => {
                const { content } = instance.elements();
                if (content) {
                  containerRef.current = content as HTMLDivElement;
                }
              },
            }}
          >
            <div
              className={clsx('scroll-container drop-zone flex-grow', isDragging && 'drag-over')}
              style={{
                paddingTop: '0px',
                paddingRight: `${insets.right}px`,
                paddingBottom: `${insets.bottom}px`,
                paddingLeft: `${insets.left}px`,
              }}
            >
              <DropIndicator />
              <Bookshelf
                libraryBooks={libraryBooks}
                handleShowDetailsBook={handleShowDetailsBook}
                handleLibraryNavigation={handleLibraryNavigation}
              />
            </div>
          </OverlayScrollbarsComponent>
        ) : (
          <div className='hero drop-zone h-screen items-center justify-center'>
            <div className='hero-content text-neutral-content text-center'>
              <div className='max-w-md'>
                <h1 className='mb-5 text-5xl font-bold'>{_('Welcome to Readup')}</h1>
                <p className='mb-5'>
                  {_('Feed & eBook Reader on top of the AT Protocol')}
                </p>
                <button 
                  className='btn btn-primary rounded-xl' 
                  onClick={handleImportBooksFromFiles}
                >
                  {_('Import Books')}
                </button>
              </div>
            </div>
          </div>
        ))
      }
      {showDetailsBook && (
        <BookDetailModal
          isOpen={!!showDetailsBook}
          book={showDetailsBook}
          onClose={() => setShowDetailsBook(null)}
        />
      )}
      {showGroupModal && (
        <ModalPortal>
          <dialog className='modal modal-open'>
            <div className='modal-box'>
              <h3 className='mb-4 text-lg font-bold'>{_('Rename Group')}</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRenameGroup();
                }}
                className='space-y-4'
              >
                <div className='form-control'>
                  <input
                    type='text'
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value.trim())}
                    placeholder={_('New Group Name')}
                    className='input input-bordered placeholder:text-sm'
                  />
                </div>
                
                <div className='modal-action'>
                  <button
                    type='button'
                    onClick={() => {
                      setShowGroupModal(false);
                      setNewGroupName(currentGroupPath);
                    }}
                    className='btn btn-sm'
                  >
                    {_('Cancel')}
                  </button>
                  <button type='submit' className='btn btn-sm btn-primary'>
                    {_('Rename')}
                  </button>
                </div>
              </form>
            </div>
          </dialog>
        </ModalPortal>
      )}
      {isTransferQueueOpen && (
        <ModalPortal>
          <TransferQueuePanel />
        </ModalPortal>
      )}
    </div>
  );
};

const LibraryPage = () => {
  return (
    <Suspense fallback={<div className='full-height' />}>
      <LibraryPageWithSearchParams />
    </Suspense>
  );
};

export default LibraryPage;
