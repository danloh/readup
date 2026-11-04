/**
 * Build and extend the EPUB that holds a feed's articles.
 *
 * Each article is its own XHTML file and spine item. Appending adds new files
 * after the existing ones and rewrites only the package/navigation documents,
 * so the bytes and spine positions of existing articles never change and CFIs
 * (annotations, reading progress) stay valid across updates.
 *
 * The book's metadata (title, author, identifier) is fixed when the book is
 * first created and carried over on every append. The importer keys books on
 * a hash of that metadata, so an appended EPUB replaces the previous file in
 * place and keeps its config instead of showing up as a new book.
 */

import JSZip from 'jszip';
import { md5 } from 'js-md5';
import { sanitizeHtml } from '@/utils/sanitize';
import type { FeedItem, ParsedFeed } from './feedParser';

/** Stored inside the EPUB so a later update knows what is already there. */
export interface FeedBookState {
  version: 1;
  feedUrl: string;
  identifier: string;
  title: string;
  author: string;
  language: string;
  items: Array<{ id: string; title: string; href: string }>;
}

export const FEED_STATE_PATH = 'OEBPS/feed.json';

const OPF_PATH = 'OEBPS/content.opf';

/** Canonical form of a feed URL, so trivially different spellings map to one book. */
export const normalizeFeedUrl = (url: string): string => {
  const parsed = new URL(url.trim());
  parsed.hash = '';
  return parsed.toString();
};

/** Deterministic `urn:uuid:` identifier for a feed URL. */
export const getFeedBookIdentifier = (feedUrl: string): string => {
  const hex = md5(`readup-feed:${normalizeFeedUrl(feedUrl)}`);
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  return `urn:uuid:${uuid}`;
};

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// Characters that are illegal anywhere in an XML 1.0 document.
// eslint-disable-next-line no-control-regex
const stripInvalidXmlChars = (str: string): string => str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');

/**
 * Turn untrusted feed HTML into well-formed XHTML body markup. Feed HTML is
 * rarely valid XML, and the reader parses chapters as XHTML, so it is
 * sanitized, parsed as HTML, and re-serialized as XML. Relative links and
 * image sources are resolved against the article URL.
 */
export const htmlToXhtml = (html: string, baseUrl: string): string => {
  const clean = sanitizeHtml(stripInvalidXmlChars(html));
  const doc = new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html');
  const resolve = (value: string) => {
    if (!baseUrl) return value;
    try {
      return new URL(value, baseUrl).toString();
    } catch {
      return value;
    }
  };
  doc.body.querySelectorAll('[href]').forEach((el) => {
    const href = el.getAttribute('href') ?? '';
    if (href && !href.startsWith('#')) el.setAttribute('href', resolve(href));
  });
  doc.body.querySelectorAll('img[src]').forEach((el) => {
    el.setAttribute('src', resolve(el.getAttribute('src') ?? ''));
  });
  const serializer = new XMLSerializer();
  return Array.from(doc.body.childNodes)
    .map((node) => serializer.serializeToString(node))
    .join('')
    .replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
};

const formatDate = (iso: string, language: string): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(language || undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
};

