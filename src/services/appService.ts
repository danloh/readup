import { SystemSettings } from '@/types/settings';
import {
  AppPlatform,
  AppService,
  BaseDir,
  DeleteAction,
  DistChannel,
  FileItem,
  FileSystem,
  OsPlatform,
  ResolvedPath,
  SelectDirectoryMode,
} from '@/types/system';
import { Book, BookConfig, BookContent, ImportBookOpts, Review, ViewSettings } from '@/types/book';
import { ArticleType, FeedType } from '@/app/feed/components/dataAgent';
import { getOSPlatform } from '@/utils/misc';
import { ProgressHandler } from '@/utils/transfer';
import type { BookNav } from '@/services/nav';

import { UsageRecord } from './usageService';
import { loadJSONFile, safeSaveJSON } from './persistence';
import { DownloadDataResult } from './bsky/atfile';

import * as BookSvc from './bookService';
import * as CloudSvc from './cloudService';
import * as LibrarySvc from './libraryService';
import * as Settings from './settingsService';

export abstract class BaseAppService implements AppService {
  osPlatform: OsPlatform = getOSPlatform();
  appPlatform: AppPlatform = 'tauri';
  localBooksDir = '';
  isMobile = false;
  isMacOSApp = false;
  isLinuxApp = false;
  isAppDataSandbox = false;
  isAndroidApp = false;
  isIOSApp = false;
  isMobileApp = false;
  isPortableApp = false;
  isDesktopApp = false;
  isAppImage = false;
  isEink = false;
  hasTrafficLight = false;
  hasWindow = false;
  hasWindowBar = false;
  hasContextMenu = false;
  hasRoundedWindow = false;
  hasSafeAreaInset = false;
  hasHaptics = false;
  hasUpdater = false;
  hasOrientationLock = false;
  hasScreenBrightness = false; // TODO
  hasIAP = false;  // TODO
  canCustomizeRootDir = false;
  canReadExternalDir = false;
  distChannel = 'readup' as DistChannel;
  storefrontRegionCode: string | null = null; // TODO
  isOnlineCatalogsAccessible = false; // TODO

  protected abstract fs: FileSystem;
  protected abstract resolvePath(fp: string, base: BaseDir): ResolvedPath;

  abstract init(): Promise<void>;
  abstract setCustomRootDir(customRootDir: string): Promise<void>;
  abstract selectDirectory(mode: SelectDirectoryMode): Promise<string>;
  abstract selectFiles(name: string, extensions: string[]): Promise<string[]>;
  abstract saveFile(
    filename: string,
    content: string | ArrayBuffer,
    options?: { filePath?: string; mimeType?: string },
  ): Promise<boolean>;
  abstract ask(message: string): Promise<boolean>;

  async prepareBooksDir() {
    this.localBooksDir = await this.fs.getPrefix('Books');
  }

  async openFile(path: string, base: BaseDir): Promise<File> {
    return await this.fs.openFile(path, base);
  }

  async copyFile(srcPath: string, dstPath: string, base: BaseDir): Promise<void> {
    return await this.fs.copyFile(srcPath, dstPath, base);
  }

  async readFile(path: string, base: BaseDir, mode: 'text' | 'binary') {
    return await this.fs.readFile(path, base, mode);
  }

  async writeFile(path: string, base: BaseDir, content: string | ArrayBuffer | File) {
    return await this.fs.writeFile(path, base, content);
  }

  async deleteFile(path: string, base: BaseDir): Promise<void> {
    return await this.fs.removeFile(path, base);
  }

  async createDir(path: string, base: BaseDir, recursive: boolean = true): Promise<void> {
    return await this.fs.createDir(path, base, recursive);
  }

  async deleteDir(path: string, base: BaseDir, recursive: boolean = true): Promise<void> {
    return await this.fs.removeDir(path, base, recursive);
  }

  async resolveFilePath(path: string, base: BaseDir): Promise<string> {
    const prefix = await this.fs.getPrefix(base);
    return path ? `${prefix}/${path}` : prefix;
  }

  async readDirectory(path: string, base: BaseDir): Promise<FileItem[]> {
    return await this.fs.readDir(path, base);
  }

