import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));

import { FeedParseError, parseFeed } from '@/services/feedBook/feedParser';
import {
  appendToFeedEpub,
  createFeedEpub,
  FEED_STATE_PATH,
  getFeedBookIdentifier,
  htmlToXhtml,
  readFeedEpubState,
} from '@/services/feedBook/feedEpub';
import {
  buildFeedBook,
  decodeFeedBytes,
  findFeedBook,
  getBookFeedUrl,
  orderFeedItems,
} from '@/services/feedBook';
import { DocumentLoader } from '@/libs/document';
import { getMetadataHash } from '@/utils/book';
import type { Book } from '@/types/book';
import type { AppService } from '@/types/system';

const FEED_URL = 'https://example.com/feed.xml';

const rss = (items: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Example Blog</title>
  <link>https://example.com/</link>
  <atom:link href="https://example.com/feed.xml" rel="self"/>
  <description>Posts</description>
  <language>en-us</language>
  ${items}
</channel>
</rss>`;

const rssItem = (n: number, date: string) => `<item>
  <title>Post ${n}</title>
  <link>/posts/${n}</link>
  <guid isPermaLink="false">post-${n}</guid>
  <pubDate>${date}</pubDate>
  <dc:creator>Alice</dc:creator>
  <description>Summary ${n}</description>
  <content:encoded><![CDATA[<p>Body ${n} &nbsp;<br><img src="/img/${n}.png"><script>alert(1)</script></p>]]></content:encoded>
</item>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="fr">
  <title>Atom Site</title>
  <link href="https://atom.example/" rel="alternate"/>
  <link href="https://atom.example/atom.xml" rel="self"/>
  <author><name>Bob</name></author>
  <entry>
    <title>Entry A</title>
    <id>tag:atom.example,2024:a</id>
    <link href="https://atom.example/a"/>
    <updated>2024-02-01T00:00:00Z</updated>
    <summary>Short A</summary>
    <content type="html">&lt;p&gt;Full A&lt;/p&gt;</content>
  </entry>
  <entry>
    <title>Entry B</title>
    <id>tag:atom.example,2024:b</id>
    <link rel="alternate" href="https://atom.example/b"/>
    <published>2024-01-01T00:00:00Z</published>
    <updated>2024-03-01T00:00:00Z</updated>
    <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Full <b>B</b></p></div></content>
  </entry>
</feed>`;

const jsonFeed = JSON.stringify({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'JSON Site',
  home_page_url: 'https://json.example/',
  authors: [{ name: 'Carol' }],
  language: 'de',
  items: [
    {
      id: 2,
      url: 'https://json.example/2',
      title: 'Two',
      content_html: '<p>Second</p>',
      date_published: '2024-05-02T00:00:00Z',
    },
    {
      id: '1',
      url: 'https://json.example/1',
      title: 'One',
      content_text: 'First line\n\nSecond para',
      date_published: '2024-05-01T00:00:00Z',
    },
  ],
});

describe('parseFeed', () => {
  it('parses RSS 2.0 with content:encoded and resolves relative links', () => {
    const feed = parseFeed(rss(rssItem(1, 'Mon, 01 Jan 2024 10:00:00 GMT')), FEED_URL);
    expect(feed.title).toBe('Example Blog');
    expect(feed.link).toBe('https://example.com/');
    expect(feed.language).toBe('en-us');
    expect(feed.items).toHaveLength(1);
    const item = feed.items[0]!;
    expect(item).toMatchObject({
      id: 'post-1',
      title: 'Post 1',
      link: 'https://example.com/posts/1',
      author: 'Alice',
      published: '2024-01-01T10:00:00.000Z',
    });
    expect(item.content).toContain('Body 1');
  });

  it('parses RSS 1.0 (RDF)', () => {
    const rdf = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://rdf.example/"><title>RDF Site</title><link>https://rdf.example/</link><description>d</description></channel>
  <item rdf:about="https://rdf.example/1"><title>R1</title><link>https://rdf.example/1</link><description>Desc</description><dc:date>2024-01-01</dc:date></item>
</rdf:RDF>`;
    const feed = parseFeed(rdf, 'https://rdf.example/rss');
    expect(feed.title).toBe('RDF Site');
    expect(feed.items[0]).toMatchObject({
      id: 'https://rdf.example/1',
      title: 'R1',
      content: 'Desc',
    });
  });

  it('parses Atom with html and xhtml content', () => {
    const feed = parseFeed(atom, 'https://atom.example/atom.xml');
    expect(feed).toMatchObject({ title: 'Atom Site', author: 'Bob', language: 'fr' });
    expect(feed.link).toBe('https://atom.example/');
    expect(feed.items.map((i) => i.id)).toEqual([
      'tag:atom.example,2024:a',
      'tag:atom.example,2024:b',
    ]);
    expect(feed.items[0]!.content).toBe('<p>Full A</p>');
    expect(feed.items[1]!.content).toContain('<b');
    expect(feed.items[1]!.published).toBe('2024-01-01T00:00:00.000Z');
    expect(feed.items[1]!.author).toBe('Bob');
  });

  it('parses JSON Feed', () => {
    const feed = parseFeed(jsonFeed, 'https://json.example/feed.json');
    expect(feed).toMatchObject({ title: 'JSON Site', author: 'Carol', language: 'de' });
    expect(feed.items.map((i) => i.id)).toEqual(['2', '1']);
    expect(feed.items[1]!.content).toBe('<p>First line</p><p>Second para</p>');
  });

  it('rejects documents that are not feeds', () => {
    expect(() => parseFeed('<html><body>hi</body></html>', FEED_URL)).toThrow(FeedParseError);
    expect(() => parseFeed('not xml <', FEED_URL)).toThrow(FeedParseError);
    expect(() => parseFeed('{"foo": 1}', FEED_URL)).toThrow(FeedParseError);
    expect(() => parseFeed('', FEED_URL)).toThrow(FeedParseError);
  });
});

