import { BookMetadata } from '@/libs/document';
import { ProgressHandler } from '@/utils/transfer';
import type { BookNav } from '@/services/nav';
import { ArticleType, FeedType } from '@/app/feed/components/dataAgent';
import { UsageRecord } from '@/services/usageService';
import { DownloadDataResult } from '@/services/bsky/atfile';
import { SystemSettings } from './settings';
import { Book, BookConfig, BookContent, ImportBookOpts, Review, ViewSettings } from './book';
import { SelectedFile } from '@/hooks/useFileSelector';
import { ImportedDictionary } from '@/services/dictionaries/types';
import { ImportDictionariesResult } from '@/services/dictionaries/dictionaryService';
import { VocabularyBook } from '@/store/vocabularyBookStore';

export type AppPlatform = 'web' | 'tauri';
export type OsPlatform = 'android' | 'ios' | 'macos' | 'windows' | 'linux' | 'unknown';
export type BaseDir = 'Books' | 'Settings' | 'Data' | 'Dictionaries' | 'Fonts' | 'Log' | 'Cache' | 'Temp' | 'None';
export type DeleteAction = 'cloud' | 'local' | 'both';
export type SelectDirectoryMode = 'read' | 'write';
export type DistChannel = 'readup' | 'playstore' | 'appstore' | 'unknown';

export type NativeTouchEventType = {
  type: 'touchstart' | 'touchmove' | 'touchcancel' | 'touchend';
  pointerId: number;
  x: number;
  y: number;
  pressure: number;
  pointerCount: number;
  timestamp: number;
};

export type ResolvedPath = {
  baseDir: number;
  basePrefix: () => Promise<string>;
  fp: string;
  base: BaseDir;
};

export type FileItem = {
  path: string;
  size: number;
};

export type FileInfo = {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtime: Date | null;
  atime: Date | null;
  birthtime: Date | null;
};

export interface SaveLibraryBooksOptions {
  /**
   * Overwrite `library.json` with exactly the given set, allowing it to shrink.
   * Reserved for deliberate, authoritative rewrites (tombstone GC, explicit
   * "clear library", account reset). Routine saves must NOT set this — the
   * default merge-floor protects against silently dropping books on disk.
   */
  replace?: boolean;
}

export interface FileSystem {
  resolvePath(path: string, base: BaseDir): ResolvedPath;
  getURL(path: string): string;
  getBlobURL(path: string, base: BaseDir): Promise<string>;
  getImageURL(path: string): Promise<string>;
  openFile(path: string, base: BaseDir, filename?: string): Promise<File>;
  copyFile(srcPath: string, srcBase: BaseDir, dstPath: string, dstBase: BaseDir): Promise<void>;
  readFile(path: string, base: BaseDir, mode: 'text' | 'binary'): Promise<string | ArrayBuffer>;
  writeFile(path: string, base: BaseDir, content: string | ArrayBuffer | File): Promise<void>;
  removeFile(path: string, base: BaseDir): Promise<void>;
  readDir(path: string, base: BaseDir, extensions?: string[]): Promise<FileItem[]>;
  createDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  removeDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  exists(path: string, base: BaseDir): Promise<boolean>;
  stats(path: string, base: BaseDir): Promise<FileInfo>;
  getPrefix(base: BaseDir): Promise<string>;
}

export interface AppService {
  osPlatform: OsPlatform;
  appPlatform: AppPlatform;
  hasTrafficLight: boolean;
  hasWindow: boolean;
  hasWindowBar: boolean;
  hasContextMenu: boolean;
  hasRoundedWindow: boolean;
  hasSafeAreaInset: boolean;
  hasHaptics: boolean;
  hasUpdater: boolean;
  hasOrientationLock: boolean;
  isMobile: boolean;
  isAppDataSandbox: boolean;
  isMobileApp: boolean;
  isAndroidApp: boolean;
  isIOSApp: boolean;
  isMacOSApp: boolean;
  isLinuxApp: boolean;
  isWindowsApp: boolean;
  isPortableApp: boolean;
  isDesktopApp: boolean;
  isAppImage: boolean;
  isEink: boolean;
  canCustomizeRootDir: boolean;
  canReadExternalDir: boolean;
  supportsCanvasContext2DFilter: boolean;
  supportsViewTransitionsAPI: boolean;
  supportsViewTransitionGroup: boolean;
  distChannel: DistChannel;

  unavailableRootDir: string | null;
  isRootDirUsable(): Promise<boolean>;

  init(): Promise<void>;
  openFile(path: string, base: BaseDir): Promise<File>;
  copyFile(srcPath: string, srcBase: BaseDir, dstPath: string, dstBase: BaseDir): Promise<void>;
  readFile(path: string, base: BaseDir, mode: 'text' | 'binary'): Promise<string | ArrayBuffer>;
  writeFile(path: string, base: BaseDir, content: string | ArrayBuffer | File): Promise<void>;
  createDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  deleteFile(path: string, base: BaseDir): Promise<void>;
  deleteDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  exists(path: string, base: BaseDir): Promise<boolean>;
  isDirectory(path: string, base: BaseDir): Promise<boolean>;
  getImageURL(path: string): Promise<string>;

