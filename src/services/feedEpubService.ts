/**
 * Service to manage starred articles EPUB collection
 * Handles creation, updates, and migration of annotations
 */

import { ArticleType } from '@/app/feed/components/dataAgent';
import { createArticlesEpub, EpubManifest, detectArticleChanges } from '@/libs/articleToEpub';
import { generateMigrationStrategy, ArticleAnnotationMetadata } from '@/libs/annotationMigration';
import { Book } from '@/types/book';
import { AppService } from '@/types/system';

const STARRED_ARTICLES_EPUB_NAME = 'Starred Articles Collection';
const MANIFEST_STORAGE_KEY = 'starred-articles-epub-manifest';
const ANNOTATION_METADATA_KEY = 'starred-articles-annotation-metadata';

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

export class FeedEpubService {
  /**
   * Create or update the starred articles EPUB
   * Returns the book and handles annotation migration if needed
   */
  static async createOrUpdateEpub(
    articles: ArticleType[],
    appService: AppService,
    books: Book[]
  ): Promise<{
    book: Book;
    created: boolean;
    migrationWarnings: string[];
  }> {
    // Check if starred articles EPUB already exists
    // Note: We can't use a fixed hash because appService.importBook computes hash from file content
    // So we'll update any existing "Starred Articles Collection" book by title or just create a new one
    const existingBook = books.find(b => b.title === STARRED_ARTICLES_EPUB_NAME);
    const oldManifest = localStorage.getItem(MANIFEST_STORAGE_KEY)
      ? JSON.parse(localStorage.getItem(MANIFEST_STORAGE_KEY)!)
      : null;

    console.log('Existing book lookup:', { found: !!existingBook, title: existingBook?.title, hash: existingBook?.hash });

    // Generate new EPUB
    const { epubBlob, manifest } = await createArticlesEpub(articles);
    console.log('EPUB generated:', { blobSize: epubBlob.size, manifestVersion: manifest.version });
    
    const epubFile = new File([epubBlob], `${STARRED_ARTICLES_EPUB_NAME}.epub`, {
      type: 'application/epub+zip',
    });
    console.log('File created:', { name: epubFile.name, size: epubFile.size });

    let migrationWarnings: string[] = [];

    // Handle annotation migration if updating existing EPUB
    if (existingBook && oldManifest) {
      const changeInfo = detectArticleChanges(oldManifest, articles);
      if (changeInfo.changed) {
        migrationWarnings = [
          ...changeInfo.added.map(link => `Added article: ${link}`),
          ...changeInfo.removed.map(link => `Removed article: ${link}`),
          ...(changeInfo.reordered ? ['Articles were reordered'] : []),
        ];

        // Load existing annotations for validation
        const annotationMetadataStr = localStorage.getItem(ANNOTATION_METADATA_KEY);
        const annotationMetadata: Map<string, ArticleAnnotationMetadata> = annotationMetadataStr
          ? new Map(JSON.parse(annotationMetadataStr))
          : new Map();

        if (annotationMetadata.size > 0) {
          const config = existingBook.hash 
            ? await appService.loadBookConfig(existingBook, await appService.loadSettings()) 
            : null;
          
          if (config && config.booknotes) {
            const strategy = generateMigrationStrategy(
              oldManifest,
              manifest,
              config.booknotes,
              annotationMetadata
            );

            migrationWarnings.push(
              `Annotation migration strategy: ${strategy.strategy}`,
              ...strategy.warnings,
              ...(strategy.removedAnnotations.length > 0 
                ? [`${strategy.removedAnnotations.length} annotations removed due to article changes`] 
                : [])
            );

            // Update annotations if needed
            if (strategy.removedAnnotations.length > 0) {
              const validAnnotations = [
                ...strategy.validAnnotations,
                ...strategy.migratedAnnotations,
              ];
              config.booknotes = validAnnotations;
              await appService.saveBookConfig(existingBook, config);
            }
          }
        }
      }
    }

    // Import the EPUB file
    const book = await appService.importBook(
      epubFile,
      books,
      true, // saveBook
      true, // saveCover
      existingBook ? true : false, // overwrite if exists
      false // not transient - persist annotations
    );

    if (!book) {
      console.error('appService.importBook() returned null');
      console.error('This might indicate:', {
        blobSize: epubBlob.size,
        fileName: epubFile.name,
        fileSize: epubFile.size,
      });
      throw new Error('Failed to import starred articles EPUB');
    }

    console.log('Book imported successfully:', {
      hash: book.hash,
      title: book.title,
      format: book.format,
      size: book.fileSize,
    });

    // Save the updated books array to persistent storage
    console.log('Saving updated library...');
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
   * Clear all stored data (for testing or reset)
   */
  static clearStoredData(): void {
    localStorage.removeItem(MANIFEST_STORAGE_KEY);
    localStorage.removeItem(ANNOTATION_METADATA_KEY);
  }
}
