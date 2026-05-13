import { create } from 'zustand';
import { EnvConfigType } from '@/services/environment';

export interface VocabularyEntry {
  /** Unique identifier (e.g., word itself or UUID) */
  id: string;
  /** The word being learned */
  word: string;
  /** The definition/meaning of the word */
  definition: string;
  /** The dictionary provider source (e.g., "wiktionary", "wikipedia") */
  source?: string;
  /** Timestamp when the word was added */
  addedAt: number;
  /** Number of times reviewed */
  reviewCount?: number;
  /** Last time reviewed */
  lastReviewedAt?: number;
}

export interface VocabularyBook {
  entries: VocabularyEntry[];
  version: number;
  lastSyncAt?: number;
}

export const DEFAULT_VOCABULARY_BOOK: VocabularyBook = {
  entries: [],
  version: 1,
};

interface VocabularyBookState {
  entries: VocabularyEntry[];
  
  // Core operations
  addEntry(entry: Omit<VocabularyEntry, 'id' | 'addedAt'>): void;
  removeEntry(id: string): void;
  getEntry(id: string): VocabularyEntry | undefined;
  getAllEntries(): VocabularyEntry[];
  entryExists(word: string): boolean;
  
  // Batch operations
  addEntries(entries: VocabularyEntry[]): void;
  clearAll(): void;
  
  // Update review stats
  recordReview(id: string): void;
  
  // Persistence
  loadVocabularyBook(envConfig: EnvConfigType): Promise<void>;
  saveVocabularyBook(envConfig: EnvConfigType): Promise<void>;
}

export const useVocabularyBookStore = create<VocabularyBookState>((set, get) => ({
  entries: [],

  addEntry: (entry) => {
    const id = `${entry.word}_${Date.now()}`.toLowerCase().replace(/\s+/g, '_');
    const newEntry: VocabularyEntry = {
      ...entry,
      id,
      addedAt: Date.now(),
    };
    set((state) => ({
      entries: [newEntry, ...state.entries],
    }));
  },

  removeEntry: (id: string) => {
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    }));
  },

  getEntry: (id: string) => {
    return get().entries.find((e) => e.id === id);
  },

  getAllEntries: () => {
    return get().entries;
  },

  entryExists: (word: string) => {
    return get().entries.some((e) => e.word.toLowerCase() === word.toLowerCase());
  },

  addEntries: (entries: VocabularyEntry[]) => {
    set((state) => ({
      entries: [...entries, ...state.entries],
    }));
  },

  clearAll: () => {
    set({ entries: [] });
  },

  recordReview: (id: string) => {
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id
          ? {
              ...e,
              reviewCount: (e.reviewCount ?? 0) + 1,
              lastReviewedAt: Date.now(),
            }
          : e,
      ),
    }));
  },

  loadVocabularyBook: async (envConfig: EnvConfigType) => {
    try {
      const appService = await envConfig.getAppService();

      const result = await appService.loadVocabulary();

      set({ entries: result.entries });
    } catch (error) {
      console.warn('Failed to load vocabulary book:', error);
    }
  },

  saveVocabularyBook: async (envConfig: EnvConfigType) => {
    try {
      const appService = await envConfig.getAppService();

      const vocabularyBook: VocabularyBook = {
        entries: get().entries,
        version: 1,
        lastSyncAt: Date.now(),
      };

      await appService.saveVocabulary(vocabularyBook);
    } catch (error) {
      console.warn('Failed to save vocabulary book:', error);
    }
  },
}));
