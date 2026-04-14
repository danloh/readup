import { AppService, FileSystem, BaseDir } from '@/types/system';
import { Book } from '@/types/book';
import {
  getDir,
  getLocalBookFilename,
  getCoverFilename,
  mergeArrays,
  getConfigFilename,
  formatTitle,
  formatAuthors,
  getPrimaryLanguage,
} from '@/utils/book';
import { ClosableFile } from '@/utils/file';
import { createProgressHandler, ProgressHandler } from '@/utils/transfer';
import { downloadBookFile, downloadDataFile, DownloadDataResult, downloadPdsBook, listBookRecords, uploadBookFile, UploadBookResult, uploadDataFile } from './bsky/atfile';
import { BookDoc, DocumentLoader } from '@/libs/document';

export async function uploadBook(
  fs: FileSystem, 
  book: Book, 
  syncConfig = false, 
  onProgress?: ProgressHandler
): Promise<void> {
  const coverfp = getCoverFilename(book);
  const coverExist = await fs.exists(coverfp, 'Books');
  const coverFile = coverExist ? await fs.openFile(coverfp, 'Books') : undefined;

  const bookfp = getLocalBookFilename(book);
  let bookFileExist = await fs.exists(bookfp, 'Books');
  let bookFile: File | undefined = undefined;
  if (bookFileExist) {
    bookFile = await fs.openFile(bookfp, 'Books');
  } else if (!bookFileExist && book.url) {
    // download the book from the URL
    bookFile = await fs.openFile(book.url, 'None');
    await fs.writeFile(bookfp, 'Books', await bookFile.arrayBuffer());
    bookFileExist = true;
  }

  let configFileExist = false;
  let configFile: File | undefined = undefined;
  if (syncConfig) {
    const configfp = getConfigFilename(book);
    configFileExist = await fs.exists(configfp, 'Books');
    configFile = configFileExist ? await fs.openFile(configfp, 'Books') : undefined;
  }

  // record the file size in bytes of book
  book.fileSize = bookFile?.size;

  let toUploadFpCount = 0;
  const completedFiles = { count: 0 };
  if (coverExist) {
    toUploadFpCount++;
  }
  if (bookFileExist) {
    toUploadFpCount++;
  }
  if (configFileExist) {
    toUploadFpCount++;
  }

  const handleProgress = createProgressHandler(toUploadFpCount, completedFiles, onProgress);

  // upload and create a book record on PDS
  const res: UploadBookResult = 
    await uploadBookFile(book, bookFile, coverFile, configFile, handleProgress);
  // close files
  const cf = coverFile as ClosableFile;
  if (cf && cf.close) {
    await cf.close();
  }
  const bf = bookFile as ClosableFile;
  if (bf && bf.close) {
    await bf.close();
  }
  const cgf = configFile as ClosableFile;
  if (cgf && cgf.close) {
    await cgf.close();
  }

  if (res.success) {
    book.deletedAt = null;
    book.updatedAt = Date.now();
    book.uploadedAt = Date.now();
    if (syncConfig) {
      book.configSyncedAt = Date.now();
    }
  } else {
    throw new Error('Book file not uploaded');
  }
}

/** 
   * List uploaded books in PDS, with metadata, w/o doc, cover 
   * @returns [books-in-pds, merged-books-local]
  */
 export async function listPdsBooks(appService: AppService): Promise<[Book[], Book[]]> {
  console.log('List books in PDS...');

  const records = await listBookRecords();
  const books = records.map(rec => rec.value.bookmeta as Book);

  // merge with local books and save
  const localBooks = await appService.loadLibraryBooks();
  const mergedBooks = mergeArrays(books, localBooks, 'hash');
  await appService.saveLibraryBooks(mergedBooks);

  return [books, mergedBooks];
}

export async function uploadData(
  file: File,
  name: string,
  collection?: string,
  onProgress?: ProgressHandler,
): Promise<void> {
  console.log(`Upload data file ${name} to ${collection}...`);
  const res = await uploadDataFile(name, file, collection, onProgress);
  if (!res.success) {
    throw new Error('Data file upload failed');
  }
}

export async function downloadData(
  appService: AppService,
  fs: FileSystem,
  rkey: string,
  base: BaseDir,
  override?: boolean,
  collection?: string,
  onProgress?: ProgressHandler,
): Promise<DownloadDataResult | undefined> {
  console.log(`Download data file ${rkey} from ${collection}...`);
  const filename = rkey;
  if (override || !(await fs.exists(filename, base))) {
    const res = await downloadDataFile(rkey, collection, onProgress);
    const blob = res.docData;
    if (!blob) {
      throw new Error('No data blob returned');
    }

    if (!(await fs.exists('', base))) {
      await fs.createDir('', base, true);
    }

    await appService.writeFile(filename, base, await blob.text());
    return res;
  }

  return;
}