describe('orderFeedItems', () => {
  const item = (id: string, published = '') => ({
    id,
    title: id,
    link: '',
    content: '',
    author: '',
    published,
  });

  it('sorts dated items oldest first and drops duplicates', () => {
    const ordered = orderFeedItems([
      item('c', '2024-03-01T00:00:00Z'),
      item('a', '2024-01-01T00:00:00Z'),
      item('c', '2024-03-01T00:00:00Z'),
      item('b', '2024-02-01T00:00:00Z'),
    ]);
    expect(ordered.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('reverses document order when some items are undated', () => {
    expect(orderFeedItems([item('new'), item('old', '2024-01-01')]).map((i) => i.id)).toEqual([
      'old',
      'new',
    ]);
  });
});

describe('decodeFeedBytes', () => {
  it('honors the XML declaration encoding', () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?><t>'),
      0xe9,
      ...new TextEncoder().encode('</t>'),
    ]);
    expect(decodeFeedBytes(bytes.buffer)).toContain('<t>é</t>');
  });
});

describe('htmlToXhtml', () => {
  it('produces well-formed XHTML without scripts and with absolute URLs', () => {
    const out = htmlToXhtml(
      '<p onclick="x()">A &nbsp;<br><img src="/a.png"><a href="b">l</a><script>bad()</script>',
      'https://example.com/post/1',
    );
    expect(out).not.toContain('script');
    expect(out).not.toContain('onclick');
    expect(out).toContain('src="https://example.com/a.png"');
    expect(out).toContain('href="https://example.com/post/b"');
    const doc = new DOMParser().parseFromString(
      `<div xmlns="http://www.w3.org/1999/xhtml">${out}</div>`,
      'application/xml',
    );
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  });
});

const isWellFormed = (xml: string) =>
  new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror')
    .length === 0;

