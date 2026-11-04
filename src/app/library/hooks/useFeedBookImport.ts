import { useCallback } from 'react';

import type { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { buildFeedBook } from '@/services/feedBook';
import { ingestFile } from '@/services/ingestService';
import { enqueueImportRun } from '@/services/importQueue';
import { eventDispatcher } from '@/utils/event';

export interface FeedImportOptions {
  /** Group for a newly created book. Ignored when updating an existing one. */
  groupId?: string;
  /** Update this book specifically instead of looking the URL up in the library. */
  book?: Book;
}

/**
 * Turn a feed into a library book, or append the feed's new articles to the
 * book generated from it before. Shows a toast with the outcome and returns
 * the resulting book; throws with a user-facing message on failure.
 */
export const useFeedBookImport = () => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { user } = useAuth();
  const { settings } = useSettingsStore();
  const { updateBooks, getGroupName } = useLibraryStore();

  return useCallback(
    async (url: string, options: FeedImportOptions = {}): Promise<Book | null> => {
      if (!appService) return null;
      const library = useLibraryStore.getState().library;
      const result = await buildFeedBook(url, options.book ? [options.book] : library, appService);
      if (!result.file) {
        eventDispatcher.dispatch('toast', {
          message: _('No new articles in "{{title}}"', { title: result.title }),
          timeout: 2500,
          type: 'info',
        });
        return result.existingBook ?? null;
      }

      const file = result.file;
      // A new book lands in the requested group; an updated one stays put.
      const groupId = result.existingBook ? undefined : (options.groupId ?? '');
      const book = await enqueueImportRun(async () => {
        const imported = await ingestFile(
          {
            file,
            books: useLibraryStore.getState().library,
            groupId,
            groupName: groupId !== undefined ? getGroupName(groupId) : undefined,
          },
          { appService, settings, isLoggedIn: !!user },
        );
        if (!imported) return null;
        // Re-importing replaces the parsed metadata, so (re)attach the feed URL
        // that drives "fetch new articles" every time.
        if (imported.metadata) imported.metadata.feedUrl = result.feedUrl;
        await updateBooks(envConfig, [imported]);
        return imported;
      });
      if (!book) throw new Error(_('Failed to import the feed'));

      eventDispatcher.dispatch('toast', {
        message: result.existingBook
          ? _('Added {{count}} new article(s) to "{{title}}"', {
              count: result.added,
              title: book.title,
            })
          : _('Imported "{{title}}" with {{count}} article(s)', {
              count: result.added,
              title: book.title,
            }),
        timeout: 3000,
        type: 'success',
      });
      return book;
    },
    [_, appService, envConfig, settings, user, updateBooks, getGroupName],
  );
};
