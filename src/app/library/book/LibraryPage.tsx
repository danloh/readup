import clsx from 'clsx';
import * as React from 'react';
import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { impactFeedback } from '@tauri-apps/plugin-haptics';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { ReadonlyURLSearchParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  OverlayScrollbarsComponent, OverlayScrollbarsComponentRef 
} from 'overlayscrollbars-react';
import 'overlayscrollbars/overlayscrollbars.css';

import { Book } from '@/types/book';
import { AppService } from '@/types/system';
import { navigateToReader } from '@/utils/nav';
import { listFormater } from '@/utils/book';
import { getDirPath, getFilename, joinPaths } from '@/utils/path';
import { eventDispatcher } from '@/utils/event';
import { parseOpenWithFiles } from '@/helpers/openWith';
import { isTauriAppPlatform } from '@/services/environment';
import { checkForAppUpdates, checkAppReleaseNotes } from '@/helpers/updater';
import { BOOK_ACCEPT_FORMATS, SUPPORTED_BOOK_EXTS } from '@/services/constants';
import { useEnv } from '@/context/EnvContext';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import { useUICSS } from '@/hooks/useUICSS';
import { useThemeStore } from '@/store/themeStore';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { SelectedFile, useFileSelector } from '@/hooks/useFileSelector';
import { useOpenWithBooks } from '@/hooks/useOpenWithBooks';
import useShortcuts from '@/hooks/useShortcuts';
import { lockScreenOrientation, selectDirectory } from '@/utils/bridge';
import {
  tauriHandleClose,
  tauriHandleSetAlwaysOnTop,
  tauriHandleToggleFullScreen,
  tauriQuitApp,
} from '@/utils/window';
import DropIndicator from '@/components/DropIndicator';
import { Toast } from '@/components/Toast';
import Spinner from '@/components/Spinner';
import BookDetailModal from './metadata/BookDetailModal';
import LibraryHeader from './LibraryHeader';
import Bookshelf from './Bookshelf';
import { requestStoragePermission } from '@/utils/permission';

const LibraryPageWithSearchParams = () => {
  const searchParams = useSearchParams();
  return <LibraryPageContent searchParams={searchParams} />;
};

