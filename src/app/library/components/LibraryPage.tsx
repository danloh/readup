import clsx from 'clsx';
import * as React from 'react';
import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { ReadonlyURLSearchParams, useSearchParams } from 'next/navigation';
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
import { getImportErrorMessage } from '@/services/errors';
import { buildBookLookupIndex } from '@/services/bookService';
import { ingestFile } from '@/services/ingestService';
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
import { useAppRouter } from '@/hooks/useAppRouter';
import { useKeyDownActions } from '@/hooks/useKeyDownActions';
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
import { BackupWindow } from './BackupWindow';
import ImportFromFolderDialog, { ImportFromFolderResult } from './ImportFromFolderDialog';

/**
 * Key used to persist the last directory the user imported books from.
 * Stored in localStorage so re-opening the dialog (even across app
 * restarts) seeds the path field with their previous choice — this
 * mirrors the behaviour of native file pickers on most desktop OSes.
 */
const LAST_IMPORT_FOLDER_KEY = 'readup:lastImportFolder';
/**
 * Key used to persist the user's last "Folder Structure" choice
 * ('keep' vs 'flatten'). Restored as the default radio selection on
 * the next dialog open.
 */
const LAST_IMPORT_FOLDER_MODE_KEY = 'readup:lastImportFolderMode';
/**
 * Key used to persist the comma-separated list of FormatGroup ids the
 * user last ticked, e.g. "epub,pdf". Empty / missing falls back to the
 * dialog's built-in default ("epub,pdf").
 */
const LAST_IMPORT_FOLDER_FORMATS_KEY = 'readup:lastImportFolderFormats';
/**
 * Key used to persist the last "File size larger than" threshold (KB).
 * Stored as a stringified non-negative integer.
 */
const LAST_IMPORT_FOLDER_MIN_SIZE_KEY = 'readup:lastImportFolderMinSizeKB';

const LibraryPageWithSearchParams = () => {
  const searchParams = useSearchParams();
  return <LibraryPageContent searchParams={searchParams} />;
};

