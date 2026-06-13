import { useCallback, useEffect } from 'react';
import { useEnv } from '@/context/EnvContext';
import { flushPendingLibrarySave, useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useBookProgress } from '@/store/readerProgressStore';
import { useSettingsStore } from '@/store/settingsStore';
import { eventDispatcher } from '@/utils/event';
import { transferManager } from '@/services/transferManager';
import { debounce } from '@/utils/debounce';

export const useProgressAutoSave = (bookKey: string) => {
  const { envConfig } = useEnv();
  const { getConfig, saveConfig, getBookData } = useBookDataStore();
  // Reactive subscription so the effect below fires the debounced save
  // whenever this book's progress changes. Reads from readerProgressStore.
  const progress = useBookProgress(bookKey);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveBookConfig = useCallback(
    debounce(() => {
      setTimeout(async () => {
        // Skip while previewing a deep-link target — the user's actual
        // last-read position should not be overwritten by a transient view.
        if (useReaderStore.getState().getViewState(bookKey)?.previewMode) return;
        const config = getConfig(bookKey);
        if (!config) return;
        const settings = useSettingsStore.getState().settings;
        await saveConfig(envConfig, bookKey, config, settings);
      }, 500);
    }, 1000),
    [],
  );

  useEffect(() => {
    saveBookConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, bookKey]);

  const handleSyncBookConfig = useCallback(
    () => {
      console.log("Sync book config", bookKey);
      const book = getBookData(bookKey)?.book;
      if (!book) return;
      transferManager.queueUpload(book, 1, true);
    }, [bookKey]
  );

  useEffect(() => {
    eventDispatcher.on('sync-book-config', handleSyncBookConfig);
    return () => {
      eventDispatcher.off('sync-book-config', handleSyncBookConfig);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKey]);

  // On unmount (book closed / navigated away), flush any pending throttled
  // library.json write so the shelf reflects this session's last read
  // position next time it loads. The per-book config.json is already on
  // disk from the eager save in `saveConfig`, so this only catches the
  // library-level rollup.
  useEffect(() => {
    return () => {
      flushPendingLibrarySave().catch(() => {
        // Best-effort on teardown — failures fall through to next launch's
        // reconstruction from per-book config.json files.
      });
    };
  }, []);
};