export async function downloadBook(
  appService: AppService,
  fs: FileSystem,
  localBooksDir: string,
  book: Book,
  onlyCover = false,
  redownload = false,
  onProgress?: ProgressHandler,
): Promise<void> {
  let bookDownloaded = false;
  let bookCoverDownloaded = false;
  let configDownloaded = false;
  const completedFiles = { count: 0 };
  let toDownloadFpCount = 0;
  const needDownCover = !(await fs.exists(getCoverFilename(book), 'Books')) || redownload;
  const needDownBook =
    (!onlyCover && !(await fs.exists(getLocalBookFilename(book), 'Books'))) || redownload;
  const needDownConfig =
    (!onlyCover && !(await fs.exists(getConfigFilename(book), 'Books'))) || redownload;

  if (needDownCover) {
    toDownloadFpCount++;
  }
  if (needDownBook) {
    toDownloadFpCount++;
  }
  if (needDownConfig) {
    toDownloadFpCount++;
  }

  const handleProgress = createProgressHandler(toDownloadFpCount, completedFiles, onProgress);

  if (!(await fs.exists(getDir(book), 'Books'))) {
    await fs.createDir(getDir(book), 'Books');
  }

  const rkey = book.hash;
  const res = 
    await downloadBookFile(rkey, needDownCover, needDownBook, needDownConfig, handleProgress);
  const coverBlob = res.coverData;
  const docBlob = res.docData;
  const configBlob = res.configData;
  book.fileSize = docBlob?.size;
  // write data to local book dir
  if (needDownCover && coverBlob) {
    const coverDst = `${localBooksDir}/${getCoverFilename(book)}`;
    await appService.writeFile(coverDst, 'None', await coverBlob.arrayBuffer());
    book.coverImageUrl = await appService.generateCoverImageUrl(book);
    bookCoverDownloaded = await fs.exists(coverDst, 'None');
  }
  if (needDownBook && docBlob) {
    const docDst = `${localBooksDir}/${getLocalBookFilename(book)}`;
    await appService.writeFile(docDst, 'None', await docBlob.arrayBuffer());
    bookDownloaded = await fs.exists(docDst, 'None');
  }
  if (needDownConfig && configBlob) {
    const configDst = `${localBooksDir}/${getConfigFilename(book)}`;
    await appService.writeFile(configDst, 'None', await configBlob.arrayBuffer());
    configDownloaded = await fs.exists(configDst, 'None');
  }

  // some books may not have cover image, so we need to check if the book is downloaded
  if (bookDownloaded || (!onlyCover && !needDownBook)) {
    book.downloadedAt = Date.now();
  }
  if ((bookCoverDownloaded || !needDownCover) && !book.coverDownloadedAt) {
    book.coverDownloadedAt = Date.now();
  }
  if (configDownloaded || (!onlyCover && !needDownConfig)) {
    book.configSyncedAt = Date.now();
  }
}

/**
 * Load a book from PDS (Personal Data Server)
 * Downloads and processes a book record using its hash (rkey) and owner's DID
 * Similar to importBook but retrieves from remote PDS instead of local file
 * 
 * @param hash - The record key (usually book hash)
 * @param did - The DID of the record owner
 * @param books - Array of existing books to merge with
 * @returns A promise that resolves to the loaded Book or null
 */
export async function loadPdsBook(
  fs: FileSystem,
  generateCoverImageUrl: (book: Book) => Promise<string>,
  hash: string,
  did: string,
  books: Book[],
): Promise<Book | null> {
  try {
    if (!hash || !did) {
      throw new Error('Hash and DID are required');
    }

    console.log(`Loading book from PDS: hash=${hash}, did=${did}`);

    // Download the book from PDS
    const res = await downloadPdsBook(hash, did);

    const docBlob = res.docData;
    if (!docBlob) {
      throw new Error('No book document found in PDS record');
    }

    // Load and parse the book
    let loadedBook: BookDoc;
    const docFile = new File([docBlob], `${hash}.book`, { type: docBlob.type });
    
    try {
      ({ book: loadedBook } = await new DocumentLoader(docFile).open());
      if (!loadedBook) {
        throw new Error('Unsupported or corrupted book file');
      }
    } catch (error) {
      throw new Error(`Failed to parse book: ${(error as Error).message || error}`);
    }

    // Check if book already exists locally
    const existingBook = books.find((b) => b.hash === hash);
    if (existingBook) {
      existingBook.uploadedAt = Date.now();
      existingBook.updatedAt = Date.now();
    }

    const primaryLanguage = getPrimaryLanguage(loadedBook.metadata.language);
    const fileSize = docBlob.size;
    const now = Date.now();

    const book: Book = {
      hash,
      format: res.record.bookmeta.format || 'epub',
      title: formatTitle(res.record.bookmeta.title || loadedBook.metadata.title),
      sourceTitle: formatTitle(res.record.bookmeta.sourceTitle || loadedBook.metadata.title),
      primaryLanguage: res.record.bookmeta.primaryLanguage || primaryLanguage,
      author: res.record.bookmeta.author || formatAuthors(loadedBook.metadata.author, primaryLanguage),
      fileSize,
      metadata: res.record.bookmeta.metadata || loadedBook.metadata,
      createdAt: existingBook ? existingBook.createdAt : now,
      uploadedAt: now,
      downloadedAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    // Create directory if needed
    if (!(await fs.exists(getDir(book), 'Books'))) {
      await fs.createDir(getDir(book), 'Books');
    }

    // Save book files locally
    const bookFilename = getLocalBookFilename(book);
    if (!(await fs.exists(bookFilename, 'Books'))) {
      await fs.writeFile(bookFilename, 'Books', await docBlob.arrayBuffer());
    }

    // Save cover if available
    if (res.coverData) {
      const coverFilename = getCoverFilename(book);
      if (!(await fs.exists(coverFilename, 'Books'))) {
        await fs.writeFile(coverFilename, 'Books', await res.coverData.arrayBuffer());
      }
    }

    // Save config metadata
    if (!existingBook) {
      books.splice(0, 0, book);
    }

    book.coverImageUrl = await generateCoverImageUrl(book);
    console.log(`✓ Book loaded from PDS: ${book.title}`);
    return existingBook || book;
  } catch (error) {
    console.error('Error loading book from PDS:', error);
    throw error;
  }
}
