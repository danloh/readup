import { useCallback, useEffect } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { throttle } from '@/utils/throttle';
import { eventDispatcher } from '@/utils/event';
import { transferManager } from '@/services/transferManager';

export const useProgressAutoSave = (bookKey: string) => {
  const { envConfig } = useEnv();
  const { getConfig, saveConfig, getBookData } = useBookDataStore();
  const { getProgress } = useReaderStore();
  const progress = getProgress(bookKey);
  // const config = getConfig(bookKey)!;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveBookConfig = useCallback(
    throttle(() => {
      setTimeout(async () => {
        const config = getConfig(bookKey)!;
        const settings = useSettingsStore.getState().settings;
        await saveConfig(envConfig, bookKey, config, settings);
      }, 5000);
    }, 10000),
    [],
  );

  useEffect(() => {
    console.log("auto save config here");
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
};