const LibraryPageContent = (
  { searchParams }: { searchParams: ReadonlyURLSearchParams | null }
) => {
  const router = useAppRouter();
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
  // Seed from the library store: if we already have books in memory (the
  // common reader → library return path), treat the page as loaded
  // immediately. This prevents `showBookshelf` from briefly being false on
  // remount, which used to flash a placeholder before `initLibrary` finished.
  const [libraryLoaded, setLibraryLoaded] = useState(() => libraryBooks.length > 0);
  const [showDetailsBook, setShowDetailsBook] = useState<Book | null>(null);
  const [pendingNavigationBookIds, setPendingNavigationBookIds] = useState<string[] | null>(null);
  const [currentGroupPath, setCurrentGroupPath] = useState<string | undefined>(undefined);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState(currentGroupPath);

  // "Import from folder" dialog state. Held as a small object rather
  // than a boolean because we need a default starting directory to seed
  // the path field, and we want the dialog to remain mounted long
  // enough for the platform's folder picker to overlay it.
  const [importFromFolderState, setImportFromFolderState] = useState<{
    initialDirectory: string;
    initialFolderMode: 'keep' | 'flatten';
    initialSelectedGroupIds?: string[];
    initialMinSizeKB?: number;
  } | null>(null);

  const [currentSeriesAuthorGroup, setCurrentSeriesAuthorGroup] = useState<{
    groupBy: EnhanceGroupByType;
    groupName: string;
  } | null>(null);

  const viewSettings = settings.globalViewSettings;
  const scrollRef = useRef<OverlayScrollbarsComponentRef>(null);
  const containerRef: React.RefObject<HTMLDivElement | null> = useRef(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const getScrollKey = (group: string) => `library-scroll-${group || 'all'}`;

  const saveScrollPosition = (group: string) => {
    const viewport = scrollRef.current?.osInstance()?.elements().viewport;
    if (viewport) {
      const scrollTop = viewport.scrollTop;
      sessionStorage.setItem(getScrollKey(group), scrollTop.toString());
    }
  };

  const restoreScrollPosition = useCallback((group: string) => {
    const savedPosition = sessionStorage.getItem(getScrollKey(group));
    if (savedPosition) {
      const scrollTop = parseInt(savedPosition, 10);
      const viewport = scrollRef.current?.osInstance()?.elements().viewport;
      if (viewport) {
        viewport.scrollTop = scrollTop;
      }
    }
  }, []);

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

  // Strip the empty `group=` param that `handleLibraryNavigation` sets as a
  // workaround for a Next.js 16.2 static-export regression (see the NOTE
  // above `handleLibraryNavigation` for full context). This effect runs
  // after the router.replace() has committed, so React has already
  // re-rendered with the new (empty) group state; we're only rewriting the
  // URL cosmetically via window.history.replaceState — Next.js' patched
  // replaceState will pick up the new canonical URL without triggering
  // another navigation.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (searchParams?.get('group') !== '') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('group');
    const cleanHref = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', cleanHref);
  }, [searchParams]);

  // Unified navigation function that handles scroll position and direction.
  // Workaround for a Next.js 16.2 static-export regression: navigating to a
  // same-pathname URL with an empty search string causes `router.replace()`
  // to silently no-op (e.g. `/library?group=foo` -> `/library`), which broke
  // the breadcrumb "All" button. By always calling `params.set('group',
  // targetGroup)` — including when `targetGroup` is an empty string — the
  // resulting URL becomes `/library?group=` instead of `/library`, which
  // Next.js does commit. The trailing empty `group=` is stripped via a
  // cleanup effect below (purely cosmetic URL rewrite). See
  // /issues/3782.
  const handleLibraryNavigation = useCallback(
    (targetGroup: string) => {
      const currentGroup = searchParams?.get('group') || '';

      // Save current scroll position BEFORE navigation
      saveScrollPosition(currentGroup);

      // Detect and set navigation direction
      const direction = currentGroup && !targetGroup ? 'back' : 'forward';
      document.documentElement.setAttribute('data-nav-direction', direction);

      // Build query params — always `set` so the search string is non-empty
      // even when targetGroup is '' (the Next.js 16.2 workaround).
      const params = new URLSearchParams(searchParams?.toString());
      params.set('group', targetGroup);

      navigateToLibrary(router, `${params.toString()}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, router],
  );

  const handleBackUpOneGroupLevel = () => {
    if (!currentGroupPath) return;
    const segments = currentGroupPath.split('/');
    const parentPath = segments.length > 1 ? segments.slice(0, -1).join('/') : undefined;
    const parentGroupId = parentPath ? getGroupId(parentPath) || '' : '';
    
    handleLibraryNavigation(parentGroupId);
  };

  const handleBackUpOneGroupLevelRef = useRef(handleBackUpOneGroupLevel);
  handleBackUpOneGroupLevelRef.current = handleBackUpOneGroupLevel;
  const triggerBackUpOneGroupLevel = useCallback(() => handleBackUpOneGroupLevelRef.current(), []);

  useKeyDownActions({
    onCancel: triggerBackUpOneGroupLevel,
    enabled: !!appService?.isAndroidApp && !!currentGroupPath,
  });

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

  const handleImportBookDirectory = useCallback(async (event: CustomEvent) => {
    const dirPath: string | undefined = event.detail?.path;
    if (!dirPath) return;
    await handleImportBooksFromDirectory(dirPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    eventDispatcher.on('import-book-files', handleImportBookFiles);
    eventDispatcher.on('import-book-directory', handleImportBookDirectory);
    return () => {
      eventDispatcher.off('import-book-files', handleImportBookFiles);
      eventDispatcher.off('import-book-directory', handleImportBookDirectory);
    };
  }, [handleImportBookFiles, handleImportBookDirectory]);

  useEffect(() => {
    if (appService?.hasWindow) {
      const currentWebview = getCurrentWebview();
      const unlisten = currentWebview.listen('close-reader-window', async () => {
        // Reader windows are independent Tauri webviews with their own
        // libraryStore instance — progress / readingStatus / move-to-front
        // updates from the reader window do NOT propagate to this main
        // window's store. Reload from disk so the library reflects the
        // changes the reader just persisted.
        const appService = await envConfig.getAppService();
        const settings = await appService.loadSettings();
        const library = await appService.loadLibraryBooks();
        setSettings(settings);
        setLibrary(library);
      });
      return () => {
        unlisten.then((fn) => fn());
      };
    }
    return;
  }, [appService, envConfig]);

  // support 'Open with ..' function
  const processOpenWithFiles = React.useCallback(
    async (appService: AppService, openWithFiles: string[], libraryBooks: Book[]) => {
      const settings = await appService.loadSettings();
      const bookIds: string[] = [];
      for (const file of openWithFiles) {
        console.log('Open with book:', file);
        try {
          const temp = appService.isMobile ? false : !settings.autoImportBooksOnOpen;
          const book = await ingestFile(
            {
              file,
              books: libraryBooks,
              transient: temp,
              forceUpload: !!appService.isMobile && !!user,
            },
            { appService, settings, isLoggedIn: !!user },
          );
          if (book) {
            bookIds.push(book.hash);
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

    const hasCachedLibrary = libraryBooks.length > 0;
    const loadingTimeout = hasCachedLibrary ? null : setTimeout(() => setLoading(true), 500);
    const initLibrary = async () => {
      const appService = await envConfig.getAppService();
      const settings = await appService.loadSettings();
      setSettings(settings);

      // Reuse the library from the store when we return from the reader
      const library = hasCachedLibrary ? libraryBooks : await appService.loadLibraryBooks();
      let opened = false;
      if (checkOpenWithBooks) {
        opened = await handleOpenWithBooks(appService, library);
      }
      setCheckOpenWithBooks(opened);
      if (!opened && checkLastOpenBooks && settings.openLastBooks) {
        opened = await handleOpenLastBooks(appService, settings.lastOpenBooks, library);
      }
      setCheckLastOpenBooks(opened);
      // Skip the redundant setLibrary on the cached path: the store already
      // contains the same array reference, and a no-op set would still
      // trigger refreshGroups (O(n) MD5) and a full Bookshelf re-render.
      // The cold path or the openWith / openLast path may have produced a
      // different `library` reference (intent-imported books) — only then
      // do we commit it.
      if (!hasCachedLibrary || library !== libraryBooks) {
        setLibrary(library);
      }
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
    // searchParams is used to tigger parsing OPEN_WITH_FILES
  }, [searchParams]);

  const importBooks = async (files: SelectedFile[], groupId?: string) => {
    setLoading(true);
    const failedImports: Array<{ filename: string; errorMessage: string }> = [];
    const successfulImports: string[] = [];
    
    const { library } = useLibraryStore.getState();
    // Build the lookup index ONCE per import batch so each book lookup is
    // O(1) instead of O(n) over the existing library. importBook also keeps
    // the index updated as new books are appended, so subsequent files in
    // the same batch see the additions.
    const lookupIndex = buildBookLookupIndex(library);

    const processFile = async (selectedFile: SelectedFile): Promise<Book | null> => {
      const file = selectedFile.file || selectedFile.path;
      if (!file) return null;
      if (!appService) return null;
      try {
        const { path, basePath } = selectedFile;
        // `groupId` is treated as a tri-state:
        //   - undefined  → caller didn't specify; derive grouping from
        //                  basePath (Import-from-Folder "keep" mode).
        //   - '' (empty) → caller explicitly wants the library root.
        //   - any string → caller explicitly wants that group.
        // Distinguishing '' from undefined matters for re-imports of an
        // already-known book: without it, a falsy check would silently
        // keep the existingBook's stale groupId/groupName from a prior
        // import instead of moving the book to the root.
        let resolvedGroupId = groupId;
        let resolvedGroupName = groupId !== undefined ? getGroupName(groupId) : undefined;
        if (resolvedGroupId === undefined && path && basePath) {
          const rootPath = getDirPath(basePath);
          resolvedGroupName = getDirPath(path).replace(rootPath, '').replace(/^\//, '');
          resolvedGroupId = getGroupId(resolvedGroupName);
        }
        const book = await ingestFile(
          {
            file,
            books: library,
            lookupIndex,
            groupId: resolvedGroupId,
            groupName: resolvedGroupName,
          },
          { appService, settings, isLoggedIn: !!user },
        );
        if (!book) return null;
        successfulImports.push(book.title);
        return book;
      } catch (error) {
        const filename = typeof file === 'string' ? file : file.name;
        const baseFilename = getFilename(filename);
        const errorMessage = error instanceof Error 
          ? _(getImportErrorMessage(error.message)) 
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
      // Update store state per batch (so the UI can render imported books
      // incrementally) but defer disk persistence until the entire batch is
      // done — saving library.json once per batch of 4 books was the dominant
      // cost for large imports.
      await updateBooks(envConfig, importedBooks, { skipSave: true });
    }

    // Persist the full library once after every file in the batch is done.
    if (successfulImports.length > 0) {
      const finalLibrary = useLibraryStore.getState().library;
      const finalAppService = await envConfig.getAppService();
      await finalAppService.saveLibraryBooks(finalLibrary);
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

  const handleImportBooksFromDirectory = async (dirPath?: string) => {
    if (!appService || !isTauriAppPlatform()) return;
    console.log('Importing books from directory...');
    // When a path is supplied (e.g. URL ingress / drag-drop replay) we
    // honour the legacy "import everything" behaviour without opening
    // the dialog. Manual menu invocations always go through the dialog
    // so users can pick formats and a size threshold before scanning.
    if (dirPath) {
      await runFolderImport({
        directory: dirPath,
        extensions: SUPPORTED_BOOK_EXTS.slice(),
        // The non-dialog path is invoked by URL ingress / drag-drop
        // replay, where the user never picked any filter — keep the
        // synthetic values minimal and non-restrictive.
        selectedGroupIds: [],
        minSizeKB: 0,
        flatten: false,
      });
      return;
    }

    // Restore both the last-used folder and the last folder-structure
    // mode from localStorage. Anything else (or first-time use) falls
    // back to the dialog's built-in defaults.
    const ls = typeof window !== 'undefined' ? window.localStorage : null;
    const storedDirectory = ls?.getItem(LAST_IMPORT_FOLDER_KEY) || '';
    const storedMode = ls?.getItem(LAST_IMPORT_FOLDER_MODE_KEY);
    const storedFormats = ls?.getItem(LAST_IMPORT_FOLDER_FORMATS_KEY);
    const storedMinSize = ls?.getItem(LAST_IMPORT_FOLDER_MIN_SIZE_KEY);
    const parsedFormats = storedFormats
      ? storedFormats
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const parsedMinSize =
      storedMinSize !== null && storedMinSize !== undefined
        ? Number.parseInt(storedMinSize, 10)
        : undefined;
    setImportFromFolderState({
      initialDirectory: storedDirectory,
      initialFolderMode: storedMode === 'flatten' ? 'flatten' : 'keep',
      initialSelectedGroupIds: parsedFormats,
      initialMinSizeKB:
        parsedMinSize !== undefined && Number.isFinite(parsedMinSize) && parsedMinSize >= 0
          ? parsedMinSize
          : undefined,
    });
  };

  /**
   * Pop the platform's native folder picker. Wrapped here (rather than
   * inlined into the dialog) so the same Android-permission / Tauri
   * dialog dance is shared between the dialog's "change folder" button
   * and any future programmatic import paths.
   */
  const pickImportDirectory = async (): Promise<string | undefined> => {
    if (!appService) return undefined;
    // Both mobile platforms now go through the native-bridge picker:
    // Android dispatches ACTION_OPEN_DOCUMENT_TREE, iOS presents
    // UIDocumentPickerViewController(forOpeningContentTypes: [.folder]).
    // Tauri's bundled dialog plugin still rejects mobile folder picks
    // with "FolderPickerNotImplemented", so the native-bridge route is
    // the only working path on either OS.
    let picked: string | undefined;
    if (appService.isAndroidApp || appService.isIOSApp) {
      // Android needs MANAGE_EXTERNAL_STORAGE for absolute-path reads;
      // iOS doesn't have an equivalent gate (the OS picker is itself
      // the permission grant), so the prompt is Android-only.
      if (appService.isAndroidApp && !(await requestStoragePermission())) return undefined;
      const response = await selectDirectory();
      picked = response.path || undefined;
    } else {
      picked = (await appService.selectDirectory?.('read')) || undefined;
    }
    if (picked && !validatePickedDirectory(picked)) {
      // Already toasted from inside the validator. Treat as "no
      // selection" so the caller leaves the dialog's old folder
      // value alone and the user can immediately try again.
      return undefined;
    }
    return picked;
  };

  /**
   * Sanity-check a path returned by the native folder picker before
   * we commit to scanning it. iOS in particular hands back POSIX paths
   * for "virtual" Files-app entries (the "On My iPhone" root, "Recents",
   * etc.) where {@link readDirectory} will then fail with a Tauri
   * fs_scope rejection. There's no way to disable those entries in the
   * picker itself, so we accept the pick, detect the known-bad shapes,
   * and show a clear toast asking the user to drill into a real
   * subfolder. Returns true if the path looks usable.
   */
  const validatePickedDirectory = (path: string): boolean => {
    if (!appService?.isIOSApp) return true;
    // iOS Files exposes "On My iPhone" as a virtual aggregator over
    // every app's `LSSupportsOpeningDocumentsInPlace` container. When
    // the user picks that root, the picker hands us a path whose
    // basename is exactly `File Provider Storage` (the placeholder
    // directory inside our own App Group container that the system
    // uses to materialise external file-provider contents on demand).
    // POSIX reads against it return either nothing or EPERM, and the
    // Tauri fs_scope refuses it outright because it's outside our
    // allowed globs. Drilling into a concrete subfolder produces a
    // normal, readable POSIX path, which is the path we want.
    //
    // These string anchors aren't localized — iOS keeps the on-disk
    // path in English regardless of the device language, so the
    // basename / segment match is stable.
    const trimmed = path.replace(/\/+$/, '');
    const basename = trimmed.split('/').pop() ?? '';
    const isOnMyIPhoneRoot = basename === 'File Provider Storage';
    if (isOnMyIPhoneRoot) {
      eventDispatcher.dispatch('toast', {
        type: 'warning',
        timeout: 6000,
        message: _(
          'iOS doesn\'t allow importing the "On My iPhone" root. Open it and pick a specific subfolder (e.g. Downloads), then try again.',
        ),
      });
      return false;
    }
    return true;
  };

  /**
   * Recursively scan {@link result.directory}, keep files matching one
   * of {@link result.extensions} that are at least
   * {@link result.minSizeKB} KB, and feed them through {@link importBooks}.
   *
   * Two cooperating signals carry "where should the imported books
   * end up" downstream:
   *   1. Each {@link SelectedFile}'s `basePath` — when present,
   *      {@link importBooks}' `processFile` derives a nested groupName
   *      relative to it (`<sub>` / `<sub>/<deeper>`).
   *   2. The `groupId` argument passed to {@link importBooks} —
   *      tri-state per the comment in `processFile`. An explicit
   *      string (including '') wins over basePath-derived grouping.
   *
   * The two flatten/keep modes use these signals as follows:
   *   - keep    → omit basePath? no, *include* basePath; pass
   *               groupId=undefined so basePath wins.
   *   - flatten → omit basePath AND pass an explicit groupId equal to
   *               the user's currently-viewed group ('' = root). The
   *               omitted basePath alone wouldn't be enough on a
   *               re-import, since deduped books carry stale groupIds
   *               from prior sessions; the explicit groupId is what
   *               actually reseats them. Dropping basePath in flatten
   *               mode is therefore belt-and-suspenders.
   */
  const runFolderImport = async (result: ImportFromFolderResult) => {
    if (!appService || !result.directory) return;
    // Last-chance sanity check. The dialog's own pickImportDirectory
    // already validates fresh picks, but `result.directory` can also
    // come from the persisted "last import folder" in localStorage —
    // which may have been a bad path (e.g. user picked "On My iPhone"
    // root last session, app remembered it, user just hits OK now).
    // Catch that here so they get the same clear guidance instead of
    // a fs_scope error from readDirectory below.
    if (!validatePickedDirectory(result.directory)) return;
    // Re-grant scopes for the directory before scanning. This matters
    // when `result.directory` came from somewhere the dialog plugin
    // didn't authorise — typically the persisted "last import folder"
    // restored from localStorage when the user just hit OK without
    // re-picking. Without this, `RemoteFile` reads through the asset
    // protocol later in `importBook` would fail with
    // "asset protocol not configured to allow the path".
    await appService.allowPathsInScopes?.([result.directory], true);
    const exts = result.extensions.map((e) => e.toLowerCase());
    const minSizeBytes = Math.max(0, Math.floor(result.minSizeKB)) * 1024;
    let files;
    try {
      files = await appService.readDirectory(result.directory, 'None');
    } catch (e) {
      // readDirectory can reject for a few related reasons:
      //   - iOS handed us a virtual / file-provider path that the OS
      //     sandbox refuses to enumerate (the validator above catches
      //     the common shapes, but not every file-provider variant);
      //   - the path is outside Tauri's `fs_scope` and scope
      //     extension didn't stick (e.g. an iCloud Drive entry whose
      //     security-scoped resource the system declined to grant);
      //   - the directory was deleted / permissions revoked between
      //     pick and scan.
      // Swallow the rejection (otherwise it bubbles up as an
      // unhandledRejection through Next.js) and surface a friendly
      // message that nudges the user to re-pick.
      const detail = e instanceof Error ? e.message : String(e);
      console.error('Folder import: readDirectory failed', detail);
      const isIOS = !!appService.isIOSApp;
      eventDispatcher.dispatch('toast', {
        type: 'error',
        timeout: 6000,
        message: isIOS
          ? _(
              'Couldn\'t read this folder. Some iOS locations (like the "On My iPhone" root or iCloud Drive top-level) can\'t be scanned — please pick a specific subfolder and try again.',
            )
          : _(
              "Couldn't read this folder. Please pick the folder again, or choose a different location.",
            ),
      });
      return;
    }
    const filtered = files.filter((file) => {
      const ext = file.path.split('.').pop()?.toLowerCase() || '';
      if (!exts.includes(ext)) return false;
      if (minSizeBytes > 0 && file.size < minSizeBytes) return false;
      return true;
    });
    const toImportFiles = await Promise.all(
      filtered.map(async (file) => {
        const fullPath = await joinPaths(result.directory, file.path);
        return result.flatten ? { path: fullPath } : { path: fullPath, basePath: result.directory };
      }),
    );
    if (toImportFiles.length === 0) {
      eventDispatcher.dispatch('toast', {
        type: 'info',
        message: _('No matching books found in the selected folder.'),
      });
      return;
    }
    // When flattening, route the books into whichever group the user
    // is currently viewing (empty string == library root). When
    // preserving structure we leave groupId undefined so importBooks
    // derives nested groupNames from each file's basePath.
    const targetGroupId = result.flatten ? searchParams?.get('group') || '' : undefined;
    importBooks(toImportFiles, targetGroupId);
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
            aria-label={_('Bookshelf')}
            ref={scrollRef}
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
              ref={containerRef}
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
                  {_('Feed & eBook Reader on atproto')}
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
      <BackupWindow />
      {importFromFolderState && (
        <ImportFromFolderDialog
          initialDirectory={importFromFolderState.initialDirectory}
          initialFolderMode={importFromFolderState.initialFolderMode}
          initialSelectedGroupIds={importFromFolderState.initialSelectedGroupIds}
          initialMinSizeKB={importFromFolderState.initialMinSizeKB}
          onPickDirectory={pickImportDirectory}
          onCancel={() => setImportFromFolderState(null)}
          onConfirm={(result) => {
            setImportFromFolderState(null);
            // Remember the folder + filters for next time. Done here
            // (rather than inside pickImportDirectory) so we only
            // persist values the user actually committed to, not
            // ones they cancelled out of.
            if (typeof window !== 'undefined') {
              if (result.directory) {
                window.localStorage.setItem(LAST_IMPORT_FOLDER_KEY, result.directory);
              }
              window.localStorage.setItem(
                LAST_IMPORT_FOLDER_MODE_KEY,
                result.flatten ? 'flatten' : 'keep',
              );
              if (result.selectedGroupIds.length > 0) {
                window.localStorage.setItem(
                  LAST_IMPORT_FOLDER_FORMATS_KEY,
                  result.selectedGroupIds.join(','),
                );
              }
              window.localStorage.setItem(
                LAST_IMPORT_FOLDER_MIN_SIZE_KEY,
                String(result.minSizeKB),
              );
            }
            void runFolderImport(result);
          }}
        />
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
