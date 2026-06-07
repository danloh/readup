import { useRouter } from 'next/router';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AuthProvider } from '@/context/AuthContext';
import { EnvProvider, useEnv } from '@/context/EnvContext';
import { CSPostHogProvider } from '@/context/PHContext';
import { Book } from '@/types/book';
import Reader from '@/app/read/components/Reader';
import Spinner from '@/components/Spinner';
import { BOOK_IDS_SEPARATOR } from '@/services/constants';
import { loadSharedBook } from '@/libs/share';

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
  const [isLoading, setIsLoading] = useState(false);
  const { envConfig } = useEnv();

  // if did and ids, may need to download book from PDS
  useEffect(() => {
    const loadBookFromPDS = async () => {
      if (!ids || !did) {
        return;
      }

      const appService = await envConfig.getAppService();
      if (!appService) {
        return;
      }

      const primaryId = ids.split(BOOK_IDS_SEPARATOR).filter(Boolean)[0]?.trim();
      if (!primaryId) {
        return;
      }

      setIsLoading(true);

      try {
        const loadedBook = await loadSharedBook({bookHash: primaryId, did, appService});
        setBook(loadedBook);
      } catch (err) {
        console.warn('Error loading PDS book:', err);
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
