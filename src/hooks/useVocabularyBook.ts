import { useEffect, useRef, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useVocabularyBookStore } from '@/store/vocabularyBookStore';

/**
 * Hook to manage vocabulary book data loading and saving.
 * Automatically loads vocabulary data on mount and provides save functionality.
 */
export const useVocabularyBook = () => {
  const { envConfig } = useEnv();
  const { loadVocabularyBook, saveVocabularyBook } = useVocabularyBookStore();
  const [isLoaded, setIsLoaded] = useState(false);
  const isInitiating = useRef(false);

  // Load vocabulary book on mount
  useEffect(() => {
    if (isInitiating.current || isLoaded) return;
    isInitiating.current = true;

    const init = async () => {
      try {
        await loadVocabularyBook(envConfig);
        setIsLoaded(true);
      } catch (error) {
        console.warn('Failed to load vocabulary book:', error);
        setIsLoaded(true);
      }
    };

    init();
  }, [envConfig, loadVocabularyBook]);

  const save = async () => {
    try {
      await saveVocabularyBook(envConfig);
    } catch (error) {
      console.warn('Failed to save vocabulary book:', error);
      throw error;
    }
  };

  return {
    isLoaded,
    save,
  };
};
