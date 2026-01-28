/**
 * Convert feed articles to EPUB format with versioning support
 * Handles annotation stability when articles are updated
 */

import JSZip from 'jszip';
import { ArticleType } from '@/app/feed/components/dataAgent';
import { STARRED_ARTICLES_EPUB_NAME } from '@/services/feedEpubService';

export interface EpubManifest {
  version: string; // timestamp-based: YYYYMMDD-HHmmss
  createdAt: number; // milliseconds
  articleIds: string[]; // article links (unique identifiers)
  articleCount: number;
  hash: string; // hash of article IDs to detect changes
}

/**
 * Generate a simple hash from article IDs
 */
function hashArticleIds(articleIds: string[]): string {
  const str = articleIds.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Generate EPUB manifest metadata
 */
export function generateManifest(articles: ArticleType[]): EpubManifest {
  const articleIds = articles.map(a => a.link);
  const now = new Date();
  const version = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  
  return {
    version,
    createdAt: now.getTime(),
    articleIds,
    articleCount: articles.length,
    hash: hashArticleIds(articleIds),
  };
}

/**
 * Detect if articles have changed between two manifests
 */
export function detectArticleChanges(
  oldManifest: EpubManifest,
  newArticles: ArticleType[]
): {
  changed: boolean;
  added: string[];
  removed: string[];
  reordered: boolean;
  appendOnly: boolean; // true if only appended at end
} {
  const newIds = newArticles.map(a => a.link);
  const oldIds = oldManifest.articleIds;

  const added = newIds.filter(id => !oldIds.includes(id));
  const removed = oldIds.filter(id => !newIds.includes(id));
  const reordered = oldIds.some((id, idx) => newIds[idx] !== id);
  
  // Check if only appended (old articles in same order, new ones at end)
  const appendOnly = removed.length === 0 && 
    oldIds.every((id, idx) => newIds[idx] === id);

  return {
    changed: added.length > 0 || removed.length > 0 || reordered,
    added,
    removed,
    reordered,
    appendOnly,
  };
}

/**
 * Create EPUB file from articles
 * Returns both the EPUB blob and the manifest for storage
 */
export async function createArticlesEpub(
  articles: ArticleType[]
): Promise<{
  epubBlob: Blob;
  manifest: EpubManifest;
}> {
  const zip = new JSZip();
  const manifest = generateManifest(articles);

  // 1. Create mimetype file (must be first, uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. Create META-INF/container.xml
  const containerXml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>
  `;
  zip.folder('META-INF')!.file('container.xml', containerXml);

  // 3. Store manifest as JSON in OEBPS for easy retrieval
  zip.folder('OEBPS')!.file('manifest.json', JSON.stringify(manifest, null, 2));

  // 4. Create XHTML documents for each article
  const docIds = articles.map((_, idx) => `article${idx}`);
  let htmlContent = '';

  articles.forEach((article, index) => {
    const docId = docIds[index];
    const content = article.content || article.description || '';
    
    // Create stable ID for article based on link hash
    const articleLinkStr = article.link || `article-${index}`;
    const articleHash = Math.abs(
      articleLinkStr.split('').reduce((hash, char) => {
        return ((hash << 5) - hash) + char.charCodeAt(0);
      }, 0)
    ).toString(16);

    const xhtml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <html 
        xmlns="http://www.w3.org/1999/xhtml" 
        xmlns:epub="http://www.idpf.org/2007/ops" 
        id="article-${articleHash}"
      >
        <head>
          <title>${escapeXml(article.title)}</title>
          <meta charset="utf-8"/>
        </head>
        <body>
          <article 
            id="article-${index}" 
            class="chapter" 
            data-article-link="${escapeXml(articleLinkStr)}"
          >
            <h1>${escapeXml(article.title)}</h1>
            ${article.author ? `<p class="author">By ${escapeXml(article.author)}</p>` : ''}
            ${article.published 
              ? `<p class="date">${new Date(article.published).toLocaleDateString()}</p>` 
              : ''
            }
            ${article.source ? `<p class="source">Source: ${escapeXml(article.source)}</p>` : ''}
            <div class="content">${sanitizeHtml(content)}</div>
          </article>
        </body>
      </html>
    `;

    zip.folder('OEBPS')!.file(`${docId}.xhtml`, xhtml);
    htmlContent += 
      `<item id="${docId}" href="${docId}.xhtml" media-type="application/xhtml+xml"/>\n`;
  });

  // 5. Create spine content
  let spineContent = '';
  docIds.forEach(docId => { spineContent += `<itemref idref="${docId}"/>\n`; });

  // 6. Create content.opf (package document)
  const title = STARRED_ARTICLES_EPUB_NAME;
  const contentOpf = `
    <?xml version="1.0" encoding="UTF-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uuid">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier id="uuid">urn:uuid:${generateUuid()}</dc:identifier>
        <dc:title>${escapeXml(title)}</dc:title>
        <dc:creator>Feed Reader</dc:creator>
        <dc:date>${new Date().toISOString()}</dc:date>
        <dc:language>en</dc:language>
        <meta property="dcterms:modified">${new Date().toISOString()}</meta>
      </metadata>
      <manifest>
        ${htmlContent}
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
      </manifest>
      <spine toc="ncx">${spineContent}</spine>
    </package>
  `;

  zip.folder('OEBPS')!.file('content.opf', contentOpf);

  // 7. Create NCX TOC
  let navPoints = '';
  articles.forEach((article, index) => {
    const docId = docIds[index];
    navPoints += `  
      <navPoint id="navpoint-${index}" playOrder="${index + 1}">
        <navLabel>
          <text>${escapeXml(article.title)}</text>
        </navLabel>
        <content src="${docId}.xhtml"/>
      </navPoint>
    `;
  });

  const tocNcx = `
    <?xml version="1.0" encoding="UTF-8"?>
    <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
      <head>
        <meta name="dtb:uid" content="urn:uuid:${generateUuid()}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
      </head>
      <docTitle><text>${escapeXml(title)}</text></docTitle>
      <navMap>${navPoints}</navMap>
    </ncx>
  `;

  zip.folder('OEBPS')!.file('toc.ncx', tocNcx);

  // 8. Create CSS
  const css = `
    body {
      margin: 1em;
      padding: 0;
      font-family: "Noto Serif", Georgia, serif;
      line-height: 1.5;
    }
    article {
      margin-bottom: 2em;
    }
    h1 {
      font-size: 1.8em;
      margin: 0.5em 0;
      font-weight: bold;
    }
    .author, .date, .source {
      font-size: 0.9em;
      color: #666;
      margin: 0.3em 0;
      font-style: italic;
    }
    .content {
      margin-top: 1em;
      text-align: justify;
    }
    .content p {
      margin: 0.5em 0;
    }
    .content img {
      max-width: 100%;
      height: auto;
    }
  `;

  zip.folder('OEBPS')!.file('style.css', css);

  // Generate zip
  const epubBlob = await zip.generateAsync({ type: 'blob' });

  return { epubBlob, manifest };
}

/**
 * Helper functions
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeHtml(html: string): string {
  // Basic sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript:/gi, '');
}

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
