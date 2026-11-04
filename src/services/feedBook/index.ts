import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { Book } from '@/types/book';
import type { AppService } from '@/types/system';
import { getAPIBaseUrl, isTauriAppPlatform } from '@/services/environment';
import { getLocalBookFilename } from '@/utils/book';
import { FeedItem, ParsedFeed, parseFeed } from './feedParser';
import {
  appendToFeedEpub,
  createFeedEpub,
  getFeedBookIdentifier,
  normalizeFeedUrl,
} from './feedEpub';

export { FeedParseError } from './feedParser';

const FEED_ACCEPT =
  'application/feed+json, application/json;q=0.9, application/atom+xml, application/rss+xml, application/rdf+xml, application/xml;q=0.8, text/xml;q=0.8, */*;q=0.5';

export class FeedBookError extends Error {}

/**
 * Decode feed bytes honoring the charset from the Content-Type header or the
 * XML declaration. Falls back to UTF-8, which is also the JSON Feed encoding.
 */
export const decodeFeedBytes = (bytes: ArrayBuffer, contentType?: string | null): string => {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 200));
  const fromDecl = head.match(/^\s*<\?xml[^>]*encoding=["']([\w-]+)["']/i)?.[1];
  const charset = fromHeader || fromDecl || 'utf-8';
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
};

/**
 * Fetch a feed document. Native apps request it directly (no CORS); the web
 * build goes through the `/api/feed/proxy` route.
 */
export const fetchFeedText = async (url: string): Promise<string> => {
  const response = isTauriAppPlatform()
    ? await tauriFetch(url, { headers: { Accept: FEED_ACCEPT } })
    : await fetch(`${getAPIBaseUrl()}/feed/proxy?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = typeof body?.error === 'string' ? body.error : '';
    } catch {}
    throw new FeedBookError(detail || `Failed to fetch feed (HTTP ${response.status})`);
  }
  return decodeFeedBytes(await response.arrayBuffer(), response.headers.get('content-type'));
};

/**
 * Put feed items in reading order (oldest first) and drop duplicates. Feeds
 * are usually newest-first; when every item is dated we sort by date,
 * otherwise we just reverse the document order.
 */
export const orderFeedItems = (items: FeedItem[]): FeedItem[] => {
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  if (unique.length > 0 && unique.every((item) => item.published)) {
    return unique
      .map((item, index) => ({ item, index }))
      .sort(
        (a, b) =>
          Date.parse(a.item.published) - Date.parse(b.item.published) || b.index - a.index,
      )
      .map(({ item }) => item);
  }
  return unique.reverse();
};

/**
 * The feed URL a library book was generated from, or undefined for ordinary
 * books. Prefers the URL saved on the book's metadata and falls back to the
 * EPUB's `dc:source` when it matches the book's feed identifier.
 */
export const getBookFeedUrl = (book: Book): string | undefined => {
  const meta = book.metadata;
  if (!meta || book.format !== 'EPUB') return undefined;
  if (meta.feedUrl) return meta.feedUrl;
  const sources = Array.isArray(meta.source) ? meta.source : meta.source ? [meta.source] : [];
  return sources.find((source) => {
    try {
      return /^https?:/.test(source) && getFeedBookIdentifier(source) === meta.identifier;
    } catch {
      return false;
    }
  });
};

/** The library book previously built from this feed URL, if any. */
export const findFeedBook = (books: Book[], feedUrl: string): Book | undefined => {
  const identifier = getFeedBookIdentifier(feedUrl);
  const live = books.filter((book) => !book.deletedAt && book.format === 'EPUB');
  return (
    live.find((book) => {
      const url = getBookFeedUrl(book);
      return !!url && normalizeFeedUrl(url) === feedUrl;
    }) ?? live.find((book) => book.metadata?.identifier === identifier)
  );
};

export interface FeedBookResult {
  /** EPUB to import, or null when the existing book is already up to date. */
  file: File | null;
  /** Number of articles added (all of them for a new book). */
  added: number;
  /** Book already in the library for this feed, if any. */
  existingBook?: Book;
  title: string;
  /** Normalized feed URL; save it on the imported book's metadata. */
  feedUrl: string;
}

/**
 * Fetch a feed and produce the EPUB to import: a new book when the feed has
 * not been imported before, otherwise the existing book with any articles it
 * does not contain yet appended to the end.
 */
export const buildFeedBook = async (
  rawUrl: string,
  books: Book[],
  appService: AppService,
  fetchText: (url: string) => Promise<string> = fetchFeedText,
): Promise<FeedBookResult> => {
  let feedUrl: string;
  try {
    feedUrl = normalizeFeedUrl(rawUrl);
  } catch {
    throw new FeedBookError('Invalid feed URL');
  }
  if (!/^https?:$/.test(new URL(feedUrl).protocol)) {
    throw new FeedBookError('Feed URL must start with http:// or https://');
  }

  const feed: ParsedFeed = parseFeed(await fetchText(feedUrl), feedUrl);
  const items = orderFeedItems(feed.items);
  if (items.length === 0) {
    throw new FeedBookError('The feed has no articles');
  }

  const existingBook = findFeedBook(books, feedUrl);
  if (existingBook) {
    let epub: File;
    try {
      epub = await appService.openFile(getLocalBookFilename(existingBook), 'Books');
    } catch {
      throw new FeedBookError(
        'The book for this feed is not available on this device. Download it first.',
      );
    }
    const result = await appendToFeedEpub(epub, items);
    if (!result) {
      return { file: null, added: 0, existingBook, title: existingBook.title, feedUrl };
    }
    return {
      file: new File([result.blob], `${result.state.title}.epub`, {
        type: 'application/epub+zip',
      }),
      added: result.added,
      existingBook,
      title: result.state.title,
      feedUrl,
    };
  }

  const { blob, state } = await createFeedEpub(feedUrl, feed, items);
  return {
    file: new File([blob], `${state.title}.epub`, { type: 'application/epub+zip' }),
    added: items.length,
    title: state.title,
    feedUrl,
  };
};