  async exists(path: string, base: BaseDir): Promise<boolean> {
    return await this.fs.exists(path, base);
  }

  async getImageURL(path: string): Promise<string> {
    return await this.fs.getImageURL(path);
  }

  private get settingsCtx(): Settings.Context {
    return {
      fs: this.fs,
      isMobile: this.isMobile,
      isEink: this.isEink,
      isAppDataSandbox: this.isAppDataSandbox,
    };
  }

  private get coverCtx(): BookSvc.CoverContext {
    return { fs: this.fs, appPlatform: this.appPlatform, localBooksDir: this.localBooksDir };
  }

  getDefaultViewSettings(): ViewSettings {
    return Settings.getDefaultViewSettings(this.settingsCtx);
  }

  async loadSettings(): Promise<SystemSettings> {
    const settings = await Settings.loadSettings(this.settingsCtx);
    this.localBooksDir = settings.localBooksDir;
    return settings;
  }

  async saveSettings(settings: SystemSettings): Promise<void> {
    await Settings.saveSettings(this.fs, settings);
  }

  getCoverImageUrl = (book: Book): string => BookSvc.getCoverImageUrl(this.coverCtx, book);

  getCoverImageBlobUrl = async (book: Book): Promise<string> =>
    BookSvc.getCoverImageBlobUrl(this.coverCtx, book);

  async getCachedImageUrl(pathOrUrl: string): Promise<string> {
    return BookSvc.getCachedImageUrl(this.coverCtx, pathOrUrl);
  }

  async generateCoverImageUrl(book: Book): Promise<string> {
    return BookSvc.generateCoverImageUrl(this.coverCtx, book);
  }

  async updateCoverImage(book: Book, imageUrl?: string, imageFile?: string): Promise<void> {
    return BookSvc.updateCoverImage(this.coverCtx, book, imageUrl, imageFile);
  }

  async importBook(
    file: string | File,
    books: Book[],
    options: ImportBookOpts = {},
  ): Promise<Book | null> {
    return BookSvc.importBook(this.fs, file, books, {
      saveBookConfig: this.saveBookConfig.bind(this),
      generateCoverImageUrl: this.generateCoverImageUrl.bind(this),
      ...options,
    });
  }

  async deleteBook(book: Book, deleteAction: DeleteAction): Promise<void> {
    return BookSvc.deleteBook(this.fs, book, deleteAction);
  }

  async exportBook(book: Book): Promise<boolean> {
    return BookSvc.exportBook(
      this.fs,
      book,
      this.resolveFilePath.bind(this),
      this.copyFile.bind(this),
      this.saveFile.bind(this),
    );
  }

  // TODO
  async refreshBookMetadata(book: Book): Promise<boolean> {
    return BookSvc.refreshBookMetadata(this.fs, book);
  }

  async isBookAvailable(book: Book): Promise<boolean> {
    return BookSvc.isBookAvailable(this.fs, book);
  }

  async getBookFileSize(book: Book): Promise<number | undefined> {
    return BookSvc.getBookFileSize(this.fs, book);
  }

  async loadBookContent(book: Book): Promise<BookContent> {
    return BookSvc.loadBookContent(this.fs, book);
  }

  async loadBookConfig(book: Book, settings: SystemSettings): Promise<BookConfig> {
    return BookSvc.loadBookConfig(this.fs, book, settings);
  }

  async loadBookNav(book: Book) {
    return BookSvc.loadBookNav(this.fs, book);
  }

  async saveBookNav(book: Book, nav: BookNav) {
    return BookSvc.saveBookNav(this.fs, book, nav);
  }

  async fetchBookDetails(book: Book) {
    return BookSvc.fetchBookDetails(this.fs, book, this.downloadBook.bind(this));
  }

  async saveBookConfig(book: Book, config: BookConfig, settings?: SystemSettings) {
    return BookSvc.saveBookConfig(this.fs, book, config, settings);
  }

  async loadLibraryBooks(): Promise<Book[]> {
    return LibrarySvc.loadLibraryBooks(this.fs, this.generateCoverImageUrl.bind(this));
  }

