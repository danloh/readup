import clsx from 'clsx';
import * as React from 'react';
import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { ReadonlyURLSearchParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  OverlayScrollbarsComponent, OverlayScrollbarsComponentRef 
} from 'overlayscrollbars-react';
import 'overlayscrollbars/overlayscrollbars.css';

import { Book } from '@/types/book';
import { AppService } from '@/types/system';
import { navigateToReader } from '@/utils/nav';
import { getFilename, listFormater } from '@/utils/book';
import { eventDispatcher } from '@/utils/event';
import { parseOpenWithFiles } from '@/helpers/openWith';
import { isTauriAppPlatform } from '@/services/environment';
import { checkForAppUpdates, checkAppReleaseNotes } from '@/helpers/updater';
import { BOOK_ACCEPT_FORMATS } from '@/services/constants';
import { impactFeedback } from '@tauri-apps/plugin-haptics';
import { getCurrentWebview } from '@tauri-apps/api/webview';

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
import { lockScreenOrientation } from '@/utils/bridge';
import {
  tauriHandleSetAlwaysOnTop,
  tauriHandleToggleFullScreen,
  tauriQuitApp,
} from '@/utils/window';

import BookDetailModal from '@/app/library/book/BookDetailModal';
import DropIndicator from '@/components/DropIndicator';
import { Toast } from '@/components/Toast';
import Spinner from '@/components/Spinner';
import LibraryHeader from './LibraryHeader';
import Bookshelf from './Bookshelf';


const LibraryPageWithSearchParams = () => {
  const searchParams = useSearchParams();
  return <LibraryPageContent searchParams={searchParams} />;
};

const LibraryPageContent = ({ searchParams }: { searchParams: ReadonlyURLSearchParams | null }) => {
  const router = useRouter();
  const { envConfig, appService } = useEnv();
  const { token, user } = useAuth();
  const {
    library: libraryBooks,
    setLibrary,
    checkOpenWithBooks,
    checkLastOpenBooks,
    setCheckOpenWithBooks,
    setCheckLastOpenBooks,
  } = useLibraryStore();
  const _ = useTranslation();
  const { selectFiles } = useFileSelector(appService, _);
  const { safeAreaInsets: insets } = useThemeStore();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const isInitiating = useRef(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [showDetailsBook, setShowDetailsBook] = useState<Book | null>(null);
  const [pendingNavigationBookIds, setPendingNavigationBookIds] = useState<string[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const osRef = useRef<OverlayScrollbarsComponentRef>(null);
  const containerRef: React.MutableRefObject<HTMLDivElement | null> = useRef(null);
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
    onQuitApp: async () => {
      if (isTauriAppPlatform()) {
        await tauriQuitApp();
      }
    },
  });

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
      if (token && user) {
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
      const openWithFiles = (await parseOpenWithFiles()) || [];

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
    const failedFiles = [];
    const errorMap: [string, string][] = [
      ['No chapters detected.', _('No chapters detected.')],
      ['Failed to parse EPUB.', _('Failed to parse the EPUB file.')],
      ['Unsupported format.', _('This book format is not supported.')],
    ];
    const { library } = useLibraryStore.getState();
    for (const selectedFile of files) {
      const file = selectedFile.file || selectedFile.path;
      if (!file) continue;
      try {
        // const book = 
          await appService?.importBook(file, library);
        setLibrary([...library]);
        // if (user && book && !book.uploadedAt ) {
        //   console.log('Uploading book:', book.title);
        //   handleBookUpload(book);
        // }
      } catch (error) {
        const filename = typeof file === 'string' ? file : file.name;
        const baseFilename = getFilename(filename);
        failedFiles.push(baseFilename);
        const errorMessage =
          error instanceof Error
            ? errorMap.find(([substring]) => error.message.includes(substring))?.[1] || ''
            : '';
        eventDispatcher.dispatch('toast', {
          message:
            _('Failed to import book(s): {{filenames}}', {
              filenames: listFormater(false).format(failedFiles),
            }) + (errorMessage ? `\n${errorMessage}` : ''),
          type: 'error',
        });
        console.error('Failed to import book:', filename, error);
      }
    }
    appService?.saveLibraryBooks(library);
    setLoading(false);
  };

  const handleImportBooks = async () => {
    console.log('Importing books...');
    selectFiles({ type: 'books', multiple: true }).then((result) => {
      if (result.files.length === 0 || result.error) return;
      importBooks(result.files);
    });
  };

  const handleShowDetailsBook = (book: Book) => {
    setShowDetailsBook(book);
  };

  if (!appService || !insets) {
    return null;
  }

  if (checkOpenWithBooks || checkLastOpenBooks) {
    return (
      loading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )
    );
  }

  return (
    <div
      ref={pageRef}
      className={clsx(
        'library-page bg-base-200 text-base-content flex select-none flex-col overflow-hidden',
      )}
    >
      <div className='top-0 z-40 w-full'>
        <LibraryHeader onImportBooks={handleImportBooks} />
      </div>
      {loading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )}
      {libraryLoaded &&
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
                <button className='btn btn-primary rounded-xl' onClick={handleImportBooks}>
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
    <Suspense
      fallback={
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      }
    >
      <LibraryPageWithSearchParams />
    </Suspense>
  );
};

export default LibraryPage;
