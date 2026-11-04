/**
 * Parse an RSS 2.0, RSS 1.0 (RDF), Atom or JSON Feed document into a
 * format-neutral shape. Runs on the client (browser or Tauri webview) and
 * relies on the DOM's `DOMParser` for the XML formats.
 */

export interface FeedItem {
  /** Stable identity used to tell new items from ones already in the book. */
  id: string;
  title: string;
  link: string;
  /** HTML body: full content when the feed carries it, otherwise the summary. */
  content: string;
  author: string;
  /** ISO 8601 string, or '' when the feed gives no usable date. */
  published: string;
}

export interface ParsedFeed {
  title: string;
  link: string;
  description: string;
  author: string;
  language: string;
  items: FeedItem[];
}

export class FeedParseError extends Error {}

const ATOM_NS = 'http://www.w3.org/2005/Atom';
const CONTENT_NS = 'http://purl.org/rss/1.0/modules/content/';
const DC_NS = 'http://purl.org/dc/elements/1.1/';

const toIsoDate = (value: string | undefined | null): string => {
  if (!value) return '';
  const time = Date.parse(value.trim());
  return Number.isNaN(time) ? '' : new Date(time).toISOString();
};

const resolveUrl = (href: string, base: string): string => {
  if (!href) return '';
  try {
    return new URL(href.trim(), base || undefined).toString();
  } catch {
    return href.trim();
  }
};

/** Direct children matching a local name, optionally restricted to a namespace. */
const children = (parent: Element, localName: string, ns?: string): Element[] =>
  Array.from(parent.children).filter(
    (el) => el.localName === localName && (ns === undefined || el.namespaceURI === ns),
  );

const childText = (parent: Element, localName: string, ns?: string): string =>
  children(parent, localName, ns)[0]?.textContent?.trim() ?? '';

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Item identity: the feed's own id when it has one, then the link, then a
 * title+date pair so items without either still dedupe across fetches.
 */
const itemId = (id: string, link: string, title: string, published: string): string =>
  id.trim() || link.trim() || `${title.trim()}|${published}`;

const parseJsonFeed = (text: string, feedUrl: string): ParsedFeed => {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new FeedParseError('Invalid JSON feed');
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data['items'])) {
    throw new FeedParseError('Invalid JSON feed');
  }
  const str = (value: unknown) => (typeof value === 'string' ? value : '');
  const authorName = (obj: Record<string, unknown>) => {
    const authors = Array.isArray(obj['authors']) ? obj['authors'] : [];
    const first = (authors[0] ?? obj['author']) as Record<string, unknown> | undefined;
    return first && typeof first === 'object' ? str(first['name']) : '';
  };
  const base = str(data['home_page_url']) || feedUrl;
  const items = (data['items'] as Record<string, unknown>[])
    .filter((item) => item && typeof item === 'object')
    .map((item): FeedItem => {
      const link = resolveUrl(str(item['url']) || str(item['external_url']), base);
      const title = str(item['title']).trim();
      const published = toIsoDate(str(item['date_published']) || str(item['date_modified']));
      const contentText = str(item['content_text']);
      const content =
        str(item['content_html']) ||
        (contentText ? `<p>${escapeHtml(contentText).replace(/\n{2,}/g, '</p><p>')}</p>` : '') ||
        str(item['summary']);
      const rawId = item['id'];
      const id = typeof rawId === 'number' ? String(rawId) : str(rawId);
      return {
        id: itemId(id, link, title, published),
        title,
        link,
        content,
        author: authorName(item),
        published,
      };
    });
  return {
    title: str(data['title']).trim(),
    link: str(data['home_page_url']) || feedUrl,
    description: str(data['description']).trim(),
    author: authorName(data),
    language: str(data['language']),
    items,
  };
};

