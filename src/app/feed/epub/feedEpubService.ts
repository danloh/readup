/**
 * Service to manage starred articles EPUB collection
 * Handles creation, updates, and migration of annotations
 * Uses append-only strategy to preserve CFI stability for annotations
 */

import { Book } from '@/types/book';
import { AppService } from '@/types/system';
import { getLocalBookFilename } from '@/utils/book';
import { ArticleType } from '../components/dataAgent';
import { appendArticlesToEpub } from './epubAppendOnly';
import { 
  createArticlesEpub, EpubManifest, detectArticleChanges, generateManifest 
} from './articleToEpub';

export const STARRED_ARTICLES_EPUB_NAME = 'Starred Articles Collection';
const MANIFEST_STORAGE_KEY = 'starred-articles-epub-manifest';
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
   * - Removed articles: User warned, creates fresh EPUB as fallback
   * Keep up to 2 previous versions for rollback
   */
  static async createOrUpdateEpub(
    articles: ArticleType[],
    appService: AppService,
    books: Book[],
    createFresh: boolean = false,
    freshTitle: string = ''
  ): Promise<{
    book: Book;
    created: boolean;
    migrationWarnings: string[];
  }> {
    const existingBook = books.find(b => b.title === STARRED_ARTICLES_EPUB_NAME);
    // Try to load previous manifest from the saved manifest file next to the book.
    // Fallback to localStorage for backward compatibility.
    let oldManifest: EpubManifest | null = null;
    if (existingBook) {
      try {
        const manifestPath = `${existingBook.hash}/manifest.json`;
        const mf = await appService.readFile(manifestPath, 'Books', 'text');
        if (mf) {
          oldManifest = JSON.parse(mf as string) as EpubManifest;
        }
      } catch (e) {
        try {
          oldManifest = localStorage.getItem(MANIFEST_STORAGE_KEY)
            ? JSON.parse(localStorage.getItem(MANIFEST_STORAGE_KEY)!)
            : null;
        } catch {
          oldManifest = null;
        }
      }
    }

    console.log('Existing book lookup:', { found: !!existingBook, title: existingBook?.title, hash: existingBook?.hash, createFresh });

    let epubBlob: Blob | null = null;
    let manifest: EpubManifest | null = null;
    let migrationWarnings: string[] = [];

    // Decide strategy: prefer append-only (keep CFI stable) unless user forced fresh
    if (!createFresh && existingBook && oldManifest) {
      const changeInfo = detectArticleChanges(oldManifest, articles);
      console.log('Changed:', { changeInfo });

      // Always attempt append-only: append any new articles and leave existing ones untouched.
      // If there are removals or reordering, 
      // warn the user that the EPUB will grow and include stale entries.
      if (changeInfo.removed.length > 0) {
        migrationWarnings.push(`⚠️ ${changeInfo.removed.length} article(s) were removed from the current selection. They remain in the EPUB to preserve annotation CFIs.`);
      }
      if (changeInfo.reordered) {
        migrationWarnings.push('⚠️ Articles were reordered in the feed. Append-only update will keep original ordering to preserve annotations.');
      }

      if (changeInfo.added.length > 0) {
        try {
          // Load existing EPUB and append new articles (skip any not found)
          const existingEpub = await this.loadExistingEpubFile(existingBook, appService);
          if (existingEpub) {
            const newArticles = changeInfo.added
              .map(link => articles.find(a => a.link === link))
              .filter(Boolean) as ArticleType[];
            if (newArticles.length > 0) {
              const result = await appendArticlesToEpub(
                existingEpub, newArticles, oldManifest.articleIds.length
              );
              epubBlob = result.epubBlob;
              manifest = generateManifest(articles); // New manifest with full article list
              migrationWarnings.unshift(`✓ Appended ${newArticles.length} new article(s). CFI positions stable.`);
            }
          }
        } catch (error) {
          console.warn('Append-only failed, falling back to fresh EPUB:', error);
        }
      }
    }

    // If we didn't build an EPUB via append-only, create a fresh EPUB
    if (createFresh || !existingBook) {
      console.log('Creating fresh EPUB...');
      const result = await createArticlesEpub(articles);
      epubBlob = result.epubBlob;
      manifest = result.manifest;
    }

    if (!epubBlob || !manifest) {
      throw new Error('Failed to generate EPUB');
    }

    const epubFile = new File(
      [epubBlob],
      freshTitle ? `${freshTitle}.epub` : `${STARRED_ARTICLES_EPUB_NAME}.epub`,
      { type: 'application/epub+zip' }
    );

    console.log('File created:', { name: epubFile.name, size: epubFile.size, fresh: createFresh });
    console.log('Will Migrating annotations to new book hash after importing successfully...');

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
    if (!createFresh && existingBook && oldManifest && book.hash !== existingBook.hash) {
      const sysSettings = await appService.loadSettings();
      const oldConfig = await appService.loadBookConfig(existingBook, sysSettings);
      const oldNotes = oldConfig.booknotes;
      // Update annotations: copy booknotes from old config to new book config
      if (oldConfig && oldNotes && oldNotes.length > 0) {
        console.log('Copying annotations from old book to new book...');
        // change the book hash of the old booknotes
        const newNotes = oldNotes.map(bn => {
          return {
            ...bn,
            bookHash: book.hash,
          }
        });

        // Copy booknotes to new book
        const newConfig = {
          ...oldConfig,
          bookHah: book.hash,
          booknotes: newNotes,
          updatedAt: Date.now(),
        };
        await appService.saveBookConfig(book, newConfig);
        migrationWarnings.unshift(`Migrated ${newNotes.length} annotation(s) to new version`);
      }
    }

    // Remove old book if it exists and is different
    if (!createFresh && existingBook && book.hash !== existingBook.hash) {
      // Save version history (keep last 2)
      if (oldManifest) {
        this.saveVersionHistory(existingBook, oldManifest);
      }
      
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
    try {
      // Save manifest file next to the book files so it can be retrieved later
      const manifestPath = `${book.hash}/manifest.json`;
      await appService.writeFile(manifestPath, 'Books', JSON.stringify(manifest, null, 2));
      console.log('Manifest saved to file:', manifestPath);
      // Keep localStorage as fallback for older versions
      localStorage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(manifest));
    } catch (e) {
      console.warn('Failed to save manifest file, falling back to localStorage:', e);
      localStorage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(manifest));
    }

    return {
      book,
      created: !existingBook,
      migrationWarnings,
    };
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
   * Helper: Load existing EPUB file from book storage
   */
  private static async loadExistingEpubFile(book: Book, appService: AppService): Promise<Blob | null> {
    try {
      const bookFilename = getLocalBookFilename(book);
      const file = await appService.openFile(bookFilename, 'Books');
      return file;
    } catch (error) {
      console.warn('Could not load existing EPUB file:', error);
      return null;
    }
  }
}
