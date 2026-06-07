import type { Book } from '@/types/book';
import type { AppService } from '@/types/system';
import { useLibraryStore } from '@/store/libraryStore';

interface LoadSharedBookArgs {
  bookHash: string;
  did: string;
  appService: AppService;
}

/**
 * Make sure the local library has BOTH the Book entry AND the bytes on local fs,
 * so opening the reader at the shared book works without a "Book not found"
 * error.
 *
 * 2 branches:
 *  - Book is AVAILABLE: in library and bytes are present on fs → return book.
 *  - Book is NOT in the local library → load book from PDS.
 */
export const loadSharedBook = async (
  {bookHash, did, appService}: LoadSharedBookArgs
): Promise<Book> => {
  const storeState = useLibraryStore.getState();
  const { setLibrary } = storeState;
  // When the share landing runs this helper, `libraryLoaded` is false because
  // /share/[bookHash] doesn't mount useLibrary(). We load fresh from disk and only
  // push the result back into the store if the store had already been hydrated
  // by useLibrary somewhere else (e.g. /library, /read, /opds). Otherwise we
  // *must not* set libraryLoaded ourselves: useLibrary's init block loads BOTH
  // the library AND `settings.globalReadSettings` in one go, and skips the
  // whole block when libraryLoaded is already true. Setting it prematurely
  // here leaves settings unloaded, and the Reader gate at Reader.tsx
  // (`libraryLoaded && settings.globalReadSettings`) renders the empty
  // fallback — exactly the blank-page symptom.
  const wasLibraryLoaded = storeState.libraryLoaded;
  const library = wasLibraryLoaded ? storeState.library : await appService.loadLibraryBooks();
  const findByHash = (hash: string): Book | undefined =>
    wasLibraryLoaded ? storeState.getBookByHash(hash) : library.find((b) => b.hash === hash);
  const existingBook = findByHash(bookHash);
  const bookAvailable = existingBook && await appService.isBookAvailable(existingBook);

  if (bookAvailable) {
    console.log(`Loading book locally: id=${bookHash}`);
    return existingBook;
  }

  // Load book from PDS using hash (id) and DID
  console.log(`Loading book from PDS: id=${bookHash}, did=${did}`);
  const loadedBook = await appService.loadPdsBook(bookHash, did, library);

  if (!loadedBook) {
    console.error('Failed to load book from PDS');
    throw new Error('Could not load book from PDS');
  }

  // Save updated library with the new book
  await appService.saveLibraryBooks(library);
  if (wasLibraryLoaded) setLibrary(library);

  return loadedBook;
};