const parseAtom = (root: Element, feedUrl: string): ParsedFeed => {
  const pickLink = (el: Element): string => {
    const links = children(el, 'link', ATOM_NS);
    const alternate =
      links.find((l) => (l.getAttribute('rel') || 'alternate') === 'alternate') ?? links[0];
    return alternate?.getAttribute('href') ?? '';
  };
  const authorOf = (el: Element): string => {
    const author = children(el, 'author', ATOM_NS)[0];
    return author ? childText(author, 'name', ATOM_NS) : '';
  };
  const feedLink = resolveUrl(pickLink(root), feedUrl) || feedUrl;
  const feedAuthor = authorOf(root);
  const items = children(root, 'entry', ATOM_NS).map((entry): FeedItem => {
    const link = resolveUrl(pickLink(entry), feedLink);
    const title = childText(entry, 'title', ATOM_NS);
    const published = toIsoDate(
      childText(entry, 'published', ATOM_NS) || childText(entry, 'updated', ATOM_NS),
    );
    const contentEl = children(entry, 'content', ATOM_NS)[0];
    const summaryEl = children(entry, 'summary', ATOM_NS)[0];
    const textOf = (el: Element | undefined): string => {
      if (!el) return '';
      const type = el.getAttribute('type') || 'text';
      if (type === 'xhtml') {
        const div = Array.from(el.children)[0];
        return div ? div.innerHTML : el.innerHTML;
      }
      const value = el.textContent ?? '';
      return type === 'text' ? `<p>${escapeHtml(value.trim())}</p>` : value;
    };
    const content = textOf(contentEl) || textOf(summaryEl);
    return {
      id: itemId(childText(entry, 'id', ATOM_NS), link, title, published),
      title,
      link,
      content,
      author: authorOf(entry) || feedAuthor,
      published,
    };
  });
  return {
    title: childText(root, 'title', ATOM_NS),
    link: feedLink,
    description: childText(root, 'subtitle', ATOM_NS),
    author: feedAuthor,
    language: root.getAttribute('xml:lang') || '',
    items,
  };
};

const parseRss = (root: Element, feedUrl: string): ParsedFeed => {
  const isRdf = root.localName === 'RDF';
  const channel = Array.from(root.children).find((el) => el.localName === 'channel');
  if (!channel) throw new FeedParseError('Invalid RSS feed: missing channel');
  // RSS 2.0 nests items in <channel>; RSS 1.0 puts them beside it under <rdf:RDF>.
  const itemParent = isRdf ? root : channel;
  // Plain RSS 2.0 elements carry no namespace; RSS 1.0 elements use the RSS 1.0
  // namespace. Matching by local name only, then excluding Atom's <link>,
  // covers both without hardcoding each variant.
  const plainChild = (el: Element, name: string) =>
    Array.from(el.children).find(
      (c) => c.localName === name && c.namespaceURI !== ATOM_NS && c.namespaceURI !== DC_NS,
    );
  const plainText = (el: Element, name: string) => plainChild(el, name)?.textContent?.trim() ?? '';
  const feedLink = resolveUrl(plainText(channel, 'link'), feedUrl) || feedUrl;

  const items = Array.from(itemParent.children)
    .filter((el) => el.localName === 'item')
    .map((item): FeedItem => {
      const link = resolveUrl(plainText(item, 'link'), feedLink);
      const title = plainText(item, 'title');
      const published = toIsoDate(plainText(item, 'pubDate') || childText(item, 'date', DC_NS));
      const encoded = childText(item, 'encoded', CONTENT_NS);
      const content = encoded || plainText(item, 'description');
      const guid = plainText(item, 'guid') || (isRdf ? item.getAttribute('rdf:about') || '' : '');
      return {
        id: itemId(guid, link, title, published),
        title,
        link,
        content,
        author: childText(item, 'creator', DC_NS) || plainText(item, 'author'),
        published,
      };
    });
  return {
    title: plainText(channel, 'title'),
    link: feedLink,
    description: plainText(channel, 'description'),
    author: childText(channel, 'creator', DC_NS) || plainText(channel, 'managingEditor'),
    language: plainText(channel, 'language') || childText(channel, 'language', DC_NS),
    items,
  };
};

/**
 * Parse a feed document. `feedUrl` is used to resolve relative links and as
 * the fallback site link. Throws {@link FeedParseError} for anything that is
 * not a recognisable RSS, Atom or JSON feed.
 */
export const parseFeed = (text: string, feedUrl: string): ParsedFeed => {
  const trimmed = text.replace(/^﻿/, '').trim();
  if (!trimmed) throw new FeedParseError('Empty feed');
  if (trimmed.startsWith('{')) return parseJsonFeed(trimmed, feedUrl);

  const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new FeedParseError('Invalid feed XML');
  }
  const root = doc.documentElement;
  if (root.localName === 'feed' && root.namespaceURI === ATOM_NS) {
    return parseAtom(root, feedUrl);
  }
  if (root.localName === 'rss' || root.localName === 'RDF') {
    return parseRss(root, feedUrl);
  }
  throw new FeedParseError('Unsupported feed format');
};
