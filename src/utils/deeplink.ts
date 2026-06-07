import { READUP_WEB_BASE_URL } from '@/services/constants';

export type ShareDeepLink = {
  bookHash: string;
  noteId?: string;
  did?: string;
  cfi?: string;
};

/**
 * Which form of sharing link : 
 * the custom-scheme `readup://` app deeplink or the universal `https://` web link.
 */
export type ShareLinkType = 'app' | 'web';

/**
 * Build the canonical HTTPS URL for sharing.
 */
export const buildShareWebUrl = ({ bookHash, noteId, did, cfi }: ShareDeepLink): string => {
  let base = `${READUP_WEB_BASE_URL}/share?id=${bookHash}`;
  if (noteId) {
    base += `&nid=${noteId}`;
  }
  if (did) {
    base += `&did=${did}`;
  }
  if (cfi) {
    base += `&loc=${encodeURIComponent(cfi)}`;
  }

  return base;
};

/**
 * Build the custom-scheme URL. Kept as a parallel form for share-sheet flows
 * and direct deeplink scenarios. Markdown export uses the HTTPS form.
 */
export const buildShareAppUrl = ({ bookHash, noteId, did, cfi }: ShareDeepLink): string => {
  let base = `readup://share?id=${bookHash}`;
  if (noteId) {
    base += `&nid=${noteId}`;
  }
  if (did) {
    base += `&did=${did}`;
  }
  if (cfi) {
    base += `&loc=${encodeURIComponent(cfi)}`;
  }

  return base;
};

/**
 * Build the sharing link for the requested {@link ShareLinkType}.
 * `app` yields the custom-scheme deeplink; `web` yields the universal HTTPS form.
 */
export const buildShareUrl = (
  link: ShareDeepLink,
  linkType: ShareLinkType,
): string => (linkType === 'app' ? buildShareAppUrl(link) : buildShareWebUrl(link));

/**
 * Parse an incoming `readup://` or `https://`  URL.
 * Returns null if the URL doesn't match.
 */
export const parseShareDeepLink = (url: string): ShareDeepLink | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const isCustomScheme = parsed.protocol === 'readup:';
  const isWebHost =
    (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.host === 'readup.cc';

  if (!isCustomScheme && !isWebHost) return null;

  const bookHash = parsed.searchParams.get('id');
  if (bookHash) {
    const cfiParam = parsed.searchParams.get('loc');
    const cfi = cfiParam ? cfiParam : undefined;
    const didParam = parsed.searchParams.get('did');
    const did = didParam ? didParam : undefined;
    const noteParam = parsed.searchParams.get('nid');
    const noteId = noteParam ? noteParam : undefined;

    return { bookHash, noteId, did, cfi };
  }

  return null;
};