describe('feed EPUB', () => {
  const feed = parseFeed(
    rss(
      rssItem(2, 'Tue, 02 Jan 2024 10:00:00 GMT') + rssItem(1, 'Mon, 01 Jan 2024 10:00:00 GMT'),
    ),
    FEED_URL,
  );

  it('creates a valid EPUB with one chapter per article', async () => {
    const { blob, state } = await createFeedEpub(FEED_URL, feed, orderFeedItems(feed.items));
    expect(state.identifier).toBe(getFeedBookIdentifier(FEED_URL));
    expect(state.items.map((i) => i.title)).toEqual(['Post 1', 'Post 2']);

    const zip = await JSZip.loadAsync(blob);
    expect(Object.keys(zip.files)[0]).toBe('mimetype');
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    expect(isWellFormed(opf)).toBe(true);
    expect(opf).toContain(`<dc:identifier id="book-id">${state.identifier}</dc:identifier>`);
    expect(opf).toContain('<dc:title>Example Blog</dc:title>');
    for (const item of state.items) {
      const xhtml = await zip.file(`OEBPS/${item.href}`)!.async('string');
      expect(isWellFormed(xhtml)).toBe(true);
      expect(xhtml).not.toContain('<script');
    }
    expect(isWellFormed(await zip.file('OEBPS/nav.xhtml')!.async('string'))).toBe(true);
    expect(isWellFormed(await zip.file('OEBPS/toc.ncx')!.async('string'))).toBe(true);
    expect(await readFeedEpubState(blob)).toEqual(state);
  });

  it('appends only new articles and leaves existing chapters byte-identical', async () => {
    const first = await createFeedEpub(FEED_URL, feed, orderFeedItems(feed.items));
    const firstZip = await JSZip.loadAsync(first.blob);
    const firstChapter = await firstZip.file(`OEBPS/${first.state.items[0]!.href}`)!.async('string');

    const updated = parseFeed(
      rss(
        rssItem(3, 'Wed, 03 Jan 2024 10:00:00 GMT') + rssItem(2, 'Tue, 02 Jan 2024 10:00:00 GMT'),
      ),
      FEED_URL,
    );
    const result = await appendToFeedEpub(first.blob, orderFeedItems(updated.items));
    expect(result?.added).toBe(1);
    expect(result!.state.items.map((i) => i.title)).toEqual(['Post 1', 'Post 2', 'Post 3']);
    expect(result!.state.title).toBe(first.state.title);
    expect(result!.state.identifier).toBe(first.state.identifier);

    const zip = await JSZip.loadAsync(result!.blob);
    expect(await zip.file(`OEBPS/${first.state.items[0]!.href}`)!.async('string')).toBe(
      firstChapter,
    );
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    const spine = [...opf.matchAll(/<itemref idref="([^"]+)"/g)].map((m) => m[1]);
    expect(spine).toEqual(['item00001', 'item00002', 'item00003']);

    expect(await appendToFeedEpub(result!.blob, orderFeedItems(updated.items))).toBeNull();
  });

  it('refuses to append to an EPUB that is not a feed book', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(appendToFeedEpub(blob, [])).rejects.toThrow('Not a feed book');
    expect(await readFeedEpubState(blob)).toBeNull();
    expect(FEED_STATE_PATH).toBe('OEBPS/feed.json');
  });
});

describe('buildFeedBook', () => {
  const v1 = rss(rssItem(1, 'Mon, 01 Jan 2024 10:00:00 GMT'));
  const v2 = rss(rssItem(2, 'Tue, 02 Jan 2024 10:00:00 GMT') + rssItem(1, 'Mon, 01 Jan 2024 10:00:00 GMT'));

  it('creates a book for a new URL, then appends on the same URL', async () => {
    const appService = { openFile: vi.fn() } as unknown as AppService;

    const created = await buildFeedBook(FEED_URL, [], appService, async () => v1);
    expect(created.existingBook).toBeUndefined();
    expect(created.added).toBe(1);
    expect(created.file?.name).toBe('Example Blog.epub');

    const book = {
      hash: 'h1',
      format: 'EPUB',
      title: 'Example Blog',
      metadata: { identifier: getFeedBookIdentifier(FEED_URL) },
    } as unknown as Book;
    vi.mocked(appService.openFile).mockResolvedValue(created.file!);

    // Same feed spelled with a fragment still resolves to the same book.
    const appended = await buildFeedBook(`${FEED_URL}#x`, [book], appService, async () => v2);
    expect(appService.openFile).toHaveBeenCalledWith('h1/Example Blog.epub', 'Books');
    expect(appended.existingBook).toBe(book);
    expect(appended.added).toBe(1);
    const state = await readFeedEpubState(appended.file!);
    expect(state!.items.map((i) => i.title)).toEqual(['Post 1', 'Post 2']);

    vi.mocked(appService.openFile).mockResolvedValue(appended.file!);
    const noop = await buildFeedBook(FEED_URL, [book], appService, async () => v2);
    expect(noop.file).toBeNull();
    expect(noop.added).toBe(0);
  });

  it('ignores deleted books and rejects bad input', async () => {
    const appService = { openFile: vi.fn() } as unknown as AppService;
    const deleted = {
      hash: 'h1',
      format: 'EPUB',
      deletedAt: 1,
      metadata: { identifier: getFeedBookIdentifier(FEED_URL) },
    } as unknown as Book;
    const result = await buildFeedBook(FEED_URL, [deleted], appService, async () => v1);
    expect(result.existingBook).toBeUndefined();
    expect(appService.openFile).not.toHaveBeenCalled();

    await expect(buildFeedBook('not a url', [], appService, async () => v1)).rejects.toThrow(
      'Invalid feed URL',
    );
    await expect(buildFeedBook('ftp://x.example/f', [], appService, async () => v1)).rejects.toThrow(
      'http',
    );
    await expect(buildFeedBook(FEED_URL, [], appService, async () => rss(''))).rejects.toThrow(
      'no articles',
    );
  });
});

