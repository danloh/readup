import { useRouter } from 'next/router';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AuthProvider } from '@/context/AuthContext';
import { EnvProvider, useEnv } from '@/context/EnvContext';
import { CSPostHogProvider } from '@/context/PHContext';
import { Book } from '@/types/book';
import Reader from '@/app/reader/components/Reader';
import { useLibraryStore } from '@/store/libraryStore';

export default function Page() {
  const router = useRouter();
  const id = router.query['id'] as string;
  const searchParams = useSearchParams();
  const did = searchParams?.get('did') || '';

  return (
    <CSPostHogProvider>
      <EnvProvider>
        <AuthProvider>
          <ReadPage id={id.trim()} did={did.trim()} />
        </AuthProvider>
      </EnvProvider>
    </CSPostHogProvider>
  );
}

const ReadPage: React.FC<{ id: string; did: string }> = ({ id, did }) => {
  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { envConfig } = useEnv();
  const { library: libraryBooks } = useLibraryStore();

  // useEffect(() => {
  //   if (isInitiating.current) return;
  //   isInitiating.current = true;

  //   const loadingTimeout = setTimeout(() => setIsLoading(true), 300);
  //   const initLibrary = async () => {
  //     const appService = await envConfig.getAppService();
  //     const settings = await appService.loadSettings();
  //     setSettings(settings);

  //     // Reuse the library from the store when we return from the reader
  //     const library = libraryBooks.length > 0 
  //       ? libraryBooks 
  //       : await appService.loadLibraryBooks();
      
  //     setLibrary(library);
  //     setLibraryLoaded(true);
  //     if (loadingTimeout) clearTimeout(loadingTimeout);
  //   };

  //   initLibrary();
    
  //   return () => {
  //     isInitiating.current = false;
  //   };
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [id, did]);

  useEffect(() => {
    const loadBook = async () => {
      try {
        if (!id || !did) {
          throw new Error('Book ID and DID are required');
        }

        const appService = await envConfig.getAppService();
        if (!appService) {
          throw new Error('App service is not initialized');
        }

        setIsLoading(true);
        setError(null);

        // Load book from PDS using hash (id) and DID
        console.log(`Loading book from PDS: id=${id}, did=${did}`);
        const loadedBook = await appService.loadPdsBook(id, did, libraryBooks);

        if (!loadedBook) {
          throw new Error('Failed to load book from PDS');
        }

        // Save updated library with the new book
        await appService.saveLibraryBooks(libraryBooks);

        setBook(loadedBook);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load book';
        console.error('Error loading PDS book:', err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadBook();
  }, [id, did, envConfig]);

  if (!id || !did) {
    return (
      <div className='full-height'>
        <p>No Book ID or DID provided</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='full-height'>
        <p>Loading book...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='full-height'>
        <p>Error loading book: {error}</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className='full-height'>
        <p>Book not found</p>
      </div>
    );
  }

  return <Reader ids={id} />;
}