const LibraryPageContent = ({ searchParams }: { searchParams: ReadonlyURLSearchParams | null }) => {
  const router = useRouter();
  const { envConfig, appService } = useEnv();
  const { user } = useAuth();
  const {
    library: libraryBooks,
    setLibrary,
    updateBook,
    checkOpenWithBooks,
    checkLastOpenBooks,
    setCheckOpenWithBooks,
    setCheckLastOpenBooks,
  } = useLibraryStore();
  const _ = useTranslation();
  const { selectFiles } = useFileSelector(appService, _);
  const { safeAreaInsets: insets } = useThemeStore();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const { setFontLayoutSettingsDialogOpen } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const isInitiating = useRef(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [showDetailsBook, setShowDetailsBook] = useState<Book | null>(null);
  const [pendingNavigationBookIds, setPendingNavigationBookIds] = useState<string[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const osRef = useRef<OverlayScrollbarsComponentRef>(null);
  const containerRef: React.RefObject<HTMLDivElement | null> = useRef(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useTheme({ systemUIVisible: true, appThemeColor: 'base-200' });
  useUICSS();

  useOpenWithBooks();

  // usePullToRefresh(containerRef, pullLibrary);
  useScreenWakeLock(settings.screenWakeLock);

  useShortcuts({
    onToggleFullscreen: async () => {
      if (isTauriAppPlatform()) {
        await tauriHandleToggleFullScreen();
      }
    },
    onCloseWindow: async () => {
      if (isTauriAppPlatform()) {
        await tauriHandleClose();
      }
    },
    onQuitApp: async () => {
      if (isTauriAppPlatform()) {
        await tauriQuitApp();
      }
    },
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

  // TODO, move to page
  useEffect(() => {
    const doCheckAppUpdates = async () => {
      if (appService?.hasUpdater && settings.autoCheckUpdates) {
        await checkForAppUpdates(_);
      } else if (appService?.hasUpdater === false) {
        checkAppReleaseNotes();
      }
    };
    if (settings.alwaysOnTop) {
      tauriHandleSetAlwaysOnTop(settings.alwaysOnTop);
    }
    doCheckAppUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appService?.hasUpdater, settings]);

  useEffect(() => {
    if (appService?.isMobileApp) {
      lockScreenOrientation({ orientation: 'auto' });
    }
  }, [appService]);

  const handleDropedFiles = async (files: File[] | string[]) => {
    if (files.length === 0) return;
    const supportedFiles = files.filter((file) => {
      let fileExt;
      if (typeof file === 'string') {
        fileExt = file.split('.').pop()?.toLowerCase();
      } else {
        fileExt = file.name.split('.').pop()?.toLowerCase();
      }
      return BOOK_ACCEPT_FORMATS.includes(`.${fileExt}`);
    });
    if (supportedFiles.length === 0) {
      eventDispatcher.dispatch('toast', {
        message: _('No supported files found. Supported formats: {{formats}}', {
          formats: BOOK_ACCEPT_FORMATS,
        }),
        type: 'error',
      });
      return;
    }

    if (appService?.hasHaptics) {
      impactFeedback('medium');
    }

    const selectedFiles = supportedFiles.map(
      (file) =>
        ({
          file: typeof file === 'string' ? undefined : file,
          path: typeof file === 'string' ? file : undefined,
        }) as SelectedFile,
    );
    await importBooks(selectedFiles);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement> | DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement> | DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement> | DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const files = Array.from(event.dataTransfer.files);
      handleDropedFiles(files);
    }
  };

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

  useEffect(() => {
    const libraryPage = document.querySelector('.library-page');
    if (!appService?.isMobile) {
      libraryPage?.addEventListener('dragover', handleDragOver as unknown as EventListener);
      libraryPage?.addEventListener('dragleave', handleDragLeave as unknown as EventListener);
      libraryPage?.addEventListener('drop', handleDrop as unknown as EventListener);
    }

    if (isTauriAppPlatform()) {
      const unlisten = getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type === 'over') {
          setIsDragging(true);
        } else if (event.payload.type === 'drop') {
          setIsDragging(false);
          handleDropedFiles(event.payload.paths);
        } else {
          setIsDragging(false);
        }
      });
      return () => {
        unlisten.then((fn) => fn());
      };
    }

    return () => {
      if (!appService?.isMobile) {
        libraryPage?.removeEventListener('dragover', handleDragOver as unknown as EventListener);
        libraryPage?.removeEventListener('dragleave', handleDragLeave as unknown as EventListener);
        libraryPage?.removeEventListener('drop', handleDrop as unknown as EventListener);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageRef.current]);

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
        } catch (error) {
          console.log('Failed to import book:', file, error);
        }
      }
      setLibrary(libraryBooks);
      appService.saveLibraryBooks(libraryBooks);

      console.log('Opening books:', bookIds);
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

    const initLogin = async () => {
      const appService = await envConfig.getAppService();
      const settings = await appService.loadSettings();
      if (user) {
        if (!settings.keepLogin) {
          settings.keepLogin = true;
          setSettings(settings);
          saveSettings(envConfig, settings);
        }
      } else if (settings.keepLogin) {
        router.push('/auth');
      }
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

    const handleOpenWithBooks = async (appService: AppService, library: Book[]) => {
      const openWithFiles = (await parseOpenWithFiles(appService)) || [];
      if (openWithFiles.length > 0) {
        return await processOpenWithFiles(appService, openWithFiles, library);
      }
      return false;
    };

    initLogin();
    initLibrary();
    return () => {
      setCheckOpenWithBooks(false);
      setCheckLastOpenBooks(false);
      isInitiating.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const importBooks = async (files: SelectedFile[]) => {
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

    const processFile = async (selectedFile: SelectedFile) => {
      const file = selectedFile.file || selectedFile.path;
      if (!file) return;
      try {
        const book = await appService?.importBook(file, library);
        const { path, basePath } = selectedFile;
        if (book && path && basePath) {
          const rootPath = getDirPath(basePath);
          const groupName = getDirPath(path).replace(rootPath, '').replace(/^\//, '');
          book.groupName = groupName;
          // book.groupId = getGroupId(groupName);
          await updateBook(envConfig, book);
        }

        if (book) {
          successfulImports.push(book.title);
        }
      } catch (error) {
        const filename = typeof file === 'string' ? file : file.name;
        const baseFilename = getFilename(filename);
        const errorMessage =
          error instanceof Error
            ? errorMap.find(([str]) => error.message.includes(str))?.[1] || error.message
            : '';
        failedImports.push({ filename: baseFilename, errorMessage });
        console.error('Failed to import book:', filename, error);
      }
    };

    const concurrency = 4;
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      await Promise.all(batch.map(processFile));
    }
    // pushLibrary(); // FIXME

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

    setLibrary([...library]);

    appService?.saveLibraryBooks(library);
    setLoading(false);
  };

  const handleImportBooksFromFiles = async () => {
    console.log('Importing books from files...');
    selectFiles({ type: 'books', multiple: true }).then((result) => {
      if (result.files.length === 0 || result.error) return;
      importBooks(result.files);
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

  if (!appService || !insets || checkOpenWithBooks || checkLastOpenBooks) {
    return <div className={clsx('full-height', !appService?.isLinuxApp && 'bg-base-200')} />;
  }

  const showBookshelf = libraryLoaded || libraryBooks.length > 0;

  return (
    <div
      ref={pageRef}
      className={clsx(
        'library-page text-base-content full-height flex select-none flex-col overflow-hidden',
      )}
    >
      <div className='top-0 z-40 w-full'>
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
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )}
      {showBookshelf &&
        (libraryBooks.some((book) => !book.deletedAt) ? (
          <OverlayScrollbarsComponent
            defer
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
              />
            </div>
          </OverlayScrollbarsComponent>
        ) : (
          <div className='hero drop-zone h-screen items-center justify-center'>
            <div className='hero-content text-neutral-content text-center'>
              <div className='max-w-md'>
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
      <Toast />
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
