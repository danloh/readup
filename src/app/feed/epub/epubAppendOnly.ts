/**
 * Append-only EPUB update logic
 * Ensures CFI stability by only appending new articles to existing EPUBs
 */

import JSZip from 'jszip';
import { ArticleType } from '../components/dataAgent';
import { escapeXml, sanitizeHtml } from './articleToEpub';

/**
 * Parse content.opf to extract manifest content
 */
function extractManifestContent(
  opfContent: string
): { htmlItems: string; docIds: string[] } {
  const htmlItems = opfContent.match(/<item id="(doc\d+)"[^>]*>\s*<\/item>/g) || [];
  const docIds = htmlItems.map(item => item.match(/id="(doc\d+)"/)?.[1] || '').filter(Boolean);
  return { htmlItems: htmlItems.join('\n'), docIds };
}

/**
 * Parse NCX TOC to extract navigation
 */
function extractNavPoints(
  ncxContent: string
): { navPoints: string; maxPlayOrder: number } {
  const navPoints = ncxContent.match(/<navPoint[^>]*>[\s\S]*?<\/navPoint>/g) || [];
  const maxPlayOrder = navPoints.length;
  return { navPoints: navPoints.join('\n'), maxPlayOrder };
}

/**
 * Append new articles to existing EPUB
 */
export async function appendArticlesToEpub(
  epubBlob: Blob,
  newArticles: ArticleType[],
  oldArticleCount: number
): Promise<{ epubBlob: Blob; docIds: string[] }> {
  const zip = new JSZip();
  await zip.loadAsync(epubBlob);

  // Read existing OPF and NCX files
  let opfContent = await zip.file('OEBPS/content.opf')?.async('string') || '';
  let ncxContent = await zip.file('OEBPS/toc.ncx')?.async('string') || '';

  const { docIds: existingDocIds } = extractManifestContent(opfContent);
  const { navPoints: existingNavPoints, maxPlayOrder } = extractNavPoints(ncxContent);

  let newHtmlContent = '';
  let newNavPoints = '';
  const newDocIds: string[] = [];

  // Generate XHTML files for new articles
  newArticles.forEach((article, index) => {
    const docIndex = oldArticleCount + index;
    const docId = `doc${docIndex}`;
    newDocIds.push(docId);

    const articleLinkStr = article.link || `article-${docIndex}`;
    const content = article.description || article.content || '(No content)';

    const xhtml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <html 
        xmlns="http://www.w3.org/1999/xhtml" 
        xmlns:epub="http://www.idpf.org/2007/ops" lang="en"
      >
        <head>
          <title>${escapeXml(article.title)}</title>
          <link rel="stylesheet" type="text/css" href="style.css"/>
        </head>
        <body>
          <article class="chapter" data-article-link="${escapeXml(articleLinkStr)}">
            <h1>${escapeXml(article.title)}</h1>
            ${article.author 
              ? `<p class="author">By ${escapeXml(article.author)}</p>` 
              : ''
            }
            ${article.published 
              ? `<p class="date">${new Date(article.published).toLocaleDateString()}</p>` 
              : ''
            }
            ${article.source 
              ? `<p class="source">Source: ${escapeXml(article.source)}</p>` 
              : ''
            }
            <div class="content">${sanitizeHtml(content)}</div>
          </article>
        </body>
      </html>
    `;

    zip.folder('OEBPS')!.file(`${docId}.xhtml`, xhtml);
    newHtmlContent += 
      `<item id="${docId}" href="${docId}.xhtml" media-type="application/xhtml+xml"/>\n`;

    newNavPoints += `  
      <navPoint id="navpoint-${docIndex}" playOrder="${maxPlayOrder + index + 1}">
        <navLabel><text>${escapeXml(article.title)}</text></navLabel>
        <content src="${docId}.xhtml"/>
      </navPoint>\n
    `;
  });

  // Update OPF manifest - insert new items before </manifest>
  opfContent = opfContent.replace(
    /<item id="ncx".*?\/>/,
    newHtmlContent + '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'
  );

  // Update OPF spine - insert new references before </spine>
  const newSpineRefs = newDocIds.map(docId => `    <itemref idref="${docId}"/>`).join('\n');
  opfContent = opfContent.replace(
    /(<\/spine>)/,
    newSpineRefs + '\n  $1'
  );

  // Update OPF modification date
  const now = new Date().toISOString();
  opfContent = opfContent.replace(
    /<meta property="dcterms:modified">.*?<\/meta>/,
    `<meta property="dcterms:modified">${now}</meta>`
  );

  zip.folder('OEBPS')!.file('content.opf', opfContent);

  // Update NCX TOC
  const allNavPoints = existingNavPoints + '\n' + newNavPoints;
  ncxContent = ncxContent.replace(
    /<navMap>[\s\S]*?<\/navMap>/,
    `<navMap>\n${allNavPoints}  </navMap>`
  );

  // Update NCX depth and page count
  const totalArticles = oldArticleCount + newArticles.length;
  ncxContent = ncxContent.replace(
    /<meta name="dtb:totalPageCount" content="\d*"\/>/,
    `<meta name="dtb:totalPageCount" content="${totalArticles}"/>`
  );

  zip.folder('OEBPS')!.file('toc.ncx', ncxContent);

  // Generate final blob
  const epubBlobResult = await zip.generateAsync({ type: 'blob' });

  return {
    epubBlob: epubBlobResult,
    docIds: [...existingDocIds, ...newDocIds],
  };
}