  async saveLibraryBooks(books: Book[]): Promise<void> {
    return LibrarySvc.saveLibraryBooks(this.fs, books);
  }

  // cloud
  async uploadBook(book: Book, syncConfig = false, onProgress?: ProgressHandler): Promise<void> {
    return CloudSvc.uploadBook(this.fs, book, syncConfig, onProgress);
  }

  async listPdsBooks(): Promise<[Book[], Book[]]> {
    return CloudSvc.listPdsBooks(this);
  }

  async loadPdsBook(
    hash: string,
    did: string,
    books: Book[],
  ): Promise<Book | null> {
    return CloudSvc.loadPdsBook(this.fs, this.generateCoverImageUrl.bind(this), hash, did, books);
  }

  async downloadBook(
    book: Book,
    onlyCover = false,
    redownload = false,
    onProgress?: ProgressHandler,
  ): Promise<void> {
    return CloudSvc.downloadBook(
      this,
      this.fs,
      this.localBooksDir,
      book,
      onlyCover,
      redownload,
      onProgress,
    );
  }

  async uploadData(
    file: File,
    name: string,
    collection?: string,
    onProgress?: ProgressHandler | undefined,
  ): Promise<void> {
    return CloudSvc.uploadData(file, name, collection, onProgress);
  }

  async downloadData(
    rkey: string,
    base: BaseDir,
    override?: boolean,
    collection?: string,
    onProgress?: ProgressHandler,
  ): Promise<DownloadDataResult | undefined> {
    return CloudSvc.downloadData(this, this.fs, rkey, base, override, collection, onProgress);
  }

  async loadFeeds(): Promise<FeedType[]> {
    console.log('Loading Feeds...');
    let feeds: FeedType[] = [];

    const mainResult = await loadJSONFile(this.fs, 'feeds.json', 'Books');
    if (mainResult.success) {
      feeds = mainResult.data as FeedType[];
    } else {
      console.error('Failed to Loaded feeds.json');
    }

    return feeds;
  }

  async saveFeeds(feeds: FeedType[]): Promise<void> {  
    const jsonData = JSON.stringify(feeds, null, 2);
    const saveResults = await Promise.allSettled([
      this.fs.writeFile('feeds.json', 'Books', jsonData),
    ]);
    const mainSuccess = saveResults[0].status === 'fulfilled';
    if (!mainSuccess) {
      throw new Error('Failed to save feeds');
    }
  }

  async loadArticles(): Promise<ArticleType[]> {
    console.log('Loading articles...');
    let articles: ArticleType[] = [];

    const mainResult = await loadJSONFile(this.fs, 'articles.json', 'Books');
    if (mainResult.success) {
      articles = mainResult.data as ArticleType[];
    } else {
      console.error('Failed to Loaded articles.json');
    }

    return articles;
  }

  async saveArticles(articles: ArticleType[]): Promise<void> {  
    const jsonData = JSON.stringify(articles, null, 2);
    const saveResults = await Promise.allSettled([
      this.fs.writeFile('articles.json', 'Books', jsonData),
    ]);
    const mainSuccess = saveResults[0].status === 'fulfilled';
    if (!mainSuccess) {
      throw new Error('Failed to save articles');
    }
  }

  // Usage data management --------------------------------------------------
  async loadUsageData(): Promise<UsageRecord> {
    const mainResult = await loadJSONFile(this.fs, 'usage.json', 'Books');
    if (mainResult.success) {
      return mainResult.data as UsageRecord;
    }
    return {};
  }

  async saveUsageData(data: UsageRecord): Promise<void> {
    await safeSaveJSON(this.fs, 'usage.json', 'Books', data);
  }

  // Reviews data management --------------------------------------------------
  async loadReviews(): Promise<Review[]> {
    const mainResult = await loadJSONFile(this.fs, 'reviews.json', 'Books');
    if (mainResult.success) {
      return mainResult.data as any[];
    }
    return [];
  }

  async saveReviews(data: Review[]): Promise<void> {
    await safeSaveJSON(this.fs, 'reviews.json', 'Books', data);
  }
}