const itemXhtml = (item: FeedItem, state: FeedBookState): string => {
  const title = item.title || item.link || 'Untitled';
  const meta = [
    item.author ? escapeXml(item.author) : '',
    item.published ? escapeXml(formatDate(item.published, state.language)) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const body = htmlToXhtml(item.content || '', item.link);
  const lang = escapeXml(state.language);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}" xml:lang="${lang}">
<head>
<meta charset="utf-8"/>
<title>${escapeXml(stripInvalidXmlChars(title))}</title>
<link rel="stylesheet" type="text/css" href="../style.css"/>
</head>
<body>
<article>
<h1>${escapeXml(stripInvalidXmlChars(title))}</h1>
${meta ? `<p class="meta">${meta}</p>` : ''}
${item.link ? `<p class="source"><a href="${escapeXml(item.link)}">${escapeXml(item.link)}</a></p>` : ''}
<div class="content">${body}</div>
</article>
</body>
</html>
`;
};

const STYLE_CSS = `body { margin: 0 1em; line-height: 1.6; }
h1 { font-size: 1.5em; line-height: 1.3; margin: 0.5em 0; }
.meta, .source { font-size: 0.85em; opacity: 0.7; margin: 0.2em 0; }
.source a { word-break: break-all; }
.content { margin-top: 1.5em; }
.content img { max-width: 100%; height: auto; }
.content pre { white-space: pre-wrap; }
`;

const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="${OPF_PATH}" media-type="application/oebps-package+xml"/>
</rootfiles>
</container>
`;

const itemFileId = (index: number) => `item${String(index + 1).padStart(5, '0')}`;

const buildOpf = (state: FeedBookState): string => {
  const manifest = state.items
    .map(
      (item, i) =>
        `<item id="${itemFileId(i)}" href="${item.href}" media-type="application/xhtml+xml"/>`,
    )
    .join('\n');
  const spine = state.items.map((_, i) => `<itemref idref="${itemFileId(i)}"/>`).join('\n');
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">${escapeXml(state.identifier)}</dc:identifier>
<dc:title>${escapeXml(state.title)}</dc:title>
<dc:creator>${escapeXml(state.author)}</dc:creator>
<dc:language>${escapeXml(state.language)}</dc:language>
<dc:source>${escapeXml(state.feedUrl)}</dc:source>
<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="style" href="style.css" media-type="text/css"/>
${manifest}
</manifest>
<spine toc="ncx">
${spine}
</spine>
</package>
`;
};

const buildNav = (state: FeedBookState): string => {
  const entries = state.items
    .map((item) => `<li><a href="${item.href}">${escapeXml(item.title)}</a></li>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="utf-8"/><title>${escapeXml(state.title)}</title></head>
<body>
<nav epub:type="toc" id="toc">
<h1>${escapeXml(state.title)}</h1>
<ol>
${entries}
</ol>
</nav>
</body>
</html>
`;
};

const buildNcx = (state: FeedBookState): string => {
  const navPoints = state.items
    .map(
      (item, i) =>
        `<navPoint id="nav-${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeXml(item.title)}</text></navLabel><content src="${item.href}"/></navPoint>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
<meta name="dtb:uid" content="${escapeXml(state.identifier)}"/>
<meta name="dtb:depth" content="1"/>
<meta name="dtb:totalPageCount" content="0"/>
<meta name="dtb:maxPageNumber" content="0"/>
</head>
<docTitle><text>${escapeXml(state.title)}</text></docTitle>
<navMap>
${navPoints}
</navMap>
</ncx>
`;
};

const addItems = (zip: JSZip, state: FeedBookState, items: FeedItem[]) => {
  for (const item of items) {
    const index = state.items.length;
    const href = `items/${itemFileId(index)}.xhtml`;
    zip.file(`OEBPS/${href}`, itemXhtml(item, state));
    state.items.push({
      id: item.id,
      title: stripInvalidXmlChars(item.title || item.link || 'Untitled'),
      href,
    });
  }
};

const writePackage = async (zip: JSZip, state: FeedBookState): Promise<Blob> => {
  zip.file(OPF_PATH, buildOpf(state));
  zip.file('OEBPS/nav.xhtml', buildNav(state));
  zip.file('OEBPS/toc.ncx', buildNcx(state));
  zip.file(FEED_STATE_PATH, JSON.stringify(state, null, 2));
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
  });
};

/** Create a new EPUB containing `items` (already in reading order). */
export const createFeedEpub = async (
  feedUrl: string,
  feed: ParsedFeed,
  items: FeedItem[],
): Promise<{ blob: Blob; state: FeedBookState }> => {
  let host = '';
  try {
    host = new URL(feed.link || feedUrl).hostname;
  } catch {}
  const state: FeedBookState = {
    version: 1,
    feedUrl: normalizeFeedUrl(feedUrl),
    identifier: getFeedBookIdentifier(feedUrl),
    title: stripInvalidXmlChars(feed.title || host || 'Feed'),
    author: stripInvalidXmlChars(feed.author || host || 'Feed'),
    language: (feed.language || 'en').trim(),
    items: [],
  };
  const zip = new JSZip();
  // mimetype must be the first entry and stored uncompressed.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', containerXml);
  zip.file('OEBPS/style.css', STYLE_CSS);
  addItems(zip, state, items);
  const blob = await writePackage(zip, state);
  return { blob, state };
};

/** Read the feed state stored in an EPUB built by {@link createFeedEpub}. */
export const readFeedEpubState = async (epub: Blob): Promise<FeedBookState | null> => {
  const zip = await JSZip.loadAsync(epub);
  const json = await zip.file(FEED_STATE_PATH)?.async('string');
  if (!json) return null;
  const state = JSON.parse(json) as FeedBookState;
  return state && Array.isArray(state.items) ? state : null;
};

/**
 * Append `items` to the end of an existing feed EPUB. Returns null when
 * every item is already in the book.
 */
export const appendToFeedEpub = async (
  epub: Blob,
  items: FeedItem[],
): Promise<{ blob: Blob; state: FeedBookState; added: number } | null> => {
  const zip = await JSZip.loadAsync(epub);
  const json = await zip.file(FEED_STATE_PATH)?.async('string');
  if (!json) throw new Error('Not a feed book');
  const state = JSON.parse(json) as FeedBookState;
  const known = new Set(state.items.map((item) => item.id));
  const fresh = items.filter((item) => !known.has(item.id));
  if (fresh.length === 0) return null;
  addItems(zip, state, fresh);
  const blob = await writePackage(zip, state);
  return { blob, state, added: fresh.length };
};
