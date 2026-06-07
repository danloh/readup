import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrent } from '@tauri-apps/plugin-deep-link';
import { useEnv } from '@/context/EnvContext';
import { useLibraryStore } from '@/store/libraryStore';
import { useReaderStore } from '@/store/readerStore';
import { isTauriAppPlatform } from '@/services/environment';
import { navigateToReader } from '@/utils/nav';
import { eventDispatcher } from '@/utils/event';
import { parseShareDeepLink, ShareDeepLink } from '@/utils/deeplink';
import { useTranslation } from './useTranslation';
import { loadSharedBook } from '@/libs/share';

// Module-scoped — survives hook remounts (library → reader → library on
// book close). Tauri's getCurrent() keeps returning the launch URL for the
// lifetime of the app session, so without this flag every remount would
// re-process the cold-start URL and navigate back to the deep-link target
// in a loop.
let coldStartConsumed = false;

/**
 * Receive sharing deep links and navigate the reader accordingly.
 *
 * Architecture:
 *   - useOpenWithBooks owns the Tauri URL channels (onOpenUrl,
 *     single-instance, shared-intent, open-files) and re-broadcasts every
 *     URL as the 'app-incoming-url' event. This hook subscribes to that
 *     event for the warm-start / live path.
 *   - For cold-start (app launched FROM the URL), getCurrent() is read
 *     once at module scope. useOpenWithBooks doesn't do this — its
 *     channels only fire for live deliveries.
 *   - Library-load deferral: on cold-start the URL may arrive before the
 *     library store has hydrated. Stash and replay once libraryLoaded.
 *
 * Supported URL shapes (see src/utils/deeplink.ts):
 *   readup://share?id={hash}&nid=&did=&loc=...
 *   https://readup.cc/share?id={hash}&nid=&did=&loc=...
 *
 * Already-open shortcut: if the target book has a mounted view, jump in
 * place via view.goTo(cfi). router.push to the same /read path with a
 * different cfi query does NOT re-run the reader's init effect, so
 * navigation alone wouldn't move the view in that case.
 */
export function useOpenShareLink() {
  const _ = useTranslation();
  const router = useRouter();
  const { appService } = useEnv();
  const getBookByHash = useLibraryStore((s) => s.getBookByHash);
  const libraryLoaded = useLibraryStore((s) => s.libraryLoaded);
  const pending = useRef<ShareDeepLink | null>(null);

  const resolveAndNavigate = useCallback(
    async (parsed: ShareDeepLink) => {
      const { bookHash, did, cfi } = parsed;
      let book = getBookByHash(bookHash);
      
      if (!book) {
        eventDispatcher.dispatch('toast', {
          type: 'warning',
          message: _('Book not in your library, load from PDS...'),
          timeout: 2500,
        });

        // if no book locally, load from PDS
        if (!appService || !did) return;
        try {
          book = await loadSharedBook({bookHash, did, appService});

          eventDispatcher.dispatch('toast', {
            type: 'success',
            message: _('Added to your library'),
            timeout: 2000,
          });
        } catch (err) {
          console.error(`Loading book locally: `, err);
          eventDispatcher.dispatch('toast', {
            type: 'error',
            message: _('Could not import shared book'),
            timeout: 3000,
          });
          return;
        }
      }

      const { viewStates, setPreviewMode } = useReaderStore.getState();
      const openEntry = Object.entries(viewStates).find(
        ([key, state]) => key.startsWith(book.hash) && state.view,
      );
      if (openEntry) {
        const [bookKey, state] = openEntry;
        if (cfi) {
          state.view!.goTo(cfi);
          setPreviewMode(bookKey, true);
        }
        return;
      }

      const queryParams = cfi ? `cfi=${encodeURIComponent(cfi)}` : undefined;
      navigateToReader(router, [book.hash], queryParams);
    },
    [_, getBookByHash, router],
  );

  useEffect(() => {
    if (!isTauriAppPlatform() || !appService) return;

    const handle = (url: string) => {
      const parsed = parseShareDeepLink(url);
      if (!parsed) return;
      if (!useLibraryStore.getState().libraryLoaded) {
        pending.current = parsed;
        return;
      }
      resolveAndNavigate(parsed);
    };

    if (!coldStartConsumed) {
      coldStartConsumed = true;
      getCurrent()
        .then((urls) => urls?.forEach(handle))
        .catch(() => {
          // Plugin not available on this platform — live channel still works.
        });
    }

    const onIncoming = (event: CustomEvent) => {
      const { urls } = event.detail as { urls: string[] };
      urls.forEach(handle);
    };
    eventDispatcher.on('app-incoming-url', onIncoming);

    return () => {
      eventDispatcher.off('app-incoming-url', onIncoming);
    };
  }, [appService, resolveAndNavigate]);

  // Replay any deferred deep link once the library hydrates.
  useEffect(() => {
    if (!libraryLoaded || !pending.current) return;
    const parsed = pending.current;
    pending.current = null;
    resolveAndNavigate(parsed);
  }, [libraryLoaded, resolveAndNavigate]);
}
