import { FeedType } from './dataAgent';

/**
 * Export feeds as OPML format
 * @param feeds Array of feeds to export
 * @param title Optional title for the OPML document
 * @returns OPML XML string
 */
export const exportOPML = (feeds: FeedType[], title: string = 'Readup Feeds'): string => {
  const now = new Date().toISOString();
  
  // Create outline items for each feed
  const outlines = feeds
    .map((feed) => {
      const type = feed.ty === 'podcast' ? 'rss' : feed.ty || 'rss';
      return {
        type,
        text: feed.title,
        title: feed.title,
        xmlUrl: feed.link,
        htmlUrl: feed.link,
      };
    })
    .map((outline) => {
      const attributes = Object.entries(outline)
        .map(([key, value]) => `${key}="${escapeXml(value)}"`)
        .join(' ');
      return `    <outline ${attributes} />`;
    })
    .join('\n');

  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(title)}</title>
    <dateCreated>${now}</dateCreated>
    <docs>http://opml.org/spec2.opml</docs>
  </head>
  <body>
    <outline text="${escapeXml(title)}" title="${escapeXml(title)}">
${outlines}
    </outline>
  </body>
</opml>`;

  return opml;
};

/**
 * Import feeds from OPML content
 * @param opmlContent OPML XML string
 * @returns Array of feeds parsed from OPML
 */
export const importOPML = (opmlContent: string): FeedType[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(opmlContent, 'text/xml');

  // Check for parsing errors
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid OPML format');
  }

  const feeds: FeedType[] = [];
  const outlines = xmlDoc.querySelectorAll('outline');

  outlines.forEach((outline) => {
    // Skip outlines without xmlUrl (they're just categories)
    const xmlUrl = outline.getAttribute('xmlUrl');
    if (!xmlUrl) return;

    const type = outline.getAttribute('type') || 'rss';
    const title = outline.getAttribute('title') || outline.getAttribute('text') || '';
    
    const feed: FeedType = {
      ty: normalizeFeedType(type),
      title: title.trim(),
      link: xmlUrl.trim(),
      description: outline.getAttribute('description') || undefined,
    };

    feeds.push(feed);
  });

  return feeds;
};

/**
 * Normalize feed type from OPML to internal format
 */
const normalizeFeedType = (type: string): string => {
  const normalized = type.toLowerCase();
  if (normalized === 'podcast' || normalized === 'audio/x-mpegurl') {
    return 'podcast';
  }
  // if (normalized === 'opds' || normalized === 'opds+xml') {
  //   return 'opds';
  // }
  return 'rss';
};

/**
 * Escape XML special characters
 */
const escapeXml = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Download OPML file to user's device
 * @param opmlContent OPML XML string
 * @param filename Name of the file to download (default: feeds.opml)
 */
export const downloadOPML = (opmlContent: string, filename: string = 'feeds.opml'): void => {
  const blob = new Blob([opmlContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Parse OPML file from user input
 * @param file File object from input
 * @returns Promise resolving to parsed feeds array
 */
export const parseOPMLFile = (file: File): Promise<FeedType[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const feeds = importOPML(content);
        resolve(feeds);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};