describe('feed EPUB in the document loader', () => {
  const v1 = rss(rssItem(1, 'Mon, 01 Jan 2024 10:00:00 GMT'));
  const v2 = rss(rssItem(2, 'Tue, 02 Jan 2024 10:00:00 GMT') + rssItem(1, 'Mon, 01 Jan 2024 10:00:00 GMT'));

  it('opens, lists every article, and keeps the metadata hash across appends', async () => {
    const appService = { openFile: vi.fn() } as unknown as AppService;
    const created = await buildFeedBook(FEED_URL, [], appService, async () => v1);
    const first = (await new DocumentLoader(created.file!).open()).book;
    expect(first.metadata.identifier).toBe(getFeedBookIdentifier(FEED_URL));
    expect(first.sections).toHaveLength(1);

    const book = {
      hash: 'h1',
      format: 'EPUB',
      title: 'Example Blog',
      metadata: first.metadata,
    } as unknown as Book;
    vi.mocked(appService.openFile).mockResolvedValue(created.file!);
    const appended = await buildFeedBook(FEED_URL, [book], appService, async () => v2);
    const second = (await new DocumentLoader(appended.file!).open()).book;
    expect(second.sections).toHaveLength(2);
    expect(second.toc?.map((t) => t.label)).toEqual(['Post 1', 'Post 2']);
    expect(getMetadataHash(second.metadata)).toBe(getMetadataHash(first.metadata));
  });
});

describe('feed URL on book metadata', () => {
  const id = getFeedBookIdentifier(FEED_URL);
  const epubBook = (metadata: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    ({ hash: 'h', format: 'EPUB', title: 'T', metadata, ...extra }) as unknown as Book;

  it('reads the saved feedUrl, or a dc:source that matches the identifier', () => {
    expect(getBookFeedUrl(epubBook({ feedUrl: FEED_URL }))).toBe(FEED_URL);
    expect(getBookFeedUrl(epubBook({ identifier: id, source: FEED_URL }))).toBe(FEED_URL);
    expect(getBookFeedUrl(epubBook({ identifier: id, source: ['x', FEED_URL] }))).toBe(FEED_URL);
    // An ordinary book that happens to cite a URL as its source is not a feed book.
    expect(getBookFeedUrl(epubBook({ identifier: 'isbn', source: FEED_URL }))).toBeUndefined();
    expect(getBookFeedUrl(epubBook({ feedUrl: FEED_URL }, { format: 'PDF' }))).toBeUndefined();
  });

  it('finds the feed book even after its identifier was edited', () => {
    const edited = epubBook({ identifier: 'isbn:123', feedUrl: FEED_URL });
    expect(findFeedBook([epubBook({ identifier: 'other' }), edited], FEED_URL)).toBe(edited);
    expect(findFeedBook([edited], 'https://example.com/other.xml')).toBeUndefined();
  });

  it('opens the EPUB with dc:source set to the feed URL', async () => {
    const appService = { openFile: vi.fn() } as unknown as AppService;
    const v1 = rss(rssItem(1, 'Mon, 01 Jan 2024 10:00:00 GMT'));
    const created = await buildFeedBook(FEED_URL, [], appService, async () => v1);
    expect(created.feedUrl).toBe(FEED_URL);
    const doc = (await new DocumentLoader(created.file!).open()).book;
    expect(getBookFeedUrl(epubBook(doc.metadata as unknown as Record<string, unknown>))).toBe(
      FEED_URL,
    );
  });
});
