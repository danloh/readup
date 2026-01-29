import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { createArticlesEpub } from '@/app/feed/epub/articleToEpub';
import { appendArticlesToEpub } from '@/app/feed/epub/epubAppendOnly';

type ArticleType = {
  title: string;
  link?: string;
  content?: string;
  description?: string;
  author?: string;
  published?: number | string;
  source?: string;
};

function makeArticle(i: number): ArticleType {
  return {
    title: `Article ${i}`,
    link: `https://example.com/a${i}`,
    content: `<p>Content ${i}</p>`,
  };
}

describe('appendArticlesToEpub', () => {
  it('appends new articles to an existing EPUB', async () => {
    const initial = [makeArticle(1), makeArticle(2)];
    const newOnes = [makeArticle(3), makeArticle(4)];

    const { epubBlob: initialBlob } = await createArticlesEpub(initial as any);
    const result = await appendArticlesToEpub(initialBlob as Blob, newOnes as any, initial.length);

    // Load resulting EPUB and assert content.opf contains all items
    const zip = new JSZip();
    const loaded = await zip.loadAsync(result.epubBlob as Blob);
    const opf = await loaded.file('OEBPS/content.opf')!.async('string');

    // Count item ids matching doc pattern
    const itemMatches = Array.from(opf.matchAll(/id="(article\d+|doc\d+)"/g));
    expect(itemMatches.length).toBe(initial.length + newOnes.length);

    // Ensure navMap contains navPoint entries for appended articles
    const ncx = await loaded.file('OEBPS/toc.ncx')!.async('string');
    const navPoints = Array.from(ncx.matchAll(/<navPoint[^>]*>/g));
    expect(navPoints.length).toBe(initial.length + newOnes.length);
  });
});