  setCustomRootDir(customRootDir: string): Promise<void>;
  resolveFilePath(path: string, base: BaseDir): Promise<string>;
  getCachedImageUrl(pathOrUrl: string): Promise<string>;
  selectDirectory(mode: SelectDirectoryMode): Promise<string>;
  selectFiles(name: string, extensions: string[]): Promise<string[]>;
  readDirectory(path: string, base: BaseDir, extensions?: string[]): Promise<FileItem[]>;
  // Pass `null` for `content` when `options.filePath` already points to the
  // file on disk you want to save/share — the native share path reads it
  // directly instead of buffering an in-memory copy.
  saveFile(
    filename: string,
    content: string | ArrayBuffer | null,
    options?: {
      filePath?: string;
      mimeType?: string;
      share?: boolean;
      // Anchor point for the macOS / iPad share sheet. Coordinates are in
      // CSS pixels of the WebView; the sharekit plugin maps them onto the
      // native NSView. Without this, NSSharingServicePicker defaults to
      // (0,0) of the WebView and pops at the top-left of the window.
      sharePos?: { x: number; y: number; preferredEdge?: 'top' | 'bottom' | 'left' | 'right' };
    },
  ): Promise<boolean>;
  // Save an image into the system photo gallery (Android MediaStore). Returns
  // false on platforms without a gallery (web/desktop) or on failure.
  saveImageToGallery(filename: string, content: ArrayBuffer, mimeType: string): Promise<boolean>;
  /**
   * Best-effort: extend the Tauri `fs_scope` and `asset_protocol_scope`
   * to cover the given paths. No-op on web. Used after a directory or
   * file path is recovered from somewhere other than the native picker
   * (e.g. localStorage of the last-used import folder), since the
   * dialog plugin only auto-allows `fs_scope` for paths it returned in
   * the current session.
   */
  allowPathsInScopes?(paths: string[], isDirectory: boolean): Promise<void>;

  getDefaultViewSettings(): ViewSettings;
  loadSettings(): Promise<SystemSettings>;
  saveSettings(settings: SystemSettings): Promise<void>;
  importDictionaries(
    files: SelectedFile[],
    existingDictionaries?: ImportedDictionary[],
  ): Promise<ImportDictionariesResult>;
  deleteDictionary(dict: ImportedDictionary): Promise<void>;
  importBook(file: string | File, books: Book[], options?: ImportBookOpts): Promise<Book | null>;
  loadPdsBook(
    hash: string,
    did: string,
    books: Book[],
  ): Promise<Book | null>;
  deleteBook(book: Book, deleteAction: DeleteAction, purge?: boolean): Promise<void>;
  uploadBook(
    book: Book, 
    syncConfig?: boolean, 
    onlyConfig?: boolean, 
    onProgress?: ProgressHandler
  ): Promise<void>;
  listPdsBooks(): Promise<[Book[], Book[]]>;
  downloadBook(
    book: Book,
    onlyCover?: boolean,
    redownload?: boolean,
    onProgress?: ProgressHandler,
  ): Promise<void>;
  isBookAvailable(book: Book): Promise<boolean>;
  getBookFileSize(book: Book): Promise<number | undefined>;
  loadBookConfig(book: Book, settings: SystemSettings): Promise<BookConfig>;
  fetchBookDetails(book: Book): Promise<BookMetadata>;
  saveBookConfig(book: Book, config: BookConfig, settings?: SystemSettings): Promise<void>;
  loadBookNav(book: Book): Promise<BookNav | null>;
  saveBookNav(book: Book, nav: BookNav): Promise<void>;
  loadBookContent(book: Book): Promise<BookContent>;
  resolveNativeBookFilePath(book: Book): Promise<string | null>;
  loadLibraryBooks(): Promise<Book[]>;
  saveLibraryBooks(books: Book[], options?: SaveLibraryBooksOptions): Promise<void>;
  exportBook(book: Book): Promise<boolean>;
  getCoverImageUrl(book: Book): string;
  getCoverImageBlobUrl(book: Book): Promise<string>;
  generateCoverImageUrl(book: Book): Promise<string>;
  updateCoverImage(book: Book, imageUrl?: string, imageFile?: string): Promise<void>;
  // for data files 
  uploadData(
    file: File,
    name: string,
    collection?: string,
    onProgress?: ProgressHandler,
  ): Promise<void>;
  downloadData(
    rkey: string,
    base: BaseDir,
    override?: boolean,
    collection?: string,
    onProgress?: ProgressHandler,
  ): Promise<DownloadDataResult | undefined>;
  // for ai assistant
  ask(message: string): Promise<boolean>;
  // for feeds
  loadFeeds(): Promise<FeedType[]>;
  saveFeeds(feeds: FeedType[]): Promise<void>;
  loadArticles(): Promise<ArticleType[]>;
  saveArticles(articles: ArticleType[]): Promise<void>;
  saveReviews(data: Review[]): Promise<void>;
  loadReviews(): Promise<Review[]>;
  saveVocabulary(data: VocabularyBook): Promise<void>;
  loadVocabulary(): Promise<VocabularyBook>;
  // for reading tracker 
  loadUsageData(): Promise<UsageRecord>;
  saveUsageData(data: UsageRecord): Promise<void>;
}
