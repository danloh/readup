import { BookMetadata } from '@/libs/document';
import { ProgressHandler } from '@/utils/transfer';
import { ArticleType, FeedType } from '@/app/feed/components/dataAgent';
import { UsageRecord } from '@/services/usageService';
import { SystemSettings } from './settings';
import { Book, BookConfig, BookContent, ViewSettings } from './book';

export type AppPlatform = 'web' | 'tauri';
export type OsPlatform = 'android' | 'ios' | 'macos' | 'windows' | 'linux' | 'unknown';
export type BaseDir = 'Books' | 'Settings' | 'Data' | 'Fonts' | 'Log' | 'Cache' | 'Temp' | 'None';
export type DeleteAction = 'cloud' | 'local' | 'both';
export type SelectDirectoryMode = 'read' | 'write';
export type DistChannel = 'readup' | 'playstore' | 'appstore' | 'unknown';

export type NativeTouchEventType = {
  type: 'touchstart' | 'touchcancel' | 'touchend';
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

export interface FileSystem {
  resolvePath(path: string, base: BaseDir): ResolvedPath;
  getURL(path: string): string;
  getBlobURL(path: string, base: BaseDir): Promise<string>;
  getImageURL(path: string): Promise<string>;
  openFile(path: string, base: BaseDir, filename?: string): Promise<File>;
  copyFile(srcPath: string, dstPath: string, base: BaseDir): Promise<void>;
  readFile(path: string, base: BaseDir, mode: 'text' | 'binary'): Promise<string | ArrayBuffer>;
  writeFile(path: string, base: BaseDir, content: string | ArrayBuffer | File): Promise<void>;
  removeFile(path: string, base: BaseDir): Promise<void>;
  readDir(path: string, base: BaseDir): Promise<FileItem[]>;
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
  isPortableApp: boolean;
  isDesktopApp: boolean;
  isAppImage: boolean;
  isEink: boolean;
  canCustomizeRootDir: boolean;
  canReadExternalDir: boolean;
  distChannel: DistChannel;

  init(): Promise<void>;
  openFile(path: string, base: BaseDir): Promise<File>;
  copyFile(srcPath: string, dstPath: string, base: BaseDir): Promise<void>;
  readFile(path: string, base: BaseDir, mode: 'text' | 'binary'): Promise<string | ArrayBuffer>;
  writeFile(path: string, base: BaseDir, content: string | ArrayBuffer | File): Promise<void>;
  createDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  deleteFile(path: string, base: BaseDir): Promise<void>;
  deleteDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  exists(path: string, base: BaseDir): Promise<boolean>;
  getImageURL(path: string): Promise<string>;

  setCustomRootDir(customRootDir: string): Promise<void>;
  resolveFilePath(path: string, base: BaseDir): Promise<string>;
  getCachedImageUrl(pathOrUrl: string): Promise<string>;
  selectDirectory(mode: SelectDirectoryMode): Promise<string>;
  selectFiles(name: string, extensions: string[]): Promise<string[]>;
  readDirectory(path: string, base: BaseDir): Promise<FileItem[]>;
  saveFile(filename: string, content: string | ArrayBuffer, mimeType?: string): Promise<boolean>;

  getDefaultViewSettings(): ViewSettings;
  loadSettings(): Promise<SystemSettings>;
  saveSettings(settings: SystemSettings): Promise<void>;
  importBook(
    file: string | File,
    books: Book[],
    saveBook?: boolean,
    saveCover?: boolean,
    overwrite?: boolean,
    transient?: boolean,
  ): Promise<Book | null>;
  loadPdsBook(
    hash: string,
    did: string,
    books: Book[],
  ): Promise<Book | null>;
  deleteBook(book: Book, deleteAction: DeleteAction): Promise<void>;
  uploadBook(book: Book, syncConfig?: boolean, onProgress?: ProgressHandler): Promise<void>;
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
  loadBookContent(book: Book): Promise<BookContent>;
  loadLibraryBooks(): Promise<Book[]>;
  saveLibraryBooks(books: Book[]): Promise<void>;
  exportBook(book: Book): Promise<boolean>;
  getCoverImageUrl(book: Book): string;
  getCoverImageBlobUrl(book: Book): Promise<string>;
  generateCoverImageUrl(book: Book): Promise<string>;
  updateCoverImage(book: Book, imageUrl?: string, imageFile?: string): Promise<void>;
  // for data files 
  uploadDataFile(
    file: File,
    name: string,
    collection: string,
    onProgress?: ProgressHandler,
  ): Promise<void>;
  downloadDataFile(
    rkey: string,
    collection: string,
    base: BaseDir,
    onProgress?: ProgressHandler,
  ): Promise<string>;
  // for ai assistant
  ask(message: string): Promise<boolean>;
  // for feeds
  loadFeeds(): Promise<FeedType[]>;
  saveFeeds(feeds: FeedType[]): Promise<void>;
  loadArticles(): Promise<ArticleType[]>;
  saveArticles(articles: ArticleType[]): Promise<void>;
  // for reading tracker 
  loadUsageData(): Promise<UsageRecord>;
  saveUsageData(data: UsageRecord): Promise<void>;
}
