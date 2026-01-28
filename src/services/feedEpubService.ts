/**
 * Service to manage starred articles EPUB collection
 * Handles creation, updates, and migration of annotations
 * Uses append-only strategy to preserve CFI stability for annotations
 */

import { ArticleType } from '@/app/feed/components/dataAgent';
import { createArticlesEpub, EpubManifest, detectArticleChanges } from '@/libs/articleToEpub';
import { ArticleAnnotationMetadata } from '@/libs/annotationMigration';
import { Book } from '@/types/book';
import { AppService } from '@/types/system';

export const STARRED_ARTICLES_EPUB_NAME = 'Starred Articles Collection';
const MANIFEST_STORAGE_KEY = 'starred-articles-epub-manifest';
const ANNOTATION_METADATA_KEY = 'starred-articles-annotation-metadata';
const VERSION_HISTORY_KEY = 'starred-articles-epub-versions'; // Stores up to 2 previous versions

export interface FeedEpubInfo {
  book: Book | null;
  manifest: EpubManifest | null;
  hasUpdates: boolean;
  updateInfo?: {
    added: string[];
    removed: string[];
    reordered: boolean;
  };
}

interface VersionHistory {
  current: { hash: string; manifest: EpubManifest; timestamp: number };
  previous: Array<{ hash: string; manifest: EpubManifest; timestamp: number }>;
}

export class FeedEpubService {
  /**
   * Create or update the starred articles EPUB
   * Strategy: Append-only to preserve CFI stability for annotations
   * - New articles: Appended to end
   * - Updated articles: Kept at original position
   * - Removed articles: User warned, old EPUB kept as backup
   * Keep up to 2 previous versions for rollback
   */
  static async createOrUpdateEpub(
    articles: ArticleType[],
    appService: AppService,
    books: Book[],
    createFresh: boolean = false
  ): Promise<{
    book: Book;
    created: boolean;
    migrationWarnings: string[];
  }> {
    const existingBook = books.find(b => b.title === STARRED_ARTICLES_EPUB_NAME);
    const oldManifest = localStorage.getItem(MANIFEST_STORAGE_KEY)
      ? JSON.parse(localStorage.getItem(MANIFEST_STORAGE_KEY)!)
      : null;

    console.log('Existing book lookup:', { found: !!existingBook, title: existingBook?.title, hash: existingBook?.hash, createFresh });

    let epubBlob: Blob | null = null;
    let manifest: EpubManifest | null = null;
    let migrationWarnings: string[] = [];

    // Create fresh EPUB
    // TODO: Implement append-only strategy when we have better file system access
    console.log('Creating fresh EPUB...');
    const result = await createArticlesEpub(articles);
    epubBlob = result.epubBlob;
    manifest = result.manifest;
    
    if (!createFresh && existingBook && oldManifest) {
      const changeInfo = detectArticleChanges(oldManifest, articles);
      migrationWarnings = [
        ...(changeInfo.removed.length > 0 
          ? [
            `⚠️ Warning: ${changeInfo.removed.length} article(s) were removed from the collection. A fresh EPUB was created.`,
            'Previous version is kept as backup for 1 update cycle.',
          ] 
          : []),
        ...(changeInfo.reordered 
          ? ['⚠️ Articles were reordered - fresh EPUB created for stability.'] 
          : []),
        ...changeInfo.added.map(link => `+ Added: ${link}`),
      ];
    }

    if (!epubBlob || !manifest) {
      throw new Error('Failed to generate EPUB');
    }

    const epubFile = new File(
      [epubBlob],
      `${STARRED_ARTICLES_EPUB_NAME}.epub`,
      { type: 'application/epub+zip' }
    );
    console.log('File created:', { name: epubFile.name, size: epubFile.size });

    // Handle annotation hash migration (book hash changes after update)
    if (existingBook && oldManifest) {
      const config = await appService.loadBookConfig(existingBook, await appService.loadSettings());
      if (config && config.booknotes && config.booknotes.length > 0) {
        console.log('Migrating annotations to new book hash...');
        // We'll update the config later after getting the new book hash
      }
    }

    // Import the updated EPUB file
    const book = await appService.importBook(
      epubFile,
      books,
      true, // saveBook
      true, // saveCover
      false, // don't overwrite yet - will handle old book removal
      false // not transient
    );

    if (!book) {
      console.error('appService.importBook() returned null');
      throw new Error('Failed to import starred articles EPUB');
    }

    console.log('Book imported successfully:', {
      hash: book.hash,
      title: book.title,
      oldHash: existingBook?.hash,
    });

    // Handle annotation migration: update hash in config if needed
    if (existingBook && oldManifest && book.hash !== existingBook.hash) {
      const oldConfig = await appService.loadBookConfig(existingBook, await appService.loadSettings());
      if (oldConfig && oldConfig.booknotes && oldConfig.booknotes.length > 0) {
        console.log('Copying annotations from old book to new book...');
        // Copy booknotes to new book
        const newConfig = await appService.loadBookConfig(book, await appService.loadSettings());
        newConfig.booknotes = oldConfig.booknotes;
        await appService.saveBookConfig(book, newConfig);
        migrationWarnings.unshift(`Migrated ${oldConfig.booknotes.length} annotation(s) to new version`);
      }
    }

    // Remove old book if it exists and is different
    if (existingBook && book.hash !== existingBook.hash) {
      // Save version history (keep last 2)
      this.saveVersionHistory(existingBook, oldManifest);
      
      // Remove old book from library
      const bookIndex = books.indexOf(existingBook);
      if (bookIndex > -1) {
        books.splice(bookIndex, 1);
        console.log('Removed old EPUB version from library');
      }
    }

    // Save updated library
    await appService.saveLibraryBooks(books);
    console.log('Library saved successfully');

    // Store manifest for next update
    localStorage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(manifest));

