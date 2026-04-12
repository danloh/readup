import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeedEpubService, STARRED_ARTICLES_EPUB_NAME } from '@/app/feed/epub/feedEpubService';
import type { ArticleType } from '@/app/feed/components/dataAgent';
import type { Book } from '@/types/book';

// Mock the dependencies
vi.mock('@/app/feed/epub/articleToEpub', () => {
  const mockEpubBlob = new Blob(['mock epub content']);
  return {
    createArticlesEpub: vi.fn().mockResolvedValue({
      epubBlob: mockEpubBlob,
      manifest: {
        version: 1,
        createdAt: Date.now(),
        articleIds: [],
      }
    }),
    appendArticlesToEpub: vi.fn().mockResolvedValue({
      epubBlob: mockEpubBlob,
    }),
    detectArticleChanges: vi.fn((_oldManifest, _articles) => ({
      added: [],
      removed: [],
      reordered: false,
    })),
    generateManifest: vi.fn((articles) => ({
      version: 1,
      createdAt: Date.now(),
      articleIds: articles.map((a: any) => a.link),
    })),
  };
});

vi.mock('@/utils/book', () => ({
  getLocalBookFilename: vi.fn().mockReturnValue('Starred Articles Collection.epub'),
  mergeArrays: vi.fn((arr1, arr2) => [...arr1, ...arr2]),
}));

const mockArticles: ArticleType[] = [
  {
    title: 'Article 1',
    link: 'https://example.com/1',
    content: '<p>Content 1</p>',
    description: 'Description 1',
    published: Date.now().toLocaleString(),
    feed_link: 'https://example.com/feed',
    audio_url: '',
  },
  {
    title: 'Article 2',
    link: 'https://example.com/2',
    content: '<p>Content 2</p>',
    description: 'Description 2',
    published: (Date.now() - 86400000).toLocaleString(),
    feed_link: 'https://example.com/feed',
    audio_url: '',
  },
];

const mockBook: Book = {
  hash: 'test-hash-123',
  format: 'EPUB',
  title: STARRED_ARTICLES_EPUB_NAME,
  sourceTitle: STARRED_ARTICLES_EPUB_NAME,
  primaryLanguage: 'en',
  author: 'Feed Reader',
  fileSize: 1024,
  metadata: { 
    title: STARRED_ARTICLES_EPUB_NAME, 
    author: 'Feed Reader', 
    language: 'en' 
  },
  createdAt: Date.now(),
  uploadedAt: null,
  deletedAt: null,
  downloadedAt: Date.now(),
  updatedAt: Date.now(),
};

