import { useRouter } from 'next/router';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AuthProvider } from '@/context/AuthContext';
import { EnvProvider, useEnv } from '@/context/EnvContext';
import { CSPostHogProvider } from '@/context/PHContext';
import { Book } from '@/types/book';
import Reader from '@/app/reader/components/Reader';
import Spinner from '@/components/Spinner';
import { BOOK_IDS_SEPARATOR } from '@/services/constants';

export default function Page() {
  const router = useRouter();
  const ids = router.query['ids'] as string;
  const searchParams = useSearchParams();
  const did = searchParams?.get('did') || '';
  
  // const loc = searchParams?.get('loc') || '';
  // useEffect(() => {
  //   if (loc && id) {
  //     localStorage.setItem(`loc-${id}`, decodeURIComponent(loc));
  //   }
  // }, [id, loc]);

  return (
    <CSPostHogProvider>
      <EnvProvider>
        <AuthProvider>
          <ReadPage ids={ids.trim()} did={did.trim()} />
        </AuthProvider>
      </EnvProvider>
    </CSPostHogProvider>
  );
}

const ReadPage: React.FC<{ ids: string; did: string; }> = ({ ids, did }) => {
  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { envConfig } = useEnv();

  // if did and ids, may need to download book from PDS
  useEffect(() => {
    const loadBookFromPDS = async () => {
      try {
        if (!ids || !did) {
          console.error('Book ID and DID are required');
          return;
        }

        const appService = await envConfig.getAppService();
        if (!appService) {
          console.error('App service is not initialized');
          return;
        }

        setIsLoading(true);
        
        const primaryId = ids.split(BOOK_IDS_SEPARATOR).filter(Boolean)[0]?.trim();
        if (!primaryId) {
          console.error('No valid book id to load book');
          return;
        }

        // check if any book(first) in library and available
        const libraryBooks = await appService.loadLibraryBooks();
        const existingBook = libraryBooks.find((b) => b.hash === primaryId);
        const bookAvailable = existingBook && await appService.isBookAvailable(existingBook);
        
        if (bookAvailable) {
          setBook(existingBook);
          setIsLoading(false);
          console.log(`Loading book locally: id=${primaryId}`);
          return;
        }

        // Load book from PDS using hash (id) and DID
        console.log(`Loading book from PDS: id=${primaryId}, did=${did}`);
        const loadedBook = await appService.loadPdsBook(primaryId, did, libraryBooks);

        if (!loadedBook) {
          console.error('Failed to load book from PDS');
          return;
        }

        // Save updated library with the new book
        await appService.saveLibraryBooks(libraryBooks);

        setBook(loadedBook);
      } catch (err) {
        console.error('Error loading PDS book:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadBookFromPDS();
  }, [ids, did, envConfig]);

  if (isLoading) {
    return (
      <div className='fixed inset-0 z-40 flex items-center justify-center'>
        <Spinner loading text={'Loading Book...'} />
      </div>
    );
  }

  if (did && !book) {
    return (
      <div className='full-height'>
        <p>Book not found</p>
      </div>
    );
  }

  return <Reader ids={ids} />;
}