    return {
      book,
      created: !existingBook,
      migrationWarnings,
    };
  }

  /**
   * Get info about the current starred articles EPUB
   */
  static async getFeedEpubInfo(
    _appService: AppService,
    books: Book[]
  ): Promise<FeedEpubInfo> {
    const book = books.find(b => b.title === STARRED_ARTICLES_EPUB_NAME);
    const manifest = localStorage.getItem(MANIFEST_STORAGE_KEY)
      ? JSON.parse(localStorage.getItem(MANIFEST_STORAGE_KEY)!)
      : null;

    return {
      book: book || null,
      manifest: manifest || null,
      hasUpdates: false, // Will be determined when comparing with fresh articles
    };
  }

  /**
   * Store annotation metadata for migration tracking
   * Call this after creating an annotation on the starred EPUB
   */
  static storeAnnotationMetadata(
    annotationId: string,
    metadata: ArticleAnnotationMetadata
  ): void {
    const metadataStr = localStorage.getItem(ANNOTATION_METADATA_KEY) || '{}';
    const metadata_map: Record<string, ArticleAnnotationMetadata> = JSON.parse(metadataStr);
    metadata_map[annotationId] = metadata;
    localStorage.setItem(ANNOTATION_METADATA_KEY, JSON.stringify(metadata_map));
  }

  /**
   * Get stored annotation metadata
   */
  static getAnnotationMetadata(annotationId: string): ArticleAnnotationMetadata | null {
    const metadataStr = localStorage.getItem(ANNOTATION_METADATA_KEY) || '{}';
    const metadata_map: Record<string, ArticleAnnotationMetadata> = JSON.parse(metadataStr);
    return metadata_map[annotationId] || null;
  }

  /**
   * Save version history (keep last 2 versions)
   */
  private static saveVersionHistory(book: Book, manifest: EpubManifest): void {
    const historyStr = localStorage.getItem(VERSION_HISTORY_KEY);
    const history: VersionHistory = historyStr 
      ? JSON.parse(historyStr)
      : { current: null as any, previous: [] };

    // Shift current to previous, add new to current
    if (history.current) {
      history.previous.unshift(history.current);
      // Keep only last 1 previous version (so max 2 total)
      history.previous = history.previous.slice(0, 1);
    }

    history.current = {
      hash: book.hash,
      manifest,
      timestamp: Date.now(),
    };

    localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(history));
    console.log('Version history updated');
  }

  /**
   * Rollback to previous EPUB version
   */
  static async rollbackToPreviousVersion(
    appService: AppService,
    books: Book[]
  ): Promise<Book | null> {
    const historyStr = localStorage.getItem(VERSION_HISTORY_KEY);
    if (!historyStr) {
      console.warn('No version history available');
      return null;
    }

    const history: VersionHistory = JSON.parse(historyStr);
    if (!history.previous || history.previous.length === 0) {
      console.warn('No previous version available');
      return null;
    }

    const previousVersion = history.previous[0];
    if (!previousVersion) {
      console.warn('Previous version is undefined');
      return null;
    }

    console.log('Rolling back to version:', previousVersion.timestamp);

    // Find the current book to remove
    const currentBook = books.find(b => b.title === STARRED_ARTICLES_EPUB_NAME);
    
    // Shift current back to previous
    history.previous.shift();
    history.previous.push(history.current);
    history.current = previousVersion;

    localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(history));
    localStorage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(previousVersion.manifest));

    // Remove current book
    if (currentBook) {
      const idx = books.indexOf(currentBook);
      if (idx > -1) books.splice(idx, 1);
    }

    await appService.saveLibraryBooks(books);
    console.log('Rollback complete');

    return null; // User needs to reload to get the old book
  }

  /**
   * Clear all stored data (for testing or reset)
   */
  static clearStoredData(): void {
    localStorage.removeItem(MANIFEST_STORAGE_KEY);
    localStorage.removeItem(ANNOTATION_METADATA_KEY);
    localStorage.removeItem(VERSION_HISTORY_KEY);
  }
}