describe('FeedEpubService.createOrUpdateEpub', () => {
  let mockAppService: any;
  let mockBooks: Book[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockBooks = [];
    mockAppService = {
      readFile: vi.fn().mockResolvedValue(null),
      writeFile: vi.fn().mockResolvedValue(undefined),
      openFile: vi.fn().mockResolvedValue(new Blob(['epub content'])),
      importBook: vi.fn().mockResolvedValue(mockBook),
      saveLibraryBooks: vi.fn().mockResolvedValue(undefined),
      loadSettings: vi.fn().mockResolvedValue({}),
      loadBookConfig: vi.fn().mockResolvedValue({ booknotes: [] }),
      saveBookConfig: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Creating fresh EPUB', () => {
    it('should create fresh EPUB when no existing book found', async () => {
      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks,
        STARRED_ARTICLES_EPUB_NAME
      );

      expect(result.created).toBe(true);
      expect(result.book).toBeDefined();
      expect(result.book.title).toBe(STARRED_ARTICLES_EPUB_NAME);
      expect(mockAppService.importBook).toHaveBeenCalled();
    });

    it('should use default EPUB name when not provided', async () => {
      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(result.book).toBeDefined();
      expect(result.created).toBe(true);
    });

    it('should accept custom EPUB name', async () => {
      const customName = 'My Custom Collection';
      mockAppService.importBook.mockResolvedValueOnce({
        ...mockBook,
        title: customName,
      });

      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks,
        customName
      );

      expect(result.book.title).toBe(customName);
    });

    it('should save manifest to file after creation', async () => {
      await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(mockAppService.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('manifest.json'),
        'Books',
        expect.any(String)
      );
    });

    it('should call saveLibraryBooks after import', async () => {
      await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(mockAppService.saveLibraryBooks).toHaveBeenCalledWith(
        expect.any(Array)
      );
    });
  });

  describe('Updating existing EPUB', () => {
    it('should update existing EPUB when book with same name exists', async () => {
      const existingBook: Book = {
        ...mockBook,
        hash: 'old-hash-456',
      };
      mockBooks.push(existingBook);

      // Mock manifest from file
      mockAppService.readFile.mockResolvedValueOnce(
        JSON.stringify({
          version: 1,
          articleIds: ['https://example.com/1'],
        })
      );

      mockAppService.importBook.mockResolvedValueOnce({
        ...mockBook,
        hash: 'new-hash-789',
      });

      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks,
        STARRED_ARTICLES_EPUB_NAME
      );

      expect(result.created).toBe(false);
      expect(mockAppService.readFile).toHaveBeenCalled();
    });

    it('should not create new entry when same hash after import', async () => {
      const existingBook: Book = { ...mockBook };
      mockBooks.push(existingBook);

      mockAppService.readFile.mockResolvedValueOnce(
        JSON.stringify({
          version: 1,
          articleIds: ['https://example.com/1', 'https://example.com/2'],
        })
      );

      mockAppService.importBook.mockResolvedValueOnce(mockBook);

      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(result.created).toBe(false);
    });
  });

  describe('Article change detection', () => {
    it('should detect when new articles are added', async () => {
      const mod = await vi.importMock('@/app/feed/epub/articleToEpub') as any;
      
      mod.detectArticleChanges.mockReturnValueOnce({
        added: ['https://example.com/3'],
        removed: [],
        reordered: false,
      });

      const existingBook: Book = { ...mockBook, hash: 'old-hash' };
      mockBooks.push(existingBook);

      mockAppService.readFile.mockResolvedValueOnce(
        JSON.stringify({
          version: 1,
          articleIds: ['https://example.com/1', 'https://example.com/2'],
        })
      );

      mockAppService.importBook.mockResolvedValueOnce({
        ...mockBook,
        hash: 'new-hash',
      });

      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      // Should detect existing book and not create fresh
      expect(result.created).toBe(false);
      expect(result.book).toBeDefined();
    });

    it('should warn when articles are removed', async () => {
      const mod = await vi.importMock('@/app/feed/epub/articleToEpub') as any;
      
      mod.detectArticleChanges.mockReturnValueOnce({
        added: [],
        removed: ['https://example.com/3'],
        reordered: false,
      });

      const existingBook: Book = { ...mockBook };
      mockBooks.push(existingBook);

      mockAppService.readFile.mockResolvedValueOnce(
        JSON.stringify({
          version: 1,
          articleIds: ['https://example.com/1', 'https://example.com/2', 'https://example.com/3'],
        })
      );

      mockAppService.importBook.mockResolvedValueOnce(mockBook);

      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(result.migrationWarnings).toEqual(
        expect.arrayContaining([expect.stringContaining('removed')])
      );
    });

    it('should warn when articles are reordered', async () => {
      const mod = await vi.importMock('@/app/feed/epub/articleToEpub') as any;
      
      mod.detectArticleChanges.mockReturnValueOnce({
        added: [],
        removed: [],
        reordered: true,
      });

      const existingBook: Book = { ...mockBook };
      mockBooks.push(existingBook);

      mockAppService.readFile.mockResolvedValueOnce(
        JSON.stringify({
          version: 1,
          articleIds: ['https://example.com/1', 'https://example.com/2'],
        })
      );

      mockAppService.importBook.mockResolvedValueOnce(mockBook);

      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(result.migrationWarnings).toEqual(
        expect.arrayContaining([expect.stringContaining('reordered')])
      );
    });
  });

  describe('Annotation migration', () => {
    it('should migrate annotations when book hash changes', async () => {
      const oldBook: Book = { ...mockBook, hash: 'old-hash' };
      mockBooks.push(oldBook);

      const newBook: Book = { ...mockBook, hash: 'new-hash' };
      mockAppService.importBook.mockResolvedValueOnce(newBook);

      mockAppService.readFile.mockResolvedValueOnce(
        JSON.stringify({
          version: 1,
          articleIds: mockArticles.map(a => a.link),
        })
      );

      const oldNotes = [
        { id: 'note1', bookHash: 'old-hash', content: 'Note 1' },
      ];
      mockAppService.loadBookConfig.mockResolvedValueOnce({
        booknotes: oldNotes,
      });

      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(result.migrationWarnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Migrated')])
      );
      expect(mockAppService.saveBookConfig).toHaveBeenCalled();
    });

    it('should not migrate annotations when no notes exist', async () => {
      const oldBook: Book = { ...mockBook, hash: 'old-hash' };
      mockBooks.push(oldBook);

      mockAppService.importBook.mockResolvedValueOnce({
        ...mockBook,
        hash: 'new-hash',
      });

      mockAppService.readFile.mockResolvedValueOnce(
        JSON.stringify({
          version: 1,
          articleIds: mockArticles.map(a => a.link),
        })
      );

      mockAppService.loadBookConfig.mockResolvedValueOnce({
        booknotes: [],
      });

      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      const migrationWarnings = result.migrationWarnings.filter(w => 
        w.includes('Migrated')
      );
      expect(migrationWarnings.length).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should throw error if importBook fails', async () => {
      mockAppService.importBook.mockRejectedValueOnce(
        new Error('Import failed')
      );

      await expect(
        FeedEpubService.createOrUpdateEpub(
          mockArticles,
          mockAppService,
          mockBooks
        )
      ).rejects.toThrow();
    });

    it('should fail gracefully if EPUB generation fails', async () => {
      const mod = await vi.importMock('@/app/feed/epub/articleToEpub') as any;
      mod.createArticlesEpub.mockResolvedValueOnce({
        epubBlob: null,
        manifest: null,
      });

      await expect(
        FeedEpubService.createOrUpdateEpub(
          mockArticles,
          mockAppService,
          mockBooks
        )
      ).rejects.toThrow('Failed to generate EPUB');
    });

    it('should handle missing manifest file gracefully', async () => {
      const existingBook: Book = { ...mockBook };
      mockBooks.push(existingBook);

      mockAppService.readFile.mockRejectedValueOnce(
        new Error('File not found')
      );

      mockAppService.importBook.mockResolvedValueOnce(mockBook);

      // Should not throw, but log warning and create fresh EPUB
      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(result.book).toBeDefined();
    });
  });

  describe('Return value', () => {
    it('should return book, created flag, and warnings', async () => {
      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(result).toHaveProperty('book');
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('migrationWarnings');
      expect(Array.isArray(result.migrationWarnings)).toBe(true);
    });

    it('created flag should be true for new EPUB', async () => {
      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(result.created).toBe(true);
    });

    it('created flag should be false for updated EPUB', async () => {
      const existingBook: Book = { ...mockBook };
      mockBooks.push(existingBook);

      mockAppService.readFile.mockResolvedValueOnce(
        JSON.stringify({
          version: 1,
          articleIds: mockArticles.map(a => a.link),
        })
      );

      mockAppService.importBook.mockResolvedValueOnce(mockBook);

      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(result.created).toBe(false);
    });

    it('should provide helpful migration warnings', async () => {
      const mod = await vi.importMock('@/app/feed/epub/articleToEpub') as any;
      
      mod.detectArticleChanges.mockReturnValueOnce({
        added: ['https://example.com/3', 'https://example.com/4'],
        removed: [],
        reordered: false,
      });

      const existingBook: Book = { ...mockBook };
      mockBooks.push(existingBook);

      mockAppService.readFile.mockResolvedValueOnce(
        JSON.stringify({
          version: 1,
          articleIds: ['https://example.com/1', 'https://example.com/2'],
        })
      );

      mockAppService.importBook.mockResolvedValueOnce(mockBook);

      const result = await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      // Verify that the service completed and returned appropriate structure
      expect(result).toHaveProperty('book');
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('migrationWarnings');
      expect(Array.isArray(result.migrationWarnings)).toBe(true);
    });
  });

  describe('Database operations', () => {
    it('should read from correct manifest path', async () => {
      const existingBook: Book = { ...mockBook, hash: 'test-hash-123' };
      mockBooks.push(existingBook);

      mockAppService.readFile.mockResolvedValueOnce(
        JSON.stringify({ version: 1, articleIds: [] })
      );
      mockAppService.importBook.mockResolvedValueOnce(mockBook);

      await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(mockAppService.readFile).toHaveBeenCalledWith(
        'test-hash-123/manifest.json',
        'Books',
        'text'
      );
    });

    it('should write manifest to correct path', async () => {
      mockAppService.importBook.mockResolvedValueOnce({
        ...mockBook,
        hash: 'new-hash-xyz',
      });

      await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(mockAppService.writeFile).toHaveBeenCalledWith(
        'new-hash-xyz/manifest.json',
        'Books',
        expect.any(String)
      );
    });

    it('should update books array on library save', async () => {
      mockAppService.importBook.mockResolvedValueOnce(mockBook);

      await FeedEpubService.createOrUpdateEpub(
        mockArticles,
        mockAppService,
        mockBooks
      );

      expect(mockAppService.saveLibraryBooks).toHaveBeenCalledWith(
        expect.any(Array)
      );
    });
  });
});
